//!SECTION - AI SERVICE GPT AND GEMINI

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Conversation = require('../models/conversations');
const User = require('../models/users');
const logger = require('../utils/logger');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

//NOTE - CREATING CONVERSATION
const createConversation = async (userId, aiMode = 'chat', title = null) => {
    try {
        const conversation = new Conversation({
            user: userId,
            title: title || `New ${aiMode.charAt(0).toUpperCase() + aiMode.slice(1)} Chat`,
            aiMode: aiMode,
            messages: [],
            settings: {
                model: aiMode === 'image' || aiMode === 'video' ? 'gemini-pro' : 'gpt-3.5-turbo',
                temperature: 0.7,
                maxTokens: 2000
            }
        });

        await conversation.save();
        return conversation;

    } catch (error) {
        logger.error(`Create conversation error: ${error.message}`);
        throw error;
    }
};

//NOTE - REGULAR CONVERSATION
const getChatResponse = async (userId, conversationId, message, model = 'gpt-3.5-turbo') => {
    try {
        const startTime = Date.now();

        // Check user limits
        await checkUserLimits(userId, 'chat');

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        // Prepare messages for OpenAI
        const messages = [
            { role: 'system', content: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.' },
            ...conversation.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: message }
        ];

        const completion = await openai.chat.completions.create({
            model: model,
            messages: messages,
            temperature: conversation.settings.temperature,
            max_tokens: conversation.settings.maxTokens
        });

        const aiResponse = completion.choices[0].message.content;
        const processingTime = Date.now() - startTime;

        // Save messages to conversation
        conversation.messages.push({
            role: 'user',
            content: message,
            messageType: 'text',
            aiModel: model,
            metadata: { processingTime, tokenCount: completion.usage?.prompt_tokens || 0 }
        });

        conversation.messages.push({
            role: 'assistant',
            content: aiResponse,
            messageType: 'text',
            aiModel: model,
            metadata: { processingTime, tokenCount: completion.usage?.completion_tokens || 0 }
        });

        // Auto-generate title if it's the first message
        if (conversation.messages.length === 2) {
            conversation.title = conversation.generateTitle();
        }

        conversation.lastActivity = new Date();
        await conversation.save();

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

//NOTE - PROGRAMMING ASSISTANCE
const getCodeResponse = async (userId, conversationId, message, codeLanguage = 'javascript') => {
    try {
        const startTime = Date.now();

        await checkUserLimits(userId, 'chat'); // Same limit as chat

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        const messages = [
            {
                role: 'system',
                content: `You are an expert programming assistant. Help with coding questions, debugging, code review, and programming best practices. When providing code, use proper formatting and explain your solutions. Focus on ${codeLanguage} unless specified otherwise.`
            },
            ...conversation.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: message }
        ];

        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo', // Use GPT-4 for better code assistance
            messages: messages,
            temperature: 0.3, // Lower temperature for more consistent code
            max_tokens: 3000
        });

        const aiResponse = completion.choices[0].message.content;
        const processingTime = Date.now() - startTime;

        // Save messages
        conversation.messages.push({
            role: 'user',
            content: message,
            messageType: 'code',
            aiModel: 'gpt-4-turbo',
            metadata: { processingTime, codeLanguage }
        });

        conversation.messages.push({
            role: 'assistant',
            content: aiResponse,
            messageType: 'code',
            aiModel: 'gpt-4-turbo',
            metadata: { processingTime, codeLanguage }
        });

        if (conversation.messages.length === 2) {
            conversation.title = conversation.generateTitle();
        }

        conversation.lastActivity = new Date();
        await conversation.save();

        return {
            response: aiResponse,
            conversationId: conversation._id,
            metadata: { model: 'gpt-4-turbo', processingTime, codeLanguage }
        };

    } catch (error) {
        logger.error(`Code response error: ${error.message}`);
        throw error;
    }
};

