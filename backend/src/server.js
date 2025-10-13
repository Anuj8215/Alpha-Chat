//!SECTION - SERVER ENTRY POINT


require('dotenv').config();

const http = require('http');
const socketIO = require('socket.io');
const app = require('./config/app');
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const { scheduleCleanup, runInitialCleanup } = require('./utils/scheduledTasks');
const { verifyTransporter } = require('./services/emailService');


const PORT = process.env.PORT || 3000;


const server = http.createServer(app);

//NOTE - INITIALIZE SOCKET.IO FOR REAL-TIME CHATGPT-LIKE EXPERIENCE
const io = socketIO(server, {
    cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST']
    }
});

// Connect to MongoDB
connectDB();

// Verify email transporter
verifyTransporter().catch((error) => {
    logger.error('Email transporter verification failed on startup:', error.message);
    // Don't exit process, just log the error - email features might still work
});

// Initialize scheduled tasks for temporary chat cleanup
scheduleCleanup();

// Run initial cleanup on server start
setTimeout(() => {
    runInitialCleanup();
}, 5000); // Wait 5 seconds after server start

// Socket.IO connection handler for ChatGPT clone functionality
io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    // User joins their personal room for AI conversations
    socket.on('join-user', (userId) => {
        socket.join(`user-${userId}`);
        socket.userId = userId;
        logger.info(`User ${userId} joined for AI conversations`);
    });

    // Handle AI chat message (GPT interaction)
    socket.on('send-ai-message', async (data) => {
        try {
            const { userId, message, conversationId } = data;

            // Emit typing indicator while AI is processing
            socket.emit('ai-typing', {
                conversationId,
                isTyping: true
            });

            logger.info(`AI message received from user ${userId}: ${message}`);

            // Here we'll integrate GPT API later acknowledge the message was received
            socket.emit('message-received', {
                messageId: data.messageId,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`AI message error: ${error.message}`);
            socket.emit('ai-error', {
                error: 'Failed to process AI message',
                conversationId: data.conversationId
            });
        }
    });

    // Handle temporary chat message (real-time temporary chat like ChatGPT)
    socket.on('send-temp-message', async (data) => {
        try {
            const { sessionId, message } = data;

            if (!sessionId || !message) {
                socket.emit('temp-error', { error: 'Session ID and message are required' });
                return;
            }

            // Join session room for real-time updates
            socket.join(`temp-${sessionId}`);

            // Emit typing indicator while AI is processing
            io.to(`temp-${sessionId}`).emit('temp-ai-typing', {
                sessionId,
                isTyping: true
            });

            logger.info(`Temporary chat message received for session ${sessionId}: ${message.substring(0, 50)}...`);

            // Import temporary chat service dynamically to avoid circular dependency
            const temporaryChatService = require('./services/temporaryChat');

            // Process the message
            const result = await temporaryChatService.sendTemporaryMessage(sessionId, message);

            // Stop typing indicator
            io.to(`temp-${sessionId}`).emit('temp-ai-typing', {
                sessionId,
                isTyping: false
            });

            // Emit the AI response in real-time
            io.to(`temp-${sessionId}`).emit('temp-message-response', {
                sessionId: result.sessionId,
                userMessage: message,
                aiResponse: result.lastMessage.content,
                timestamp: new Date().toISOString(),
                metadata: {
                    model: result.lastMessage.model,
                    tokens: result.lastMessage.tokens,
                    processingTime: result.lastMessage.processingTime
                }
            });

        } catch (error) {
            logger.error(`Temporary chat error: ${error.message}`);

            // Stop typing indicator on error
            if (data.sessionId) {
                io.to(`temp-${data.sessionId}`).emit('temp-ai-typing', {
                    sessionId: data.sessionId,
                    isTyping: false
                });
            }

            socket.emit('temp-error', {
                error: error.message.includes('not found') || error.message.includes('expired')
                    ? 'Chat session not found or expired'
                    : 'Failed to process message',
                sessionId: data.sessionId
            });
        }
    });

    // Handle joining temporary chat session
    socket.on('join-temp-session', (sessionId) => {
        socket.join(`temp-${sessionId}`);
        logger.info(`Socket ${socket.id} joined temporary session ${sessionId}`);

        socket.emit('temp-session-joined', {
            sessionId,
            timestamp: new Date().toISOString()
        });
    });

    // Handle leaving temporary chat session
    socket.on('leave-temp-session', (sessionId) => {
        socket.leave(`temp-${sessionId}`);
        logger.info(`Socket ${socket.id} left temporary session ${sessionId}`);

        socket.emit('temp-session-left', {
            sessionId,
            timestamp: new Date().toISOString()
        });
    });

    // Handle temporary chat typing indicator
    socket.on('temp-user-typing', (data) => {
        const { sessionId, isTyping } = data;
        socket.to(`temp-${sessionId}`).emit('temp-user-typing', {
            sessionId,
            isTyping,
            timestamp: new Date().toISOString()
        });
    });

    // Handle AI image/video generation request (Gemini integration)
    socket.on('generate-media', async (data) => {
        try {
            const { userId, prompt, mediaType, conversationId } = data;

            // Emit generation status
            socket.emit('media-generation-status', {
                conversationId,
                status: 'processing',
                message: `Generating ${mediaType}...`
            });

            logger.info(`Media generation request from user ${userId}: ${mediaType} - ${prompt}`);

            // Here integrate Gemini API later

        } catch (error) {
            logger.error(`Media generation error: ${error.message}`);
            socket.emit('media-generation-error', {
                error: 'Failed to generate media',
                conversationId: data.conversationId
            });
        }
    });

    // Handle conversation management
    socket.on('join-conversation', (conversationId) => {
        socket.join(`conversation-${conversationId}`);
        logger.info(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId) => {
        socket.leave(`conversation-${conversationId}`);
        logger.info(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Handle user typing in AI chat
    socket.on('typing', (data) => {
        const { conversationId, isTyping } = data;
        socket.to(`conversation-${conversationId}`).emit('user-typing', {
            userId: socket.userId,
            conversationId,
            isTyping
        });
    });

    // Handle conversation history request
    socket.on('load-conversation', (data) => {
        const { conversationId, page = 1 } = data;
        logger.info(`Loading conversation ${conversationId} for user ${socket.userId}`);

        // Here we'll load conversation history from database
        socket.emit('conversation-loaded', {
            conversationId,
            page,
            hasMore: false // Will be determined by actual data
        });
    });

    // Handle connection errors
    socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}: ${error.message}`);
    });

    socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);

        // Clean up any ongoing AI processes if needed
        if (socket.userId) {
            logger.info(`User ${socket.userId} disconnected from AI chat`);
        }
    });
});

// Make io available to routes for real-time updates
app.set('io', io);

// Start server
server.listen(PORT, () => {
    logger.info(`Alpha-Chat ChatGPT Clone server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info('Ready for GPT chat responses and Gemini media generation');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    logger.error(err.stack);
    // Close server & exit process
    server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`);
    logger.error(err.stack);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});