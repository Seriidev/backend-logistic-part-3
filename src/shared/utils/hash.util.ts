import * as bcrypt from 'bcrypt';

export async function hashPassword(
  password: string,
  saltRounds: number = 12,
): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
