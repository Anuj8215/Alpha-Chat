//!SECTION - ENHANCED AI SERVICE FOR MULTI-API INTEGRATION

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const Conversation = require('../models/conversations');
const User = require('../models/users');
const ImageLibrary = require('../models/imageLibrary');
const logger = require('../utils/logger');

// Initialize OpenAI (for Chat)
const openaiChat = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // Your chat API key
});

// Initialize Gemini (for Image/Video)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// DeepSeek API configuration (for Code)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

// NOTE - CREATE NEW CONVERSATION

const createConversation = async (userId, aiMode = 'chat', title = null) => {
    try {
        const validModes = ['chat', 'code', 'image', 'video', 'research', 'document'];

        if (!validModes.includes(aiMode)) {
            throw new Error(`Invalid AI mode. Must be one of: ${validModes.join(', ')}`);
        }

        const conversation = new Conversation({
            user: userId,
            title: title || `New ${aiMode.charAt(0).toUpperCase() + aiMode.slice(1)} Session`,
            aiMode: aiMode,
            messages: [],
            settings: {
                model: getDefaultModelForMode(aiMode),
                temperature: getDefaultTemperatureForMode(aiMode),
                maxTokens: getDefaultMaxTokensForMode(aiMode)
            }
        });

        await conversation.save();
        return conversation;

    } catch (error) {
        logger.error(`Create conversation error: ${error.message}`);
        throw error;
    }
};

// NOTE - CHAT MODE USING OPENAI API

const getChatResponse = async (userId, conversationId, message, model = 'gpt-3.5-turbo') => {
    try {
        const startTime = Date.now();

        await checkUserLimits(userId, 'chat');

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        const messages = [
            { role: 'system', content: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.' },
            ...conversation.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: message }
        ];

        const completion = await openaiChat.chat.completions.create({
            model: model,
            messages: messages,
            temperature: conversation.settings.temperature,
            max_tokens: conversation.settings.maxTokens
        });

        const aiResponse = completion.choices[0].message.content;
        const processingTime = Date.now() - startTime;

        // Save messages
        await saveConversationMessages(conversation, message, aiResponse, 'text', model, processingTime, completion.usage);

        return {
            response: aiResponse,
            conversationId: conversation._id,
            metadata: { model, processingTime, tokenCount: completion.usage?.total_tokens || 0 }
        };

    } catch (error) {
        logger.error(`Chat response error: ${error.message}`);
        throw error;
    }
};

// NOTE - CODE MODE USING DEEPSEEK API

const getCodeResponse = async (userId, conversationId, message, codeLanguage = 'javascript') => {
    try {
        const startTime = Date.now();

        await checkUserLimits(userId, 'code');

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        const messages = [
            {
                role: 'system',
                content: `You are DeepSeek Coder, an expert programming assistant. Help with coding questions, debugging, code review, and programming best practices. Focus on ${codeLanguage} unless specified otherwise. Provide clean, efficient, and well-documented code.`
            },
            ...conversation.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: message }
        ];

        const response = await axios.post(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            model: 'deepseek-coder',
            messages: messages,
            temperature: 0.1, // Lower temperature for more consistent code
            max_tokens: 4000
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const aiResponse = response.data.choices[0].message.content;
        const processingTime = Date.now() - startTime;

        // Save messages
        await saveConversationMessages(conversation, message, aiResponse, 'code', 'deepseek-coder', processingTime, response.data.usage, { codeLanguage });

        return {
            response: aiResponse,
            conversationId: conversation._id,
            metadata: { model: 'deepseek-coder', processingTime, codeLanguage }
        };

    } catch (error) {
        logger.error(`Code response error: ${error.message}`);
        throw error;
    }
};

//NOTE - RESEARCH MODE USING BOTH OPENAI AND DEEPSEEK APIs

const getResearchResponse = async (userId, conversationId, query) => {
    try {
        const startTime = Date.now();

        await checkUserLimits(userId, 'research');

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        // Parallel API calls to both OpenAI and DeepSeek
        const [openaiPromise, deepSeekPromise] = await Promise.allSettled([
            // OpenAI for general research
            openaiChat.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are a research assistant. Provide comprehensive, well-structured research responses with reliable information.' },
                    { role: 'user', content: `Research query: ${query}` }
                ],
                temperature: 0.3,
                max_tokens: 2000
            }),
            // DeepSeek for technical aspects
            axios.post(`${DEEPSEEK_BASE_URL}/chat/completions`, {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are a technical research specialist. Focus on technical aspects, data analysis, and detailed explanations.' },
                    { role: 'user', content: `Technical research: ${query}` }
                ],
                temperature: 0.2,
                max_tokens: 2000
            }, {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            })
        ]);

        let combinedResponse = '';
        let sources = [];

        // Process OpenAI response
        if (openaiPromise.status === 'fulfilled') {
            const openaiResponse = openaiPromise.value.choices[0].message.content;
            combinedResponse += `**General Research (GPT-4):**\n${openaiResponse}\n\n`;
            sources.push('OpenAI GPT-4');
        }

        // Process DeepSeek response
        if (deepSeekPromise.status === 'fulfilled') {
            const deepSeekResponse = deepSeekPromise.value.data.choices[0].message.content;
            combinedResponse += `**Technical Analysis (DeepSeek):**\n${deepSeekResponse}\n\n`;
            sources.push('DeepSeek');
        }

        if (!combinedResponse) {
            throw new Error('Both research APIs failed to respond');
        }

        combinedResponse += `\n---\n*Research compiled from: ${sources.join(', ')}*`;

        const processingTime = Date.now() - startTime;

        // Save messages
        await saveConversationMessages(conversation, query, combinedResponse, 'research', 'combined-research', processingTime, null, { sources });

        return {
            response: combinedResponse,
            conversationId: conversation._id,
            metadata: {
                model: 'combined-research',
                processingTime,
                sources: sources.join(', ')
            }
        };

    } catch (error) {
        logger.error(`Research response error: ${error.message}`);
        throw error;
    }
};

