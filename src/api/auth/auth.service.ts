import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { hashPassword, comparePassword } from '../../shared/utils/hash.util';
import { generateResetToken } from '../../shared/utils/token.util';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { AuthResponse, AuthTokens } from './interfaces/auth-response.interface';
import {
  JwtPayload,
  JwtRefreshPayload,
} from '../../shared/interfaces/jwt-payload.interface';
import { UserRole } from '../../shared/enums/roles.enum';

const LOCKOUT_PREFIX = 'auth:lockout:';
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 900; // 15 minutes
const RESET_TOKEN_PREFIX = 'auth:reset:';
const RESET_TOKEN_TTL = 3600; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  // ===========================
  // REGISTER
  // ===========================
  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password with bcrypt (cost factor 12)
    const passwordHash = await hashPassword(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: UserRole.CUSTOMER,
        isActive: true,
      },
    });

    // Auto-create wallet (placeholder for Sprint 4)
    await this.prisma.wallet.create({
      data: {
        userId: user.id,
        balance: 10.0, // $10 welcome bonus
        bonusBalance: 10.0,
        currency: 'USD',
      },
    });

    this.logger.log(`New user registered: ${user.email}`);

    // Generate tokens and create session
    const tokens = await this.generateTokensAndCreateSession(
      user.id,
      user.email,
      user.role as UserRole,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tokens,
    };
  }

  // ===========================
  // LOGIN
  // ===========================
  async login(
    dto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();

    // Check lockout
    await this.checkAccountLockout(email);

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await this.incrementFailedAttempts(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await comparePassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      await this.incrementFailedAttempts(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Clear failed attempts on successful login
    await this.redis.del(`${LOCKOUT_PREFIX}${email}`);

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens and create session
    const tokens = await this.generateTokensAndCreateSession(
      user.id,
      user.email,
      user.role as UserRole,
      ip,
      userAgent,
    );

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tokens,
    };
  }

  // ===========================
  // REFRESH TOKEN
  // ===========================
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Find session in DB
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Session not found or token mismatch');
    }

    if (new Date() > session.expiresAt) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Session expired');
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    // Generate new tokens (token rotation)
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role as UserRole,
      session.id,
    );

    // Update session with new refresh token
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return tokens;
  }

  // ===========================
  // LOGOUT
  // ===========================
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Delete specific session
      try {
        const payload = this.jwtService.verify<JwtRefreshPayload>(
          refreshToken,
          {
            secret: this.configService.get<string>('jwt.refreshSecret'),
          },
        );
        await this.prisma.session.delete({
          where: { id: payload.sessionId },
        });
      } catch {
        // Token invalid, delete all sessions for user
        await this.prisma.session.deleteMany({
          where: { userId },
        });
      }
    } else {
      // No refresh token provided, delete all sessions
      await this.prisma.session.deleteMany({
        where: { userId },
      });
    }

    this.logger.log(`User logged out: ${userId}`);
  }

  // ===========================
  // GET PROFILE
  // ===========================
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        firstName: true,
        lastName: true,
        avatar: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  // ===========================
  // CHANGE PASSWORD
  // ===========================
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await comparePassword(
      dto.oldPassword,
      user.passwordHash,
    );

    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate all sessions (force re-login)
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    this.logger.log(`Password changed for user: ${userId}`);
  }

  // ===========================
  // FORGOT PASSWORD
  // ===========================
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Always return success (don't reveal if email exists)
    if (!user) {
      return { message: 'If this email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = generateResetToken();

    // Store in Redis with TTL
    await this.redis.setex(
      `${RESET_TOKEN_PREFIX}${resetToken}`,
      RESET_TOKEN_TTL,
      user.id,
    );

    // TODO: Sprint 5 — Send email via SendGrid
    this.logger.log(
      `Password reset requested for: ${user.email} (token: ${resetToken})`,
    );

    return { message: 'If this email exists, a reset link has been sent' };
  }

  // ===========================
  // RESET PASSWORD
  // ===========================
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    // Verify reset token from Redis
    const userId = await this.redis.get(`${RESET_TOKEN_PREFIX}${dto.token}`);

    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Delete used reset token
    await this.redis.del(`${RESET_TOKEN_PREFIX}${dto.token}`);

    // Invalidate all sessions
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    this.logger.log(`Password reset completed for user: ${userId}`);

    return { message: 'Password has been reset successfully' };
  }

  // ===========================
  // PRIVATE HELPERS
  // ===========================

  private async generateTokensAndCreateSession(
    userId: string,
    email: string,
    role: UserRole,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    // Create session first to get sessionId
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshToken: 'pending', // will be updated
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(userId, email, role, session.id);

    // Update session with actual refresh token
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return tokens;
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    sessionId: string,
  ): Promise<AuthTokens> {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      sessionId,
    };

    /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload as any),
      this.jwtService.signAsync(refreshPayload as any, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>(
          'jwt.refreshExpiration',
          '30d',
        ) as any,
      }),
    ]);
    /* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */

    return { accessToken, refreshToken };
  }

  private async checkAccountLockout(email: string): Promise<void> {
    const key = `${LOCKOUT_PREFIX}${email}`;
    const attempts = await this.redis.get(key);

    if (attempts && parseInt(attempts, 10) >= LOCKOUT_MAX_ATTEMPTS) {
      const ttl = await this.redis.ttl(key);
      throw new UnauthorizedException(
        `Account locked due to too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      );
    }
  }

  private async incrementFailedAttempts(email: string): Promise<void> {
    const key = `${LOCKOUT_PREFIX}${email}`;
    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      // First failed attempt, set expiry
      await this.redis.expire(key, LOCKOUT_DURATION_SECONDS);
    }

    const remaining = LOCKOUT_MAX_ATTEMPTS - attempts;
    if (remaining > 0) {
      this.logger.warn(
        `Failed login attempt for ${email}. ${remaining} attempts remaining.`,
      );
    } else {
      this.logger.warn(
        `Account locked for ${email} after ${LOCKOUT_MAX_ATTEMPTS} failed attempts.`,
      );
    }
  }
}
