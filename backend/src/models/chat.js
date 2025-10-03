//!SECTION - CHAT MODEL FOR MONGODB

const mongoose = require('mongoose');


const chatSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Chat title is required'],
        trim: true,
        maxLength: [100, 'Title cannot exceed 100 characters']
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    isGroup: {
        type: Boolean,
        default: false
    },
    groupAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    chatType: {
        type: String,
        enum: ['private', 'group', 'ai'],
        default: 'private'
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    settings: {
        isArchived: { type: Boolean, default: false },
        isMuted: { type: Boolean, default: false },
        isPinned: { type: Boolean, default: false }
    }
}, {
    timestamps: true
});

//NOTE - INDEXES FOR OPTIMIZED QUERIES

chatSchema.index({ participants: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ 'participants': 1, lastActivity: -1 });

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;