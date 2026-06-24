import { UserRole } from '../enums/roles.enum';
import { Permission } from '../enums/permissions.enum';

/**
 * Role-Permission mapping for the Yuusell Logistics Platform.
 *
 * Super Admin — full access to everything (handled separately in guard)
 * Admin — manage shipments, customers, warehouse, view wallet
 * Manager — manage shipments, view customers
 * Warehouse — warehouse operations only
 * Driver — view assigned shipments, update GPS
 * Customer — view own shipments, wallet
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission), // All permissions

  [UserRole.ADMIN]: [
    // Auth
    Permission.AUTH_MANAGE_USERS,
    Permission.AUTH_VIEW_USERS,
    // Shipments
    Permission.SHIPMENTS_CREATE,
    Permission.SHIPMENTS_EDIT,
    Permission.SHIPMENTS_VIEW_ALL,
    Permission.SHIPMENTS_DELETE,
    Permission.SHIPMENTS_BULK_UPDATE,
    Permission.SHIPMENTS_ASSIGN_DRIVER,
    Permission.SHIPMENTS_UPDATE_STATUS,
    // Tracking
    Permission.TRACKING_VIEW,
    // Warehouse
    Permission.WAREHOUSE_RECEIVE,
    Permission.WAREHOUSE_SCAN,
    Permission.WAREHOUSE_INVENTORY,
    Permission.WAREHOUSE_OUTBOUND,
    Permission.WAREHOUSE_REPORTS,
    // Wallet
    Permission.WALLET_VIEW_ALL,
    Permission.WALLET_VIEW_OWN,
    Permission.WALLET_BONUS,
    // CRM / Customers
    Permission.CUSTOMERS_CREATE,
    Permission.CUSTOMERS_EDIT,
    Permission.CUSTOMERS_VIEW_ALL,
    Permission.CUSTOMERS_NOTES,
    Permission.CUSTOMERS_TICKETS,
    // Notifications
    Permission.NOTIFICATIONS_MANAGE,
    Permission.NOTIFICATIONS_VIEW_OWN,
    // Reports
    Permission.REPORTS_VIEW,
    // Settings
    Permission.SETTINGS_MANAGE,
  ],

  [UserRole.MANAGER]: [
    // Shipments
    Permission.SHIPMENTS_CREATE,
    Permission.SHIPMENTS_EDIT,
    Permission.SHIPMENTS_VIEW_ALL,
    Permission.SHIPMENTS_ASSIGN_DRIVER,
    Permission.SHIPMENTS_UPDATE_STATUS,
    // Tracking
    Permission.TRACKING_VIEW,
    // Customers (view only)
    Permission.CUSTOMERS_VIEW_ALL,
    Permission.CUSTOMERS_NOTES,
    Permission.CUSTOMERS_TICKETS,
    // Notifications
    Permission.NOTIFICATIONS_VIEW_OWN,
    // Reports
    Permission.REPORTS_VIEW,
  ],

  [UserRole.WAREHOUSE]: [
    // Warehouse operations only
    Permission.WAREHOUSE_RECEIVE,
    Permission.WAREHOUSE_SCAN,
    Permission.WAREHOUSE_INVENTORY,
    Permission.WAREHOUSE_OUTBOUND,
    Permission.WAREHOUSE_REPORTS,
    // Shipments (view for context)
    Permission.SHIPMENTS_VIEW_ALL,
    Permission.SHIPMENTS_UPDATE_STATUS,
    // Notifications
    Permission.NOTIFICATIONS_VIEW_OWN,
  ],

  [UserRole.DRIVER]: [
    // Shipments (view assigned only)
    Permission.SHIPMENTS_VIEW_ASSIGNED,
    Permission.SHIPMENTS_UPDATE_STATUS,
    // Tracking
    Permission.TRACKING_VIEW,
    Permission.TRACKING_UPDATE_GPS,
    // Notifications
    Permission.NOTIFICATIONS_VIEW_OWN,
  ],

  [UserRole.CUSTOMER]: [
    // Shipments (own only)
    Permission.SHIPMENTS_CREATE,
    Permission.SHIPMENTS_VIEW_OWN,
    // Tracking
    Permission.TRACKING_VIEW,
    // Wallet (own only)
    Permission.WALLET_VIEW_OWN,
    Permission.WALLET_TRANSFER,
    // Customers (own profile)
    Permission.CUSTOMERS_VIEW_OWN,
    Permission.CUSTOMERS_TICKETS,
    // Notifications
    Permission.NOTIFICATIONS_VIEW_OWN,
  ],
};

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Get all permissions for a role.
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
