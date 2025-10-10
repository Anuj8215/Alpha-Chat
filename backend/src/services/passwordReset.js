//!SECTION - PASSWORD RESET SERVICE

const crypto = require('crypto');
const User = require('../models/users');
const logger = require('../utils/logger');
const emailService = require('./emailService');

//NOTE - GENERATE PASSWORD RESET TOKEN AND SEND EMAIL
const generateResetToken = async (email) => {
    try {
        const user = await User.findOne({ email });

        if (!user) {
            throw new Error('User not found with this email address');
        }

        if (user.authProvider === 'google') {
            throw new Error('Password reset not available for Google authenticated accounts');
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Save token to user (you'll need to add these fields to User model)
        user.passwordResetToken = resetToken;
        user.passwordResetExpires = resetTokenExpiry;
        await user.save();

        // Send reset email
        await emailService.sendPasswordResetEmail(user.email, resetToken);

        return { success: true, message: 'Password reset email sent successfully' };

    } catch (error) {
        logger.error(`Generate reset token error: ${error.message}`);
        throw error;
    }
};

//NOTE - RESET PASSWORD USING TOKEN

const resetPassword = async (token, newPassword) => {
    try {
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            throw new Error('Invalid or expired reset token');
        }

        // Update password
        user.password = newPassword; // Will be hashed by pre-save hook
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        // Send confirmation email
        await emailService.sendPasswordResetConfirmation(user.email);

        return { success: true, message: 'Password reset successfully' };

    } catch (error) {
        logger.error(`Reset password error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    generateResetToken,
    resetPassword
};