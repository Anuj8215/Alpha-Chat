//!SECTION - CHAT ROUTES

const express = require('express');
const chatService = require('../services/chat');
const { authenticate } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

//NOTE - CREATE A NEW CHAT (POST /api/chat/create, PRIVATE)
router.post('/create', authenticate, async (req, res) => {
    try {
        const { participants, title, isGroup, chatType } = req.body;

        if (!participants || participants.length < 1) {
            return res.status(400).json({
                error: { message: 'Participants are required' }
            });
        }

        // Add current user to participants if not included
        const allParticipants = participants.includes(req.user._id)
            ? participants
            : [...participants, req.user._id];

        const chat = await chatService.createChat({
            participants: allParticipants,
            title,
            isGroup,
            chatType,
            creatorId: req.user._id
        });

        res.status(201).json({
            message: 'Chat created successfully',
            chat
        });
    } catch (error) {
        logger.error(`Create chat route error: ${error.message}`);

        if (error.message.includes('At least 2 participants')) {
            return res.status(400).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to create chat' }
        });
    }
});

//NOTE - GET USER'S CHATS (GET /api/chat/list, PRIVATE)
router.get('/list', authenticate, async (req, res) => {
    try {
        const chats = await chatService.getUserChats(req.user._id);

        res.status(200).json({
            message: 'Chats retrieved successfully',
            chats
        });
    } catch (error) {
        logger.error(`Get chats route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to retrieve chats' }
        });
    }
});

//NOTE - SEND A MESSAGE (POST /api/chat/:chatId/message, PRIVATE)
router.post('/:chatId/message', authenticate, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { content, messageType, replyTo } = req.body;

        if (!content || (!content.text && !content.mediaUrl)) {
            return res.status(400).json({
                error: { message: 'Message content is required' }
            });
        }

        const message = await chatService.sendMessage({
            chatId,
            senderId: req.user._id,
            content,
            messageType,
            replyTo
        });

        res.status(201).json({
            message: 'Message sent successfully',
            data: message
        });
    } catch (error) {
        logger.error(`Send message route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('not a participant')) {
            return res.status(403).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to send message' }
        });
    }
});

//NOTE - GET CHAT MESSAGES (GET /api/chat/:chatId/messages, PRIVATE)
router.get('/:chatId/messages', authenticate, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const messages = await chatService.getChatMessages(
            chatId,
            req.user._id,
            parseInt(page),
            parseInt(limit)
        );

        res.status(200).json({
            message: 'Messages retrieved successfully',
            messages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error(`Get messages route error: ${error.message}`);

        if (error.message.includes('Access denied')) {
            return res.status(403).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to retrieve messages' }
        });
    }
});

//NOTE - MARK MESSAGES AS READ (PUT /api/chat/:chatId/read, PRIVATE)
router.put('/:chatId/read', authenticate, async (req, res) => {
    try {
        const { chatId } = req.params;

        await chatService.markMessagesAsRead(chatId, req.user._id);

        res.status(200).json({
            message: 'Messages marked as read'
        });
    } catch (error) {
        logger.error(`Mark read route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to mark messages as read' }
        });
    }
});

//NOTE - DELETE A MESSAGE (DELETE /api/chat/message/:messageId, PRIVATE)
router.delete('/message/:messageId', authenticate, async (req, res) => {
    try {
        const { messageId } = req.params;

        await chatService.deleteMessage(messageId, req.user._id);

        res.status(200).json({
            message: 'Message deleted successfully'
        });
    } catch (error) {
        logger.error(`Delete message route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('only delete your own')) {
            return res.status(403).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to delete message' }
        });
    }
});

module.exports = router;