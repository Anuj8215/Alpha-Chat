//!SECTION - EMAIL SERVICE FOR PASSWORD RESET

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    // Add timeout and other options for better reliability
    tls: {
        rejectUnauthorized: false
    }
});

// Verify transporter configuration on startup
const verifyTransporter = async () => {
    try {
        await transporter.verify();
        logger.info('Email transporter verified successfully');
    } catch (error) {
        logger.error(`Email transporter verification failed: ${error.message}`);
        throw error;
    }
};

//NOTE - SEND PASSWORD RESET EMAIL

const sendPasswordResetEmail = async (email, resetToken) => {
    try {
        const baseUrl = process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 3000}`;
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: `"Alpha-Chat Support" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Alpha-Chat Password Reset',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Password Reset - Alpha-Chat</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #007bff;">Password Reset Request</h2>
                        <p>Hello,</p>
                        <p>You requested a password reset for your Alpha-Chat account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                        </div>
                        <p><strong>Important:</strong> This link will expire in 15 minutes for security reasons.</p>
                        <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #666;">
                            This email was sent from Alpha-Chat. If you have any questions, please contact support.
                        </p>
                    </div>
                </body>
                </html>
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
            from: `"Alpha-Chat Support" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Alpha-Chat Password Reset Successful',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Password Reset Successful - Alpha-Chat</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #28a745;">Password Reset Successful</h2>
                        <p>Hello,</p>
                        <p>Your Alpha-Chat password has been successfully reset.</p>
                        <p>You can now log in to your account using your new password.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/login" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Login to Your Account</a>
                        </div>
                        <p style="color: #dc3545;"><strong>Security Notice:</strong> If you didn't perform this password reset, please contact support immediately and change your password.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #666;">
                            This email was sent from Alpha-Chat. If you have any questions, please contact support.
                        </p>
                    </div>
                </body>
                </html>
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
    sendPasswordResetConfirmation,
    verifyTransporter
};