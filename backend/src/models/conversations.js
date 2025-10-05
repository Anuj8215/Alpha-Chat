//!SECTION - CONVERSATION MODEL FOR CHATGPT CLONE

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    messages: [{
        role: {
            type: String,
            enum: ['user', 'assistant', 'system'],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        messageType: {
            type: String,
            enum: ['text', 'image', 'video'],
            default: 'text'
        },
        aiModel: {
            type: String,
            enum: ['gpt-4', 'gpt-3.5-turbo', 'gemini-pro'],
            default: 'gpt-3.5-turbo'
        },
        metadata: {
            tokenCount: Number,
            processingTime: Number,
            mediaUrl: String,
            prompt: String
        }
    }],
    settings: {
        model: {
            type: String,
            enum: ['gpt-4', 'gpt-3.5-turbo', 'gemini-pro'],
            default: 'gpt-3.5-turbo'
        },
        temperature: {
            type: Number,
            min: 0,
            max: 2,
            default: 0.7
        },
        maxTokens: {
            type: Number,
            default: 2000
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
conversationSchema.index({ user: 1, lastActivity: -1 });
conversationSchema.index({ user: 1, isActive: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;