import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  globalTtl: parseInt(process.env.GLOBAL_THROTTLE_TTL || '60000', 10),
  globalLimit: parseInt(process.env.GLOBAL_THROTTLE_LIMIT || '100', 10),
  authTtl: parseInt(process.env.AUTH_THROTTLE_TTL || '60000', 10),
  authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT || '10', 10),
}));
