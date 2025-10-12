//!SECTION - TEMPORARY CHAT ROUTES

const express = require('express');
const temporaryChatService = require('../services/temporaryChat');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

//NOTE - CREATE NEW TEMPORARY CHAT SESSION (POST /api/temporary-chat/create)
router.post('/create', optionalAuthenticate, async (req, res) => {
    try {
        const { title, aiModel, temperature, maxTokens, systemPrompt } = req.body;

        // Get client info
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // Get user ID if authenticated (optional)
        const userId = req.user ? req.user._id : null;

        const session = await temporaryChatService.createTemporarySession({
            userId,
            title,
            aiModel,
            temperature,
            maxTokens,
            systemPrompt,
            ipAddress,
            userAgent
        });

        res.status(201).json({
            message: 'Temporary chat session created successfully',
            session: {
                sessionId: session.sessionId,
                title: session.title,
                settings: session.settings,
                expiresAt: session.expiresAt,
                createdAt: session.createdAt
            }
        });
    } catch (error) {
        logger.error(`Create temporary session route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to create temporary chat session' }
        });
    }
});

//NOTE - SEND MESSAGE TO TEMPORARY CHAT (POST /api/temporary-chat/:sessionId/message)
router.post('/:sessionId/message', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { message } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                error: { message: 'Message is required and cannot be empty' }
            });
        }

        if (message.length > 4000) {
            return res.status(400).json({
                error: { message: 'Message too long. Maximum 4000 characters allowed' }
            });
        }

        const result = await temporaryChatService.sendTemporaryMessage(sessionId, message.trim());

        res.json({
            message: 'Message sent successfully',
            sessionId: result.sessionId,
            lastMessage: result.lastMessage,
            totalMessages: result.metadata.totalMessages,
            totalTokens: result.metadata.totalTokensUsed
        });
    } catch (error) {
        logger.error(`Send temporary message route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('expired')) {
            return res.status(404).json({
                error: { message: 'Chat session not found or expired' }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to send message' }
        });
    }
});

//NOTE - GET TEMPORARY CHAT SESSION (GET /api/temporary-chat/:sessionId)
router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await temporaryChatService.getTemporarySession(sessionId);

        res.json({
            sessionId: session.sessionId,
            title: session.title,
            messages: session.messages,
            settings: session.settings,
            metadata: session.metadata,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            expiresAt: session.expiresAt
        });
    } catch (error) {
        logger.error(`Get temporary session route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('expired')) {
            return res.status(404).json({
                error: { message: 'Chat session not found or expired' }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to retrieve chat session' }
        });
    }
});

//NOTE - UPDATE TEMPORARY CHAT SETTINGS (PUT /api/temporary-chat/:sessionId/settings)
router.put('/:sessionId/settings', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { aiModel, temperature, maxTokens, systemPrompt } = req.body;

        const session = await temporaryChatService.updateTemporarySettings(sessionId, {
            aiModel,
            temperature,
            maxTokens,
            systemPrompt
        });

        res.json({
            message: 'Settings updated successfully',
            settings: session.settings
        });
    } catch (error) {
        logger.error(`Update temporary settings route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('expired')) {
            return res.status(404).json({
                error: { message: 'Chat session not found or expired' }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to update settings' }
        });
    }
});

//NOTE - EXTEND SESSION EXPIRY (PUT /api/temporary-chat/:sessionId/extend)
router.put('/:sessionId/extend', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { hours = 24 } = req.body;

        if (hours < 1 || hours > 168) { // Max 7 days
            return res.status(400).json({
                error: { message: 'Hours must be between 1 and 168 (7 days)' }
            });
        }

        const session = await temporaryChatService.extendSessionExpiry(sessionId, hours);

        res.json({
            message: 'Session expiry extended successfully',
            expiresAt: session.expiresAt
        });
    } catch (error) {
        logger.error(`Extend session expiry route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('expired')) {
            return res.status(404).json({
                error: { message: 'Chat session not found or expired' }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to extend session expiry' }
        });
    }
});

//NOTE - DELETE TEMPORARY CHAT SESSION (DELETE /api/temporary-chat/:sessionId)
router.delete('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await temporaryChatService.deleteTemporarySession(sessionId);

        res.json({
            message: 'Session deleted successfully',
            sessionId: result.sessionId
        });
    } catch (error) {
        logger.error(`Delete temporary session route error: ${error.message}`);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: { message: 'Chat session not found' }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to delete session' }
        });
    }
});

//NOTE - GET SESSION STATISTICS (GET /api/temporary-chat/:sessionId/stats)
router.get('/:sessionId/stats', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const stats = await temporaryChatService.getSessionStats(sessionId);

        res.json({
            message: 'Session statistics retrieved successfully',
            stats
        });
    } catch (error) {
        logger.error(`Get session stats route error: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('expired')) {
            return res.status(404).json({
                error: { message: 'Chat session not found or expired' }
            });
        }

        res.status(500).json({
            error: { message: 'Failed to retrieve session statistics' }
        });
    }
});

//NOTE - GET USER'S TEMPORARY SESSIONS (GET /api/temporary-chat/user/sessions, PRIVATE)
router.get('/user/sessions', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const sessions = await temporaryChatService.getUserTemporarySessions(userId);

        res.json({
            message: 'User temporary sessions retrieved successfully',
            sessions,
            count: sessions.length
        });
    } catch (error) {
        logger.error(`Get user temporary sessions route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to retrieve user sessions' }
        });
    }
});

//NOTE - CLEANUP EXPIRED SESSIONS (POST /api/temporary-chat/admin/cleanup, ADMIN ONLY)
router.post('/admin/cleanup', authenticate, async (req, res) => {
    try {
        // Check if user is admin (assuming you have role-based access)
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                error: { message: 'Admin access required' }
            });
        }

        const deletedCount = await temporaryChatService.cleanupExpiredSessions();

        res.json({
            message: 'Cleanup completed successfully',
            deletedCount
        });
    } catch (error) {
        logger.error(`Cleanup expired sessions route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to cleanup expired sessions' }
        });
    }
});

//NOTE - GET AVAILABLE AI MODELS (GET /api/temporary-chat/models)
router.get('/models', (req, res) => {
    try {
        const models = [
            {
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                description: 'Fast and efficient for most conversations',
                provider: 'OpenAI',
                recommended: true
            },
            {
                id: 'gpt-4',
                name: 'GPT-4',
                description: 'More capable but slower, best for complex tasks',
                provider: 'OpenAI',
                recommended: false
            },
            {
                id: 'gpt-4-turbo',
                name: 'GPT-4 Turbo',
                description: 'Latest GPT-4 with improved speed and capabilities',
                provider: 'OpenAI',
                recommended: false
            },
            {
                id: 'gemini-pro',
                name: 'Gemini Pro',
                description: 'Google\'s advanced AI model',
                provider: 'Google',
                recommended: false
            },
            {
                id: 'deepseek-chat',
                name: 'DeepSeek Chat',
                description: 'Specialized for coding and technical discussions',
                provider: 'DeepSeek',
                recommended: false
            }
        ];

        res.json({
            message: 'Available AI models retrieved successfully',
            models
        });
    } catch (error) {
        logger.error(`Get models route error: ${error.message}`);
        res.status(500).json({
            error: { message: 'Failed to retrieve AI models' }
        });
    }
});

module.exports = router;