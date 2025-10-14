//!SECTION - AUTHENTICATION ROUTES

const express = require('express');
const authService = require('../services/auth');
const { authenticate } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

//NOTE - REGISTER A NEW USER (POST /api/auth/register, PUBLIC)
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ error: { message: 'ALL FIELDS ARE REQUIRED' } });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: { message: 'PASSWORD MUST BE AT LEAST 8 CHARACTERS LONG' } });
        }

        //NOTE - REGISTER NEW USER VIA AUTHSERVICE
        const user = await authService.registerUser({ firstName, lastName, email, password });
        res.status(201).json({ message: 'USER REGISTERED SUCCESSFULLY', user });

    } catch (error) {
        logger.error(`REGISTER ROUTE ERROR: ${error.message}`);

        if (error.message.includes('already exists')) {
            return res.status(409).json({ error: { message: error.message } });
        }
        res.status(500).json({ error: { message: 'REGISTRATION FAILED' } });
    }
});

//NOTE - LOGIN USER (POST /api/auth/login, PUBLIC)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: { message: 'EMAIL AND PASSWORD ARE REQUIRED' } });
        }
        const { user, token } = await authService.loginUser({ email, password });
        res.status(200).json({ message: 'LOGIN SUCCESSFUL', user, token });
    } catch (error) {
        logger.error(`LOGIN ROUTE ERROR: ${error.message}`);

        if (error.message.includes('Invalid email or password')) {
            return res.status(401).json({ error: { message: 'Invalid email or password' } });
        }
        res.status(500).json({ error: { message: 'LOGIN FAILED' } });
    }
});

//NOTE - AUTHENTICATE WITH GOOGLE (POST /api/auth/google, PUBLIC)
router.post('/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: { message: 'TOKEN IS REQUIRED' } });
        }

        //NOTE - AUTHENTICATE WITH GOOGLE SERVICE
        const { user, token } = await authService.googleAuth(idToken);
        res.status(200).json({ message: 'GOOGLE AUTHENTICATION SUCCESSFUL', user, token });

    } catch (error) {
        logger.error(`GOOGLE AUTH ROUTE ERROR: ${error.message}`);
        res.status(500).json({ error: { message: 'GOOGLE AUTHENTICATION FAILED' } });
    }
});

//NOTE - GET CURRENT USER PROFILE 
router.get('/me', authenticate, (req, res) => {
    res.status(200).json({
        message: 'USER PROFILE RETRIEVED SUCCESSFULLY',
        user: req.user
    });
});

//NOTE - IMPORT PASSWORD RESET SERVICE
const passwordResetService = require('../services/passwordReset');

//NOTE - FORGOT PASSWORD (POST /api/auth/forgot-password, PUBLIC)
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: { message: 'Email is required' }
            });
        }

        await passwordResetService.generateResetToken(email);

        res.status(200).json({
            message: 'If an account with that email exists, a password reset link has been sent'
        });

    } catch (error) {
        logger.error(`Forgot password route error: ${error.message}`);
        // Always return success message for security (prevent email enumeration)
        res.status(200).json({
            message: 'If an account with that email exists, a password reset link has been sent'
        });
    }
});

//NOTE - RESET PASSWORD (POST /api/auth/reset-password, PUBLIC)
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                error: { message: 'Token and new password are required' }
            });
        }

        if (confirmPassword && newPassword !== confirmPassword) {
            return res.status(400).json({
                error: { message: 'Passwords do not match' }
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                error: { message: 'Password must be at least 8 characters long' }
            });
        }

        // Additional password strength validation
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumbers = /\d/.test(newPassword);

        if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
            return res.status(400).json({
                error: { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' }
            });
        }

        await passwordResetService.resetPassword(token, newPassword);

        res.status(200).json({
            message: 'Password reset successfully'
        });

    } catch (error) {
        logger.error(`Reset password route error: ${error.message}`);

        if (error.message.includes('Invalid or expired')) {
            return res.status(400).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to reset password' }
        });
    }
});

//NOTE - LOGOUT (POST /api/auth/logout, PRIVATE)
router.post('/logout', authenticate, async (req, res) => {
    try {

        res.status(200).json({
            message: 'Logged out successfully'
        });

    } catch (error) {
        logger.error(`Logout route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to logout' }
        });
    }
});

module.exports = router;
