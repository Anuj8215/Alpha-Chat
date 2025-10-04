//!SECTION - USER MODEL FOR MONGODB

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: [true, 'First name is required'], trim: true },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true },
    email: { type: String, required: [true, 'Email is required'], unique: true, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'] },
    password: { type: String, minlength: [8, 'Password must be at least 8 characters'] },
    profilePicture: { type: String, default: '' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: String,
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    lastLogin: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    activeChats: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat'
    }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    preferences: {
        theme: { type: String, enum: ['light', 'dark'], default: 'light' },
        notifications: { type: Boolean, default: true },
        onlineStatus: { type: String, enum: ['online', 'offline', 'away'], default: 'offline' },
        lastSeen: { type: Date, default: Date.now }
    },
    subscription: {
        type: { type: String, enum: ['free', 'premium'], default: 'free' },
        expiresAt: Date,
        features: {
            aiMessageLimit: { type: Number, default: 10 }, // per day for free users
            mediaUploadLimit: { type: Number, default: 5 }, // MB for free users
            groupChatLimit: { type: Number, default: 3 } // for free users
        }
    }
}, {
    timestamps: true
});

//NOTE - PRE-SAVE HOOK TO UPDATE TIMESTAMPS

userSchema.pre('save', async function (next) {
    // Only hash password if it exists and has been modified
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

const User = mongoose.model('User', userSchema);

module.exports = User;