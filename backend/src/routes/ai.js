//!SECTION - AI ROUTES FOR ALPHA-CHAT

const express = require('express');
const aiService = require('../services/ai');
const { authenticate } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

//NOTE - CREATE NEW CONVERSATION

router.post('/conversation/new', authenticate, async (req, res) => {
    try {
        const { aiMode, title } = req.body;

        if (!aiMode || !['chat', 'code', 'image', 'video'].includes(aiMode)) {
            return res.status(400).json({
                error: { message: 'Valid AI mode is required (chat, code, image, video)' }
            });
        }

        const conversation = await aiService.createConversation(
            req.user._id,
            aiMode,
            title
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

//NOTE - GET USER'S CONVERSATIONS WITH FILTERS (GET /api/ai/conversations, PRIVATE)
router.get('/conversations', authenticate, async (req, res) => {
    try {
        const { aiMode, page = 1, limit = 20, search } = req.query;

        const conversations = await aiService.getUserConversations(
            req.user._id,
            { aiMode, page: parseInt(page), limit: parseInt(limit), search }
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

//NOTE - SEND CHAT MESSAGE
router.post('/chat', authenticate, async (req, res) => {
    try {
        const { conversationId, message, model = 'gpt-3.5-turbo' } = req.body;

        if (!conversationId || !message) {
            return res.status(400).json({
                error: { message: 'Conversation ID and message are required' }
            });
        }

        const io = req.app.get('io');

        // Emit typing indicator
        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: true,
            mode: 'chat'
        });

        const result = await aiService.getChatResponse(
            req.user._id,
            conversationId,
            message,
            model
        );

        // Stop typing indicator
        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: false
        });

        // Emit the response
        io.to(`user-${req.user._id}`).emit('ai-response', {
            type: 'chat',
            data: result
        });

        res.status(200).json({
            message: 'Chat response generated successfully',
            data: result
        });

    } catch (error) {
        logger.error(`Chat route error: ${error.message}`);

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
            error: { message: 'Failed to get chat response' }
        });
    }
});

//NOTE - SEND CODE MESSAGE 
router.post('/code', authenticate, async (req, res) => {
    try {
        const { conversationId, message, codeLanguage = 'javascript' } = req.body;

        if (!conversationId || !message) {
            return res.status(400).json({
                error: { message: 'Conversation ID and message are required' }
            });
        }

        const io = req.app.get('io');

        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: true,
            mode: 'code'
        });

        const result = await aiService.getCodeResponse(
            req.user._id,
            conversationId,
            message,
            codeLanguage
        );

        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: false
        });

        io.to(`user-${req.user._id}`).emit('ai-response', {
            type: 'code',
            data: result
        });

        res.status(200).json({
            message: 'Code response generated successfully',
            data: result
        });

    } catch (error) {
        logger.error(`Code route error: ${error.message}`);

        if (error.message.includes('limit reached')) {
            return res.status(429).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to get code response' }
        });
    }
});

//NOTE - GENERATE IMAGE 
router.post('/generate-image', authenticate, async (req, res) => {
    try {
        const { conversationId, prompt, model = 'dall-e-3' } = req.body;

        if (!conversationId || !prompt) {
            return res.status(400).json({
                error: { message: 'Conversation ID and prompt are required' }
            });
        }

        const io = req.app.get('io');

        io.to(`user-${req.user._id}`).emit('media-generation-status', {
            conversationId,
            status: 'processing',
            message: 'Generating image...',
            type: 'image'
        });

        const result = await aiService.generateImage(
            req.user._id,
            conversationId,
            prompt,
            model
        );

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

        const io = req.app.get('io');
        io.to(`user-${req.user._id}`).emit('media-generation-error', {
            conversationId: req.body.conversationId,
            error: 'Failed to generate image',
            type: 'image'
        });

        if (error.message.includes('limit reached')) {
            return res.status(429).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to generate image' }
        });
    }
});

//NOTE - GENERATE VIDEO 
router.post('/generate-video', authenticate, async (req, res) => {
    try {
        const { conversationId, prompt } = req.body;

        if (!conversationId || !prompt) {
            return res.status(400).json({
                error: { message: 'Conversation ID and prompt are required' }
            });
        }

        const result = await aiService.generateVideo(
            req.user._id,
            conversationId,
            prompt
        );

        res.status(200).json({
            message: 'Video generation initiated',
            data: result
        });

    } catch (error) {
        logger.error(`Video generation route error: ${error.message}`);

        if (error.message.includes('not yet implemented')) {
            return res.status(501).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to generate video' }
        });
    }
});

//NOTE - DELETE CONVERSATION
router.delete('/conversation/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        await aiService.deleteConversation(req.user._id, id);

        res.status(200).json({
            message: 'Conversation deleted successfully'
        });

    } catch (error) {
        logger.error(`Delete conversation route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('access denied')) {
            return res.status(404).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to delete conversation' }
        });
    }
});

//NOTE - PIN/UNPIN CONVERSATION 
router.put('/conversation/:id/pin', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await aiService.togglePinConversation(req.user._id, id);

        res.status(200).json({
            message: `Conversation ${result.isPinned ? 'pinned' : 'unpinned'} successfully`,
            isPinned: result.isPinned
        });

    } catch (error) {
        logger.error(`Pin conversation route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('access denied')) {
            return res.status(404).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to pin conversation' }
        });
    }
});

module.exports = router;