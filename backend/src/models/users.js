//!SECTION - USER MODEL FOR ALPHA-CHAT

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: [true, 'First name is required'], trim: true },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    mobileNumber: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s-()]+$/, 'Please use a valid mobile number']
    },
    password: {
        type: String,
        minlength: [8, 'Password must be at least 8 characters']
    },
    profilePicture: { type: String, default: '' },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    googleId: String, isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    subscription: {
        type: { type: String, enum: ['free', 'premium', 'pro'], default: 'free' },
        expiresAt: Date,
        features: {
            dailyChatLimit: { type: Number, default: 50 },
            dailyImageLimit: { type: Number, default: 5 },
            dailyVideoLimit: { type: Number, default: 2 },
            fileUploadLimit: { type: Number, default: 10 }, // MB
            canAccessGPT4: { type: Boolean, default: false },
            canAccessAdvancedFeatures: { type: Boolean, default: false }
        }
    },
    preferences: {
        theme: { type: String, enum: ['light', 'dark'], default: 'light' },
        language: { type: String, default: 'en' },
        notifications: { type: Boolean, default: true }
    },
    lastLogin: Date, isActive: { type: Boolean, default: true },
    passwordResetToken: String,
    passwordResetExpires: Date
}, {
    timestamps: true
});

userSchema.pre('save', async function (next) {
    if (!this.password || !this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error(error);
    }
};


userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

userSchema.methods.canChangeEmail = function () {
    return this.authProvider !== 'google';
};

const User = mongoose.model('User', userSchema);
module.exports = User;
