//!SECTION - CHAT SERVICE FOR HANDLING CHAT OPERATIONS

const Chat = require('../models/chat');
const Message = require('../models/message');
const User = require('../models/users');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

//NOTE - CREATE A NEW CHAT (PRIVATE OR GROUP)
const createChat = async (chatData) => {
    try {
        const { participants, title, isGroup, chatType, creatorId } = chatData;

        // Validate participants
        if (!participants || participants.length < 2) {
            throw new Error('At least 2 participants required for a chat');
        }

        // For private chats, check if chat already exists
        if (!isGroup && chatType === 'private') {
            const existingChat = await Chat.findOne({
                participants: { $all: participants, $size: 2 },
                isGroup: false
            });

            if (existingChat) {
                return existingChat;
            }
        }

        const newChat = new Chat({
            title: title || (isGroup ? 'Group Chat' : 'Private Chat'),
            participants,
            isGroup: isGroup || false,
            chatType: chatType || 'private',
            groupAdmin: isGroup ? creatorId : null
        });

        await newChat.save();

        // Add chat to users' activeChats
        await User.updateMany(
            { _id: { $in: participants } },
            { $addToSet: { activeChats: newChat._id } }
        );

        // Populate participants for return
        const populatedChat = await Chat.findById(newChat._id)
            .populate('participants', 'firstName lastName email profilePicture')
            .populate('lastMessage');

        return populatedChat;
    } catch (error) {
        logger.error(`Create chat error: ${error.message}`);
        throw error;
    }
};

//NOTE - FETCH USER'S CHATS
const getUserChats = async (userId) => {
    try {
        const chats = await Chat.find({
            participants: userId,
            'settings.isArchived': false
        })
            .populate('participants', 'firstName lastName email profilePicture preferences.onlineStatus')
            .populate('lastMessage')
            .sort({ lastActivity: -1 });

        return chats;
    } catch (error) {
        logger.error(`Get user chats error: ${error.message}`);
        throw error;
    }
};

//NOTE - SEND A MESSAGE IN A CHAT
const sendMessage = async (messageData) => {
    try {
        const { chatId, senderId, content, messageType, replyTo } = messageData;

        // Verify chat exists and user is participant
        const chat = await Chat.findById(chatId);
        if (!chat) {
            throw new Error('Chat not found');
        }

        if (!chat.participants.includes(senderId)) {
            throw new Error('User is not a participant in this chat');
        }

        const newMessage = new Message({
            chat: chatId,
            sender: senderId,
            content,
            messageType: messageType || 'text',
            replyTo: replyTo || null
        });

        await newMessage.save();

        // Update chat's last message and activity
        chat.lastMessage = newMessage._id;
        chat.lastActivity = new Date();
        await chat.save();

        // Populate the message for return
        const populatedMessage = await Message.findById(newMessage._id)
            .populate('sender', 'firstName lastName profilePicture')
            .populate('replyTo');

        return populatedMessage;
    } catch (error) {
        logger.error(`Send message error: ${error.message}`);
        throw error;
    }
};

//NOTE - FETCH CHAT MESSAGES WITH PAGINATION
const getChatMessages = async (chatId, userId, page = 1, limit = 50) => {
    try {
        // Verify user is participant in chat
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(userId)) {
            throw new Error('Access denied or chat not found');
        }

        const skip = (page - 1) * limit;

        const messages = await Message.find({ chat: chatId })
            .populate('sender', 'firstName lastName profilePicture')
            .populate('replyTo')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return messages.reverse(); // Return in chronological order
    } catch (error) {
        logger.error(`Get chat messages error: ${error.message}`);
        throw error;
    }
};

//NOTE - MARK MESSAGES AS READ
const markMessagesAsRead = async (chatId, userId) => {
    try {
        await Message.updateMany(
            {
                chat: chatId,
                sender: { $ne: userId },
                'readBy.user': { $ne: userId }
            },
            {
                $addToSet: {
                    readBy: {
                        user: userId,
                        readAt: new Date()
                    }
                }
            }
        );

        return { success: true };
    } catch (error) {
        logger.error(`Mark messages as read error: ${error.message}`);
        throw error;
    }
};

//NOTE - DELETE A MESSAGE (ONLY BY SENDER)
const deleteMessage = async (messageId, userId) => {
    try {
        const message = await Message.findById(messageId);

        if (!message) {
            throw new Error('Message not found');
        }

        if (message.sender.toString() !== userId) {
            throw new Error('You can only delete your own messages');
        }

        await Message.findByIdAndDelete(messageId);

        return { success: true };
    } catch (error) {
        logger.error(`Delete message error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    createChat,
    getUserChats,
    sendMessage,
    getChatMessages,
    markMessagesAsRead,
    deleteMessage
};