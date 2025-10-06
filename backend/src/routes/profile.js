//!SECTION - USER PROFILE ROUTES

const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const User = require('../models/users');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/profiles/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

//NOTE - GET USER PROFILE 
router.get('/', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');

        if (!user) {
            return res.status(404).json({
                error: { message: 'User not found' }
            });
        }

        res.status(200).json({
            message: 'Profile retrieved successfully',
            user: {
                ...user.toObject(),
                canChangeEmail: user.canChangeEmail()
            }
        });

    } catch (error) {
        logger.error(`Get profile route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to retrieve profile' }
        });
    }
});

//NOTE - UPDATE USER PROFILE 
router.put('/', authenticate, async (req, res) => {
    try {
        const { firstName, lastName, email, mobileNumber } = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                error: { message: 'User not found' }
            });
        }

        // Check if email change is allowed
        if (email && email !== user.email && !user.canChangeEmail()) {
            return res.status(403).json({
                error: { message: 'Email cannot be changed for Google-authenticated accounts' }
            });
        }

        // Check if email is already taken
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(409).json({
                    error: { message: 'Email is already registered' }
                });
            }
        }

        // Update allowed fields
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (email && user.canChangeEmail()) user.email = email;
        if (mobileNumber) user.mobileNumber = mobileNumber;

        await user.save();

        const updatedUser = await User.findById(user._id).select('-password');

        res.status(200).json({
            message: 'Profile updated successfully',
            user: updatedUser
        });

    } catch (error) {
        logger.error(`Update profile route error: ${error.message}`);

        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({
                error: { message: 'Email is already registered' }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to update profile' }
        });
    }
});

//NOTE - UPDATE PROFILE PICTURE 
router.post('/picture', authenticate, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: { message: 'No image file provided' }
            });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                error: { message: 'User not found' }
            });
        }

        // Save the file path 
        user.profilePicture = `/uploads/profiles/${req.file.filename}`;
        await user.save();

        res.status(200).json({
            message: 'Profile picture updated successfully',
            profilePicture: user.profilePicture
        });

    } catch (error) {
        logger.error(`Update profile picture route error: ${error.message}`);

        if (error.message.includes('Only image files')) {
            return res.status(400).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to update profile picture' }
        });
    }
});

//NOTE - GET USER USAGE STATISTICS 
router.get('/usage', authenticate, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get user's daily usage
        const usage = await aiService.checkUserLimits(req.user._id, 'chat');

        // Get total conversations
        const totalConversations = await Conversation.countDocuments({
            user: req.user._id,
            isActive: true
        });

        res.status(200).json({
            message: 'Usage statistics retrieved successfully',
            usage: {
                dailyChats: usage.usageCount || 0,
                dailyChatLimit: usage.limit || 0,
                totalConversations,
                subscription: req.user.subscription
            }
        });

    } catch (error) {
        logger.error(`Get usage route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to retrieve usage statistics' }
        });
    }
});

module.exports = router;