import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  apiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@yuusell.com',
}));
