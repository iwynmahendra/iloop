import { config } from './config.js';
import { logger } from './logger.js';

export interface Mailer { send(to: string, subject: string, text: string): Promise<void> }
/**
 * Placeholder mailer: logs the message. Replace with SMTP / SES / Resend before production.
 * (Reset links are printed to the server log in development only.)
 */
export const mailer: Mailer = {
  async send(to, subject, text) {
    if (config.NODE_ENV === 'production') logger.warn({ to, subject }, 'No mailer configured: email NOT sent');
    else logger.info({ to, subject, text }, 'DEV email');
  },
};
