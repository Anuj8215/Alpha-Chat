//!SECTION - IMAGE LIBRARY MODEL

const mongoose = require('mongoose');

const imageLibrarySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    originalPrompt: {
        type: String,
        required: true,
        maxlength: 1000
    },
    filename: {
        type: String,
        required: true
    },
    aiModel: {
        type: String,
        enum: ['dall-e-3', 'dall-e-2', 'gemini-pro-vision'],
        default: 'dall-e-3'
    },
    metadata: {
        size: String,
        quality: String,
        processingTime: Number,
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
}, {
    timestamps: true
});

// Index for automatic deletion after 30 days
imageLibrarySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for user queries
imageLibrarySchema.index({ user: 1, isActive: 1, createdAt: -1 });

const ImageLibrary = mongoose.model('ImageLibrary', imageLibrarySchema);

module.exports = ImageLibrary;