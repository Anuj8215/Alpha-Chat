//!SECTION - CONVERSATION MODEL CHAT

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
    aiMode: {
        type: String,
        enum: ['chat', 'code', 'image', 'video'],
        default: 'chat'
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
            enum: ['text', 'code', 'image', 'video', 'file'],
            default: 'text'
        },
        aiModel: {
            type: String,
            enum: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gemini-pro', 'gemini-pro-vision'],
            default: 'gpt-3.5-turbo'
        },
        attachments: [{
            fileName: String,
            fileUrl: String,
            fileType: String,
            fileSize: Number
        }],
        metadata: {
            tokenCount: Number,
            processingTime: Number,
            mediaUrl: String,
            prompt: String,
            codeLanguage: String
        }
    }],
    settings: {
        model: {
            type: String,
            enum: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gemini-pro'],
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
    isPinned: {
        type: Boolean,
        default: false
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
conversationSchema.index({ user: 1, aiMode: 1 });

// Method to generate title from first message
conversationSchema.methods.generateTitle = function () {
    if (this.messages.length > 0) {
        const firstUserMessage = this.messages.find(msg => msg.role === 'user');
        if (firstUserMessage) {
            return firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
        }
    }
    return `${this.aiMode.charAt(0).toUpperCase() + this.aiMode.slice(1)} Chat`;
};

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;