"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const logger_1 = require("./logger");
const sendEmail = async (options) => {
    if (!env_1.env.SMTP_USER || env_1.env.SMTP_USER.includes('your_gmail_address')) {
        logger_1.logger.warn('SMTP credentials not configured. Printing email payload to logs:');
        logger_1.logger.info(`
      ✉️ [SIMULATED EMAIL]
      To: ${options.to}
      Subject: ${options.subject}
      Body: ${options.text}
    `);
        return;
    }
    try {
        const transporter = nodemailer_1.default.createTransport({
            host: env_1.env.SMTP_HOST,
            port: env_1.env.SMTP_PORT,
            secure: env_1.env.SMTP_PORT === 465, // true for 465, false for other ports
            auth: {
                user: env_1.env.SMTP_USER,
                pass: env_1.env.SMTP_PASS,
            },
        });
        const mailOptions = {
            from: `"Parka Parking" <${env_1.env.SMTP_USER}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        };
        await transporter.sendMail(mailOptions);
        logger_1.logger.info(`Email successfully sent to ${options.to}`);
    }
    catch (error) {
        logger_1.logger.error(`Error sending email to ${options.to}:`, error);
    }
};
exports.sendEmail = sendEmail;
