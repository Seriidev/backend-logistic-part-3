export const ERROR_MESSAGES = {
  // Auth
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account is locked. Please try again later',
  ACCOUNT_DISABLED: 'Account has been disabled',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  INVALID_TOKEN: 'Invalid or expired token',
  REFRESH_TOKEN_EXPIRED: 'Refresh token has expired',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'You do not have permission to perform this action',

  // Shipment
  SHIPMENT_NOT_FOUND: 'Shipment not found',
  INVALID_STATUS_TRANSITION: 'Invalid status transition',
  SHIPMENT_ALREADY_CANCELLED: 'Shipment is already cancelled',

  // Wallet
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  WALLET_NOT_FOUND: 'Wallet not found',
  SELF_TRANSFER_NOT_ALLOWED: 'Cannot transfer to yourself',

  // General
  NOT_FOUND: 'Resource not found',
  INTERNAL_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Validation failed',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later',
} as const;
