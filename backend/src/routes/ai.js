//!SECTION - ENHANCED AI ROUTES

const express = require('express');
const aiService = require('../services/ai');
const { authenticate } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

//NOTE - CREATE NEW CONVERSATION (POST /api/ai/conversation/new, PRIVATE)
router.post('/conversation/new', authenticate, async (req, res) => {
    try {
        const { aiMode, title } = req.body;

        const validModes = ['chat', 'code', 'image', 'video', 'research', 'document'];
        if (!aiMode || !validModes.includes(aiMode)) {
            return res.status(400).json({
                error: { message: `Valid AI mode is required. Options: ${validModes.join(', ')}` }
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

//NOTE - CHAT MODE (POST /api/ai/chat, PRIVATE)
router.post('/chat', authenticate, async (req, res) => {
    try {
        const { conversationId, message, model = 'gpt-3.5-turbo' } = req.body;

        if (!conversationId || !message) {
            return res.status(400).json({
                error: { message: 'Conversation ID and message are required' }
            });
        }

        const io = req.app.get('io');

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

        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: false
        });

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

        if (error.message.includes('limit reached')) {
            return res.status(429).json({ error: { message: error.message } });
        }

        res.status(500).json({ error: { message: 'Failed to get chat response' } });
    }
});

//NOTE - CODE MODE (POST /api/ai/code, PRIVATE)
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
            return res.status(429).json({ error: { message: error.message } });
        }

        res.status(500).json({ error: { message: 'Failed to get code response' } });
    }
});

//NOTE - RESEARCH MODE (POST /api/ai/research, PRIVATE)
router.post('/research', authenticate, async (req, res) => {
    try {
        const { conversationId, query } = req.body;

        if (!conversationId || !query) {
            return res.status(400).json({
                error: { message: 'Conversation ID and research query are required' }
            });
        }

        const io = req.app.get('io');

        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: true,
            mode: 'research'
        });

        const result = await aiService.getResearchResponse(
            req.user._id,
            conversationId,
            query
        );

        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: false
        });

        io.to(`user-${req.user._id}`).emit('ai-response', {
            type: 'research',
            data: result
        });

        res.status(200).json({
            message: 'Research response generated successfully',
            data: result
        });

    } catch (error) {
        logger.error(`Research route error: ${error.message}`);

        if (error.message.includes('limit reached')) {
            return res.status(429).json({ error: { message: error.message } });
        }

        res.status(500).json({ error: { message: 'Failed to get research response' } });
    }
});

//NOTE - DOCUMENT MODE (POST /api/ai/document, PRIVATE)
router.post('/document', authenticate, async (req, res) => {
    try {
        const { conversationId, prompt, documentType = 'general' } = req.body;

        if (!conversationId || !prompt) {
            return res.status(400).json({
                error: { message: 'Conversation ID and document prompt are required' }
            });
        }

        const io = req.app.get('io');

        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: true,
            mode: 'document'
        });

        const result = await aiService.getDocumentResponse(
            req.user._id,
            conversationId,
            prompt,
            documentType
        );

        io.to(`user-${req.user._id}`).emit('ai-typing', {
            conversationId,
            isTyping: false
        });

        io.to(`user-${req.user._id}`).emit('ai-response', {
            type: 'document',
            data: result
        });

        res.status(200).json({
            message: 'Document response generated successfully',
            data: result
        });

    } catch (error) {
        logger.error(`Document route error: ${error.message}`);

        if (error.message.includes('limit reached')) {
            return res.status(429).json({ error: { message: error.message } });
        }

        res.status(500).json({ error: { message: 'Failed to generate document response' } });
    }
});

//NOTE - IMAGE GENERATION (POST /api/ai/generate-image, PRIVATE)
router.post('/generate-image', authenticate, async (req, res) => {
    try {
        const { conversationId, prompt } = req.body;

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
            prompt
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
            return res.status(429).json({ error: { message: error.message } });
        }

        res.status(500).json({ error: { message: 'Failed to generate image' } });
    }
});

//NOTE - GET IMAGE LIBRARY (GET /api/ai/library, PRIVATE)
router.get('/library', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const images = await aiService.getUserImageLibrary(
            req.user._id,
            parseInt(page),
            parseInt(limit)
        );

        res.status(200).json({
            message: 'Image library retrieved successfully',
            images,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        logger.error(`Get image library route error: ${error.message}`);
        res.status(500).json({ error: { message: 'Failed to retrieve image library' } });
    }
});

//NOTE - DELETE IMAGE FROM LIBRARY (DELETE /api/ai/library/:id, PRIVATE)
router.delete('/library/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                error: { message: 'Image ID is required' }
            });
        }

        const result = await aiService.deleteImageFromLibrary(req.user._id, id);

        res.status(200).json({
            message: 'Image deleted from library successfully',
            data: result
        });

    } catch (error) {
        logger.error(`Delete image from library route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('access denied')) {
            return res.status(404).json({
                error: { message: error.message }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to delete image from library' }
        });
    }
});

module.exports = router;