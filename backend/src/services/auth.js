//!SECTION - AUTHENTICATION SERVICE

const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/users');
const logger = require('../utils/logger');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

//NOTE - REGISTERING NEW USER WITH EMAIL AND PASSWORD

const registerUser = async (userData) => {
    try {
        const { firstName, lastName, email, password } = userData;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new Error('User already exists');
        }
        const newUser = new User({
            firstName,
            lastName,
            email,
            password,
            authProvider: 'local',
            isVerified: false
        });
        await newUser.save();
        const user = newUser.toObject();
        delete user.password; // Remove password before returning user object
        return user;
    } catch (error) {
        logger.error(`Error registering user: ${error.message}`);
        throw error;
    }
};

//NOTE - LOGIN USER WITH EMAIL AND PASSWORD
const loginUser = async (loginData) => {
    try {
        const { email, password } = loginData;

        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('Invalid email or password');
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            throw new Error('Invalid email or password');
        }
        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user);
        const userData = user.toObject();
        delete userData.password;
        return { user: userData, token };

    } catch (error) {
        logger.error(`Error logging in user: ${error.message}`);
        throw error;
    }
};

//NOTE - GOOGLE OAUTH LOGIN OR REGISTER

const googleAuth = async (idToken) => {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, given_name: firstName, family_name: lastName, picture: profilePicture } = payload;

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({
                googleId,
                email,
                firstName,
                lastName,
                profilePicture,
                authProvider: 'google',
                isVerified: true
            });
            await user.save();
        } else if (!user.googleId) {
            user.googleId = googleId;
            user.authProvider = 'google';
            user.isVerified = true;
            if (!user.profilePicture && profilePicture) {
                user.profilePicture = profilePicture;
            }
            await user.save();
        }
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = generateToken(user);

        // Return user data and token
        const userData = user.toObject();
        delete userData.password;

        return {
            user: userData,
            token
        };
    } catch (error) {
        logger.error(`Google auth error: ${error.message}`);
        throw new Error('Google authentication failed');
    }
};

//NOTE - GENERATING JWT TOKEN FOR AUTHENTICATED USER
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

//NOTE - VERIFYING JWT TOKEN
const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    } catch (error) {
        logger.error(`Token verification error: ${error.message}`);
        throw new Error('Invalid token');
    }
};

module.exports = {
    registerUser,
    loginUser,
    googleAuth,
    verifyToken
};