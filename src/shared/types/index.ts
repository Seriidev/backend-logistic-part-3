import { UserRole } from '../enums/roles.enum';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
}

export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  field: string;
  order: SortOrder;
}
