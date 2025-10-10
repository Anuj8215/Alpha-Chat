//!SECTION - EMAIL SERVICE FOR PASSWORD RESET

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

//NOTE - SEND PASSWORD RESET EMAIL

const sendPasswordResetEmail = async (email, resetToken) => {
    try {
        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Alpha-Chat Password Reset',
            html: `
                <h2>Password Reset Request</h2>
                <p>You requested a password reset for your Alpha-Chat account.</p>
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>This link will expire in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        logger.info(`Password reset email sent to: ${email}`);

    } catch (error) {
        logger.error(`Send password reset email error: ${error.message}`);
        throw error;
    }
};

//NOTE - SEND CONFIRMATION EMAIL AFTER PASSWORD RESET

const sendPasswordResetConfirmation = async (email) => {
    try {
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Alpha-Chat Password Reset Successful',
            html: `
                <h2>Password Reset Successful</h2>
                <p>Your Alpha-Chat password has been successfully reset.</p>
                <p>If you didn't perform this action, please contact support immediately.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        logger.info(`Password reset confirmation sent to: ${email}`);

    } catch (error) {
        logger.error(`Send password reset confirmation error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    sendPasswordResetEmail,
    sendPasswordResetConfirmation
};