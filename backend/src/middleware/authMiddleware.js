//!SECTION - AUTHENTICATION MIDDLEWARE

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const User = require('../models/users');

//NOTE - MIDDLEWARE TO AUTHENTICATE USER WITH JWT TOKEN

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: { message: "Authentication required. No token provided" } })
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            if (!user) {
                return res.status(401).json({ error: { message: 'Authentication failed. User not found.' } });
            }
            //NOTE - ATTACH USER TO REQUEST OBJECT
            req.user = user;
            next();
        } catch (error) {
            logger.error(`Token Verification Error: ${error.message}`);
            return res.status(401).json({ error: { message: 'Invalid or expired token' } });
        }
    } catch (error) {
        logger.error(`Authentication Middleware Error: ${error.message}`);
        return res.status(401).json({ error: { message: 'Internal server error' } });
    }
}
//NOTE - MIDDLEWARE TO AUTHORIZE ADMIN USERS
const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: { message: 'Forbidden. Admins only.' } });
    }
    next();
};

//NOTE - OPTIONAL AUTHENTICATION MIDDLEWARE (FOR TEMPORARY CHATS)
const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // If no auth header, continue without user
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');

            // If user not found, continue without user (don't fail)
            if (!user) {
                req.user = null;
                return next();
            }

            // Attach user to request if valid
            req.user = user;
            next();
        } catch (error) {
            // If token is invalid, continue without user (don't fail)
            logger.info(`Invalid token in optional auth: ${error.message}`);
            req.user = null;
            next();
        }
    } catch (error) {
        logger.error(`Optional Authentication Middleware Error: ${error.message}`);
        req.user = null;
        next();
    }
};

module.exports = {
    authenticate,
    isAdmin,
    optionalAuthenticate
};
