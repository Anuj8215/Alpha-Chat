//!SECTION - AI ROUTES FOR CHATGPT CLONE

const express = require('express');
const aiService = require('../services/ai');
const { authenticate } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

//NOTE - CREATE NEW CONVERSATION (POST /api/ai/conversation/new, PRIVATE)

router.post('/conversation/new', authenticate, async (req, res) => {
    try {
        const { title } = req.body;

        const conversation = await aiService.createConversation(
            req.user._id,
            title || 'New Chat'
        );

        res.status(201).json({
            message: 'Conversation created successfully',
            conversation
        });

    } catch (error) {
        logger.error(`Create conversation route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to create conversation' }
        });
    }
});

//NOTE - GET USER'S CONVERSATIONS (GET /api/ai/conversations, PRIVATE)

router.get('/conversations', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const conversations = await aiService.getUserConversations(
            req.user._id,
            parseInt(page),
            parseInt(limit)
        );

        res.status(200).json({
            message: 'Conversations retrieved successfully',
            conversations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        logger.error(`Get conversations route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to retrieve conversations' }
        });
    }
});

//NOTE - SEND MESSAGE TO AI (POST /api/ai/chat, PRIVATE)

router.post('/chat', authenticate, async (req, res) => {
    try {
        const { conversationId, message, model = 'gpt-3.5-turbo' } = req.body;

        if (!conversationId || !message) {
            return res.status(400).json({
                error: { message: 'Conversation ID and message are required' }
            });
        }

        // Get Socket.IO instance for real-time updates
        const io = req.app.get('io');

        // Emit typing indicator
        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: true
        });

        let result;

        if (model === 'gemini-pro') {
            result = await aiService.getGeminiResponse(req.user._id, conversationId, message);
        } else {
            result = await aiService.getChatResponse(req.user._id, conversationId, message, model);
        }

        // Stop typing indicator
        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: false
        });

        // Emit the AI response in real-time
        io.to(`user-${req.user._id}`).emit('ai-response', result);

        res.status(200).json({
            message: 'AI response generated successfully',
            data: result
        });

    } catch (error) {
        logger.error(`AI chat route error: ${error.message}`);

        // Stop typing indicator on error
        const io = req.app.get('io');
        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId: req.body.conversationId,
            isTyping: false
        });

        if (error.message.includes('limit reached')) {
            return res.status(429).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to get AI response' }
        });
    }
});

//NOTE - GENERATE IMAGE (POST /api/ai/generate-image, PRIVATE)

router.post('/generate-image', authenticate, async (req, res) => {
    try {
        const { conversationId, prompt } = req.body;

        if (!conversationId || !prompt) {
            return res.status(400).json({
                error: { message: 'Conversation ID and prompt are required' }
            });
        }

        // Get Socket.IO instance for real-time updates
        const io = req.app.get('io');

        // Emit generation status
        io.to(`user-${req.user._id}`).emit('media-generation-status', {
            conversationId,
            status: 'processing',
            message: 'Generating image...'
        });

        const result = await aiService.generateImage(req.user._id, conversationId, prompt);

        // Emit completion
        io.to(`user-${req.user._id}`).emit('media-generated', {
            type: 'image',
            data: result
        });

        res.status(200).json({
            message: 'Image generated successfully',
            data: result
        });

    } catch (error) {
        logger.error(`Image generation route error: ${error.message}`);

        // Emit error status
        const io = req.app.get('io');
        io.to(`user-${req.user._id}`).emit('media-generation-error', {
            conversationId: req.body.conversationId,
            error: 'Failed to generate image'
        });

        res.status(500).json({
            error: { message: 'Failed to generate image' }
        });
    }
});

module.exports = router;