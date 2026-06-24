import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../../shared/enums/permissions.enum';
import { UserRole } from '../../shared/enums/roles.enum';
import { ROLE_PERMISSIONS } from '../../shared/constants/role-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions specified, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { sub: string; email: string; role: string };
    }>();
    const user = request.user;

    if (!user) {
      return false;
    }

    const userRole = user.role as UserRole;

    // Super admin always has access
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Get permissions for the user's role
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];

    // Check if user has ALL required permissions
    return requiredPermissions.every((permission) =>
      rolePermissions.includes(permission),
    );
  }
}
