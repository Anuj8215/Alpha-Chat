//!SECTION - TEMPORARY CHAT SERVICE FOR HANDLING TEMPORARY AI CONVERSATIONS

const TemporaryChat = require('../models/temporaryChat');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const logger = require('../utils/logger');

// Initialize AI services
let openaiChat = null;
if (process.env.OPENAI_API_KEY) {
    openaiChat = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

//NOTE - CREATE NEW TEMPORARY CHAT SESSION
const createTemporarySession = async (options = {}) => {
    try {
        const session = await TemporaryChat.createTemporarySession({
            userId: options.userId || null,
            title: options.title || 'Temporary Chat',
            aiModel: options.aiModel || 'gpt-3.5-turbo',
            temperature: options.temperature || 0.7,
            maxTokens: options.maxTokens || 1000,
            systemPrompt: options.systemPrompt || 'You are a helpful AI assistant.',
            ipAddress: options.ipAddress,
            userAgent: options.userAgent
        });

        logger.info(`Created temporary chat session: ${session.sessionId}`);
        return session;
    } catch (error) {
        logger.error(`Create temporary session error: ${error.message}`);
        throw error;
    }
};

//NOTE - GET TEMPORARY CHAT SESSION
const getTemporarySession = async (sessionId) => {
    try {
        const session = await TemporaryChat.findActiveSession(sessionId);

        if (!session) {
            throw new Error('Session not found or expired');
        }

        return session;
    } catch (error) {
        logger.error(`Get temporary session error: ${error.message}`);
        throw error;
    }
};

//NOTE - SEND MESSAGE IN TEMPORARY CHAT
const sendTemporaryMessage = async (sessionId, userMessage, options = {}) => {
    try {
        const session = await getTemporarySession(sessionId);

        // Add user message to session
        await session.addMessage('user', userMessage);

        // Prepare conversation history for AI
        const conversationHistory = session.messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // Add system prompt if it's the first message
        if (conversationHistory.length === 1) {
            conversationHistory.unshift({
                role: 'system',
                content: session.settings.systemPrompt
            });
        }

        // Get AI response based on selected model
        const aiResponse = await generateAIResponse(
            session.settings.aiModel,
            conversationHistory,
            {
                temperature: session.settings.temperature,
                maxTokens: session.settings.maxTokens
            }
        );

        // Add AI response to session
        await session.addMessage('assistant', aiResponse.content, {
            model: session.settings.aiModel,
            tokens: aiResponse.tokens,
            processingTime: aiResponse.processingTime
        });

        // Reload session to get updated data
        const updatedSession = await getTemporarySession(sessionId);

        return {
            sessionId: updatedSession.sessionId,
            messages: updatedSession.messages,
            metadata: updatedSession.metadata,
            lastMessage: aiResponse
        };

    } catch (error) {
        logger.error(`Send temporary message error: ${error.message}`);
        throw error;
    }
};

//NOTE - GENERATE AI RESPONSE BASED ON MODEL
const generateAIResponse = async (model, conversationHistory, settings) => {
    const startTime = Date.now();
    let response, tokens = 0;

    try {
        switch (model) {
            case 'gpt-3.5-turbo':
            case 'gpt-4':
            case 'gpt-4-turbo':
                response = await generateOpenAIResponse(model, conversationHistory, settings);
                break;

            case 'gemini-pro':
                response = await generateGeminiResponse(conversationHistory, settings);
                break;

            case 'deepseek-chat':
                response = await generateDeepSeekResponse(conversationHistory, settings);
                break;

            default:
                throw new Error(`Unsupported model: ${model}`);
        }

        const processingTime = Date.now() - startTime;

        return {
            content: response.content,
            tokens: response.tokens || tokens,
            processingTime
        };

    } catch (error) {
        logger.error(`Generate AI response error: ${error.message}`);
        throw error;
    }
};

//NOTE - OPENAI RESPONSE GENERATION
const generateOpenAIResponse = async (model, messages, settings) => {
    try {
        if (!openaiChat) {
            throw new Error('OpenAI API key not configured');
        }

        const completion = await openaiChat.chat.completions.create({
            model: model,
            messages: messages,
            temperature: settings.temperature,
            max_tokens: settings.maxTokens,
        });

        return {
            content: completion.choices[0].message.content,
            tokens: completion.usage?.total_tokens || 0
        };
    } catch (error) {
        logger.error(`OpenAI API error: ${error.message}`);
        throw new Error('Failed to generate response from OpenAI');
    }
};

//NOTE - GEMINI RESPONSE GENERATION
const generateGeminiResponse = async (messages, settings) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        // Convert conversation to Gemini format
        const conversation = messages
            .filter(msg => msg.role !== 'system')
            .map(msg => msg.content)
            .join('\n\nUser: ');

        const result = await model.generateContent(conversation);
        const response = await result.response;

        return {
            content: response.text(),
            tokens: 0 // Gemini doesn't provide token count in free tier
        };
    } catch (error) {
        logger.error(`Gemini API error: ${error.message}`);
        throw new Error('Failed to generate response from Gemini');
    }
};

