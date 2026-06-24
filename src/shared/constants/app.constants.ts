export const APP_CONSTANTS = {
  // Pagination defaults
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Auth
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes in ms
  WELCOME_BONUS_AMOUNT: 10.0,
  REFERRAL_BONUS_AMOUNT: 5.0,

  // Tracking number prefix
  TRACKING_PREFIX: 'YUU',
} as const;
