//!SECTION - TEMPORARY CHAT MODEL FOR MONGODB

const mongoose = require('mongoose');

const temporaryChatSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Allow anonymous users
    },
    title: {
        type: String,
        default: 'Temporary Chat',
        trim: true,
        maxLength: [100, 'Title cannot exceed 100 characters']
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
        metadata: {
            model: String,
            tokens: Number,
            processingTime: Number
        }
    }],
    settings: {
        aiModel: {
            type: String,
            enum: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gemini-pro', 'deepseek-chat'],
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
            min: 1,
            max: 4096,
            default: 1000
        },
        systemPrompt: {
            type: String,
            default: 'You are a helpful AI assistant.'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: function () {
            // Default expiry: 24 hours from creation
            return new Date(Date.now() + 24 * 60 * 60 * 1000);
        },
        index: { expireAfterSeconds: 0 }
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        totalTokensUsed: {
            type: Number,
            default: 0
        },
        totalMessages: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Indexes for performance and cleanup
temporaryChatSchema.index({ sessionId: 1 });
temporaryChatSchema.index({ userId: 1 });
temporaryChatSchema.index({ lastActivity: -1 });
temporaryChatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Middleware to update lastActivity on save
temporaryChatSchema.pre('save', function (next) {
    this.lastActivity = new Date();
    next();
});

// Methods
temporaryChatSchema.methods.addMessage = function (role, content, metadata = {}) {
    this.messages.push({
        role,
        content,
        metadata,
        timestamp: new Date()
    });
    this.metadata.totalMessages = this.messages.length;
    this.lastActivity = new Date();

    if (metadata.tokens) {
        this.metadata.totalTokensUsed += metadata.tokens;
    }

    return this.save();
};

temporaryChatSchema.methods.updateSettings = function (newSettings) {
    this.settings = { ...this.settings.toObject(), ...newSettings };
    return this.save();
};

temporaryChatSchema.methods.extendExpiry = function (hours = 24) {
    this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    return this.save();
};

// Static methods
temporaryChatSchema.statics.createTemporarySession = async function (options = {}) {
    const sessionId = generateSessionId();

    const temporaryChat = new this({
        sessionId,
        userId: options.userId || null,
        title: options.title || 'Temporary Chat',
        settings: {
            aiModel: options.aiModel || 'gpt-3.5-turbo',
            temperature: options.temperature || 0.7,
            maxTokens: options.maxTokens || 1000,
            systemPrompt: options.systemPrompt || 'You are a helpful AI assistant.'
        },
        metadata: {
            ipAddress: options.ipAddress,
            userAgent: options.userAgent
        }
    });

    await temporaryChat.save();
    return temporaryChat;
};

temporaryChatSchema.statics.findActiveSession = function (sessionId) {
    return this.findOne({
        sessionId,
        isActive: true,
        expiresAt: { $gt: new Date() }
    });
};

temporaryChatSchema.statics.cleanupExpiredSessions = async function () {
    const result = await this.deleteMany({
        $or: [
            { expiresAt: { $lte: new Date() } },
            { isActive: false }
        ]
    });
    return result.deletedCount;
};

// Helper function to generate unique session ID
function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `temp_${timestamp}_${randomStr}`;
}

const TemporaryChat = mongoose.model('TemporaryChat', temporaryChatSchema);

module.exports = TemporaryChat;