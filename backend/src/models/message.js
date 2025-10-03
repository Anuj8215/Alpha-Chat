//!SECTION - MESSAGE MODEL FOR MONGODB

const { text } = require('express');
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    context: {
        text: String,
        mediaUrl: String,
        mediaType: {
            type: String,
            enum: ['image', 'video', 'audio', 'document', 'ai-generated'],
        }
    },
    aiMetadata: {
        model: String, // 'gpt-4', 'gemini-pro', etc.
        prompt: String,
        generationType: {
            type: String,
            enum: ['text', 'image', 'video']
        },
        processingTime: Number
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed'],
        default: 'sent'
    },
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: Date,
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }
}, {
    timestamps: true
});

// Indexes for performance
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ 'readBy.user': 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;