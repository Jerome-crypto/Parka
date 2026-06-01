import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const sendEmail = async (options: SendMailOptions): Promise<void> => {
  if (!env.SMTP_USER || env.SMTP_USER.includes('your_gmail_address')) {
    logger.warn('SMTP credentials not configured. Printing email payload to logs:');
    logger.info(`
      ✉️ [SIMULATED EMAIL]
      To: ${options.to}
      Subject: ${options.subject}
      Body: ${options.text}
    `);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Parka Parking" <${env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Email successfully sent to ${options.to}`);
  } catch (error) {
    logger.error(`Error sending email to ${options.to}:`, error);
  }
};