// NOTE - DOCUMENT MODE USING GPT-4

const getDocumentResponse = async (userId, conversationId, prompt, documentType = 'general') => {
    try {
        const startTime = Date.now();

        await checkUserLimits(userId, 'document');

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        const systemPrompt = getDocumentSystemPrompt(documentType);

        const completion = await openaiChat.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: systemPrompt },
                ...conversation.messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            max_tokens: 3000
        });

        const aiResponse = completion.choices[0].message.content;
        const processingTime = Date.now() - startTime;

        // Save messages
        await saveConversationMessages(conversation, prompt, aiResponse, 'document', 'gpt-4', processingTime, completion.usage, { documentType });

        return {
            response: aiResponse,
            conversationId: conversation._id,
            metadata: { model: 'gpt-4', processingTime, documentType }
        };

    } catch (error) {
        logger.error(`Document response error: ${error.message}`);
        throw error;
    }
};

// NOTE - GEMINI IMAGE GENERATION

const generateImage = async (userId, conversationId, prompt) => {
    try {
        const startTime = Date.now();

        await checkUserLimits(userId, 'image');

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        // For now, we'll use OpenAI DALL-E as Gemini image generation is limited
        const response = await openaiChat.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard"
        });

        const imageUrl = response.data[0].url;
        const processingTime = Date.now() - startTime;

        // Save to image library
        const imageLibraryEntry = await saveToImageLibrary(userId, imageUrl, prompt);

        // Save to conversation
        await saveConversationMessages(conversation, prompt, `Generated image: ${prompt}`, 'image', 'dall-e-3', processingTime, null, {
            imageUrl,
            libraryId: imageLibraryEntry._id
        });

        return {
            imageUrl,
            prompt,
            conversationId: conversation._id,
            libraryId: imageLibraryEntry._id,
            metadata: { model: 'dall-e-3', processingTime }
        };

    } catch (error) {
        logger.error(`Image generation error: ${error.message}`);
        throw error;
    }
};

// NOTE - GEMINI VIDEO GENERATION (PLACEHOLDER)

const generateVideo = async (userId, conversationId, prompt) => {
    try {
        await checkUserLimits(userId, 'video');

        // Placeholder implementation
        throw new Error('Video generation with Gemini API coming soon. Feature under development.');

    } catch (error) {
        logger.error(`Video generation error: ${error.message}`);
        throw error;
    }
};

// Helper functions
const getDefaultModelForMode = (mode) => {
    const modelMap = {
        'chat': 'gpt-3.5-turbo',
        'code': 'deepseek-coder',
        'image': 'dall-e-3',
        'video': 'gemini-pro',
        'research': 'combined-research',
        'document': 'gpt-4'
    };
    return modelMap[mode] || 'gpt-3.5-turbo';
};

const getDefaultTemperatureForMode = (mode) => {
    const tempMap = {
        'chat': 0.7,
        'code': 0.1,
        'image': 0.8,
        'video': 0.6,
        'research': 0.3,
        'document': 0.4
    };
    return tempMap[mode] || 0.7;
};

const getDefaultMaxTokensForMode = (mode) => {
    const tokenMap = {
        'chat': 2000,
        'code': 4000,
        'image': 1000,
        'video': 1500,
        'research': 3000,
        'document': 3000
    };
    return tokenMap[mode] || 2000;
};

const getDocumentSystemPrompt = (documentType) => {
    const prompts = {
        'general': 'You are a professional document writer. Create well-structured, clear, and comprehensive documents.',
        'business': 'You are a business document specialist. Create professional business documents with proper formatting and structure.',
        'technical': 'You are a technical writer. Create detailed technical documentation with clear explanations and examples.',
        'academic': 'You are an academic writer. Create scholarly documents with proper citations and academic formatting.',
        'legal': 'You are a legal document assistant. Create formal legal documents with appropriate legal language and structure.'
    };
    return prompts[documentType] || prompts['general'];
};

