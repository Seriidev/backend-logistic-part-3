export enum Permission {
  // Auth
  AUTH_MANAGE_USERS = 'auth:manage_users',
  AUTH_VIEW_USERS = 'auth:view_users',

  // Shipments
  SHIPMENTS_CREATE = 'shipments:create',
  SHIPMENTS_EDIT = 'shipments:edit',
  SHIPMENTS_VIEW_ALL = 'shipments:view_all',
  SHIPMENTS_VIEW_OWN = 'shipments:view_own',
  SHIPMENTS_VIEW_ASSIGNED = 'shipments:view_assigned',
  SHIPMENTS_DELETE = 'shipments:delete',
  SHIPMENTS_BULK_UPDATE = 'shipments:bulk_update',
  SHIPMENTS_ASSIGN_DRIVER = 'shipments:assign_driver',
  SHIPMENTS_UPDATE_STATUS = 'shipments:update_status',

  // Tracking
  TRACKING_VIEW = 'tracking:view',
  TRACKING_UPDATE_GPS = 'tracking:update_gps',

  // Warehouse
  WAREHOUSE_RECEIVE = 'warehouse:receive',
  WAREHOUSE_SCAN = 'warehouse:scan',
  WAREHOUSE_INVENTORY = 'warehouse:inventory',
  WAREHOUSE_OUTBOUND = 'warehouse:outbound',
  WAREHOUSE_REPORTS = 'warehouse:reports',

  // Wallet
  WALLET_VIEW_OWN = 'wallet:view_own',
  WALLET_VIEW_ALL = 'wallet:view_all',
  WALLET_TRANSFER = 'wallet:transfer',
  WALLET_BONUS = 'wallet:bonus',

  // CRM / Customers
  CUSTOMERS_CREATE = 'customers:create',
  CUSTOMERS_EDIT = 'customers:edit',
  CUSTOMERS_VIEW_ALL = 'customers:view_all',
  CUSTOMERS_VIEW_OWN = 'customers:view_own',
  CUSTOMERS_NOTES = 'customers:notes',
  CUSTOMERS_TICKETS = 'customers:tickets',

  // Notifications
  NOTIFICATIONS_MANAGE = 'notifications:manage',
  NOTIFICATIONS_VIEW_OWN = 'notifications:view_own',

  // Reports
  REPORTS_VIEW = 'reports:view',

  // Settings
  SETTINGS_MANAGE = 'settings:manage',
}