//NOTE - IMAGE GENERATION WITH GEMINI AND DALLE
const generateImage = async (userId, conversationId, prompt, imageModel = 'dall-e-3') => {
    try {
        const startTime = Date.now();

        await checkUserLimits(userId, 'image');

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        let imageUrl;
        let modelUsed = imageModel;

        if (imageModel === 'dall-e-3') {
            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                quality: "standard"
            });
            imageUrl = response.data[0].url;
        } else {
            // Use Gemini for image generation (when available)
            throw new Error('Gemini image generation not yet implemented');
        }

        const processingTime = Date.now() - startTime;

        // Save to conversation
        conversation.messages.push({
            role: 'user',
            content: prompt,
            messageType: 'text'
        });

        conversation.messages.push({
            role: 'assistant',
            content: `Generated image: ${prompt}`,
            messageType: 'image',
            aiModel: modelUsed,
            metadata: { processingTime, mediaUrl: imageUrl, prompt }
        });

        if (conversation.messages.length === 2) {
            conversation.title = `Image: ${prompt.substring(0, 30)}...`;
        }

        conversation.lastActivity = new Date();
        await conversation.save();

        return {
            imageUrl,
            prompt,
            conversationId: conversation._id,
            metadata: { model: modelUsed, processingTime }
        };

    } catch (error) {
        logger.error(`Image generation error: ${error.message}`);
        throw error;
    }
};

//NOTE - IMAGE GENERATION WITH GEMINI
const generateVideo = async (userId, conversationId, prompt) => {
    try {
        await checkUserLimits(userId, 'video');


        throw new Error('Video generation not yet implemented. Coming soon with Gemini API updates.');

    } catch (error) {
        logger.error(`Video generation error: ${error.message}`);
        throw error;
    }
};

//NOTE - GETTING USER CONVERSATION
const getUserConversations = async (userId, filters = {}) => {
    try {
        const { aiMode, page = 1, limit = 20, search } = filters;
        const skip = (page - 1) * limit;

        let query = { user: userId, isActive: true };

        if (aiMode && aiMode !== 'all') {
            query.aiMode = aiMode;
        }

        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        const conversations = await Conversation.find(query)
            .sort({ isPinned: -1, lastActivity: -1 })
            .skip(skip)
            .limit(limit)
            .select('title aiMode lastActivity messages isPinned createdAt');

        // Add preview of last message
        const conversationsWithPreview = conversations.map(conv => {
            const lastMessage = conv.messages[conv.messages.length - 1];
            return {
                ...conv.toObject(),
                messageCount: conv.messages.length,
                lastMessagePreview: lastMessage ? lastMessage.content.substring(0, 100) + '...' : null
            };
        });

        return conversationsWithPreview;

    } catch (error) {
        logger.error(`Get conversations error: ${error.message}`);
        throw error;
    }
};

//NOTE - CHECK USERS LIMIT
const checkUserLimits = async (userId, actionType) => {
    try {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let limitField, countField;

        switch (actionType) {
            case 'chat':
                limitField = 'dailyChatLimit';
                countField = 'totalChats';
                break;
            case 'image':
                limitField = 'dailyImageLimit';
                countField = 'totalImages';
                break;
            case 'video':
                limitField = 'dailyVideoLimit';
                countField = 'totalVideos';
                break;
            default:
                return { allowed: true };
        }

        // Count today's usage
        const todayUsage = await Conversation.aggregate([
            { $match: { user: user._id } },
            { $unwind: '$messages' },
            {
                $match: {
                    'messages.timestamp': { $gte: today },
                    'messages.role': 'assistant',
                    'messages.messageType': actionType === 'chat' ? { $in: ['text', 'code'] } : actionType
                }
            },
            { $count: 'totalUsage' }
        ]);

        const usageCount = todayUsage[0]?.totalUsage || 0;
        const limit = user.subscription.features[limitField];

        if (usageCount >= limit) {
            throw new Error(`Daily ${actionType} limit reached (${limit}). Please upgrade your plan.`);
        }

        return { allowed: true, usageCount, limit };

    } catch (error) {
        logger.error(`Check user limits error: ${error.message}`);
        throw error;
    }
};

//NOTE - DELETE CONVERSATIONS
const deleteConversation = async (userId, conversationId) => {
    try {
        const conversation = await Conversation.findById(conversationId);

        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        conversation.isActive = false;
        await conversation.save();

        return { success: true };

    } catch (error) {
        logger.error(`Delete conversation error: ${error.message}`);
        throw error;
    }
};

//NOTE - PIN/UNPIN CONVERSATIONS
const togglePinConversation = async (userId, conversationId) => {
    try {
        const conversation = await Conversation.findById(conversationId);

        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        conversation.isPinned = !conversation.isPinned;
        await conversation.save();

        return { success: true, isPinned: conversation.isPinned };

    } catch (error) {
        logger.error(`Toggle pin conversation error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    createConversation,
    getChatResponse,
    getCodeResponse,
    generateImage,
    generateVideo,
    getUserConversations,
    deleteConversation,
    togglePinConversation,
    checkUserLimits
};