//NOTE - DEEPSEEK RESPONSE GENERATION
const generateDeepSeekResponse = async (messages, settings) => {
    try {
        const response = await axios.post(
            `${DEEPSEEK_BASE_URL}/chat/completions`,
            {
                model: 'deepseek-chat',
                messages: messages,
                temperature: settings.temperature,
                max_tokens: settings.maxTokens,
                stream: false
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                }
            }
        );

        return {
            content: response.data.choices[0].message.content,
            tokens: response.data.usage?.total_tokens || 0
        };
    } catch (error) {
        logger.error(`DeepSeek API error: ${error.message}`);
        throw new Error('Failed to generate response from DeepSeek');
    }
};

//NOTE - UPDATE TEMPORARY CHAT SETTINGS
const updateTemporarySettings = async (sessionId, newSettings) => {
    try {
        const session = await getTemporarySession(sessionId);

        const allowedSettings = ['aiModel', 'temperature', 'maxTokens', 'systemPrompt'];
        const filteredSettings = {};

        for (const key of allowedSettings) {
            if (newSettings[key] !== undefined) {
                filteredSettings[key] = newSettings[key];
            }
        }

        await session.updateSettings(filteredSettings);

        return session;
    } catch (error) {
        logger.error(`Update temporary settings error: ${error.message}`);
        throw error;
    }
};

//NOTE - DELETE TEMPORARY CHAT SESSION
const deleteTemporarySession = async (sessionId) => {
    try {
        const result = await TemporaryChat.findOneAndDelete({ sessionId });

        if (!result) {
            throw new Error('Session not found');
        }

        logger.info(`Deleted temporary chat session: ${sessionId}`);
        return { success: true, sessionId };
    } catch (error) {
        logger.error(`Delete temporary session error: ${error.message}`);
        throw error;
    }
};

//NOTE - EXTEND SESSION EXPIRY
const extendSessionExpiry = async (sessionId, hours = 24) => {
    try {
        const session = await getTemporarySession(sessionId);
        await session.extendExpiry(hours);

        return session;
    } catch (error) {
        logger.error(`Extend session expiry error: ${error.message}`);
        throw error;
    }
};

//NOTE - GET SESSION STATISTICS
const getSessionStats = async (sessionId) => {
    try {
        const session = await getTemporarySession(sessionId);

        return {
            sessionId: session.sessionId,
            totalMessages: session.metadata.totalMessages,
            totalTokensUsed: session.metadata.totalTokensUsed,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            expiresAt: session.expiresAt,
            settings: session.settings,
            isActive: session.isActive
        };
    } catch (error) {
        logger.error(`Get session stats error: ${error.message}`);
        throw error;
    }
};

//NOTE - CLEANUP EXPIRED SESSIONS (FOR SCHEDULED TASKS)
const cleanupExpiredSessions = async () => {
    try {
        const deletedCount = await TemporaryChat.cleanupExpiredSessions();
        logger.info(`Cleaned up ${deletedCount} expired temporary chat sessions`);
        return deletedCount;
    } catch (error) {
        logger.error(`Cleanup expired sessions error: ${error.message}`);
        throw error;
    }
};

//NOTE - GET USER'S TEMPORARY SESSIONS (IF AUTHENTICATED)
const getUserTemporarySessions = async (userId) => {
    try {
        const sessions = await TemporaryChat.find({
            userId: userId,
            isActive: true,
            expiresAt: { $gt: new Date() }
        })
            .select('sessionId title lastActivity expiresAt metadata.totalMessages metadata.totalTokensUsed')
            .sort({ lastActivity: -1 });

        return sessions;
    } catch (error) {
        logger.error(`Get user temporary sessions error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    createTemporarySession,
    getTemporarySession,
    sendTemporaryMessage,
    updateTemporarySettings,
    deleteTemporarySession,
    extendSessionExpiry,
    getSessionStats,
    cleanupExpiredSessions,
    getUserTemporarySessions
};