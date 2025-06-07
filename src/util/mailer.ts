import nodemailer from "nodemailer";
import CONFIG from "./config";
import { getLogger } from "./logger";

const logger = getLogger("UTIL.MAILER");

const transporter = CONFIG.mail.enabled ? nodemailer.createTransport({
    host: CONFIG.mail.smtpHost,
    port: CONFIG.mail.smtpPort,
    secure: CONFIG.mail.smtpSecure,
    auth: {
        user: CONFIG.mail.smtpUser,
        pass: CONFIG.mail.smtpPassword
    }
}) : undefined;

/** Sends an email to someone, requires SMTP to be configured */
export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
    if (!transporter) {
        logger.warn("Email sending is disabled in the configuration.");
        return Promise.reject(new Error("Email sending is disabled in the configuration."));
    }

    const mailOptions = {
        from: CONFIG.mail.from,
        to, subject, text, html
    };

    try {
        logger.debug(`Sending email to ${to} with subject "${subject}"`);
        await transporter.sendMail(mailOptions);
    } catch (error) {
        logger.error("Error sending email:", error);
        return Promise.reject(error);
    }
}