const saveConversationMessages = async (conversation, userMessage, aiResponse, messageType, model, processingTime, usage, metadata = {}) => {
    try {
        // Add user message
        conversation.messages.push({
            role: 'user',
            content: userMessage,
            messageType: messageType,
            aiModel: model,
            metadata: { processingTime, ...metadata }
        });

        // Add AI response
        conversation.messages.push({
            role: 'assistant',
            content: aiResponse,
            messageType: messageType,
            aiModel: model,
            metadata: {
                processingTime,
                tokenCount: usage?.completion_tokens || 0,
                ...metadata
            }
        });

        // Auto-generate title if it's the first exchange
        if (conversation.messages.length === 2) {
            conversation.title = conversation.generateTitle();
        }

        conversation.lastActivity = new Date();
        await conversation.save();

    } catch (error) {
        logger.error(`Save conversation messages error: ${error.message}`);
        throw error;
    }
};

/**
 * Save image to library (30-day retention)
 */
const saveToImageLibrary = async (userId, imageUrl, prompt) => {
    try {
        const imageLibraryEntry = new ImageLibrary({
            user: userId,
            imageUrl: imageUrl,
            originalPrompt: prompt,
            filename: `image_${Date.now()}.png`,
            aiModel: 'dall-e-3',
            metadata: {
                size: '1024x1024',
                quality: 'standard',
                processingTime: 0
            }
        });

        await imageLibraryEntry.save();
        logger.info(`Image saved to library for user ${userId}`);
        return imageLibraryEntry;

    } catch (error) {
        logger.error(`Save to image library error: ${error.message}`);
        throw error;
    }
};

/**
 * Get user's image library
 */
const getUserImageLibrary = async (userId, page = 1, limit = 20) => {
    try {
        const skip = (page - 1) * limit;

        const images = await ImageLibrary.find({
            user: userId,
            isActive: true
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'firstName lastName email');

        const total = await ImageLibrary.countDocuments({
            user: userId,
            isActive: true
        });

        return {
            images,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };

    } catch (error) {
        logger.error(`Get user image library error: ${error.message}`);
        throw error;
    }
};

/**
 * Delete image from library
 */
const deleteImageFromLibrary = async (userId, imageId) => {
    try {
        const image = await ImageLibrary.findOne({
            _id: imageId,
            user: userId
        });

        if (!image) {
            throw new Error('Image not found or access denied');
        }

        image.isActive = false;
        await image.save();

        logger.info(`Image ${imageId} deleted from library for user ${userId}`);
        return { success: true, message: 'Image deleted successfully' };

    } catch (error) {
        logger.error(`Delete image from library error: ${error.message}`);
        throw error;
    }
};

// NOTE - EXISTING FUNCTIONS (getUserConversations, checkUserLimits, deleteConversation, togglePinConversation)
// These functions are assumed to exist from your previous implementation

const getUserConversations = async (userId, page = 1, limit = 20, aiMode = null) => {
    try {
        const query = { user: userId };
        if (aiMode) query.aiMode = aiMode;

        const conversations = await Conversation.find(query)
            .sort({ lastActivity: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('user', 'firstName lastName email');

        return conversations;
    } catch (error) {
        logger.error(`Get user conversations error: ${error.message}`);
        throw error;
    }
};

const checkUserLimits = async (userId, limitType) => {
    try {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        // Check subscription limits based on user tier
        const limits = user.subscription.features;
        const today = new Date().toDateString();

        // This is a simplified check - you might want to implement more sophisticated tracking
        return true; // For now, allow all requests
    } catch (error) {
        logger.error(`Check user limits error: ${error.message}`);
        throw error;
    }
};

const deleteConversation = async (userId, conversationId) => {
    try {
        const conversation = await Conversation.findOne({
            _id: conversationId,
            user: userId
        });

        if (!conversation) {
            throw new Error('Conversation not found or access denied');
        }

        await Conversation.findByIdAndDelete(conversationId);
        return { success: true, message: 'Conversation deleted successfully' };
    } catch (error) {
        logger.error(`Delete conversation error: ${error.message}`);
        throw error;
    }
};

const togglePinConversation = async (userId, conversationId) => {
    try {
        const conversation = await Conversation.findOne({
            _id: conversationId,
            user: userId
        });

        if (!conversation) {
            throw new Error('Conversation not found or access denied');
        }

        conversation.isPinned = !conversation.isPinned;
        await conversation.save();

        return {
            success: true,
            message: `Conversation ${conversation.isPinned ? 'pinned' : 'unpinned'} successfully`,
            isPinned: conversation.isPinned
        };
    } catch (error) {
        logger.error(`Toggle pin conversation error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    createConversation,
    getChatResponse,
    getCodeResponse,
    getResearchResponse,
    getDocumentResponse,
    generateImage,
    generateVideo,
    getUserConversations,
    deleteConversation,
    togglePinConversation,
    checkUserLimits,
    getUserImageLibrary,
    deleteImageFromLibrary
};