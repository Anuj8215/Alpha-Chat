//!SECTION - AI SERVICE FOR GPT AND GEMINI INTEGRATION

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Conversation = require('../models/conversation');
const User = require('../models/users');
const logger = require('../utils/logger');


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

//NOTE - GETTING CHAT RESPONSE FROM GPT-3.5, GPT-4, OR GEMINI MODEL

const getChatResponse = async (userId, conversationId, message, model = 'gpt-3.5-turbo') => {
    try {
        const startTime = Date.now();

        // Get conversation history
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.user.toString() !== userId) {
            throw new Error('Conversation not found or access denied');
        }

        // Prepare messages for OpenAI API
        const messages = conversation.messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // Add the new user message
        messages.push({
            role: 'user',
            content: message
        });

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: model,
            messages: messages,
            temperature: conversation.settings.temperature,
            max_tokens: conversation.settings.maxTokens
        });

        const aiResponse = completion.choices[0].message.content;
        const processingTime = Date.now() - startTime;
        const tokenCount = completion.usage?.total_tokens || 0;

        // Save both user message and AI response to conversation
        conversation.messages.push({
            role: 'user',
            content: message,
            aiModel: model,
            metadata: {
                processingTime,
                tokenCount: completion.usage?.prompt_tokens || 0
            }
        });

        conversation.messages.push({
            role: 'assistant',
            content: aiResponse,
            aiModel: model,
            metadata: {
                processingTime,
                tokenCount: completion.usage?.completion_tokens || 0
            }
        });

        conversation.lastActivity = new Date();
        await conversation.save();

        // Check user's AI message limit
        await checkUserLimits(userId);

        return {
            response: aiResponse,
            conversationId: conversation._id,
            metadata: {
                model,
                processingTime,
                tokenCount
            }
        };

    } catch (error) {
        logger.error(`GPT chat error: ${error.message}`);
        throw error;
    }
};

//NOTE - GENERATING IMAGE USING DALL-E OR GEMINI IMAGE MODEL

const generateImage = async (userId, conversationId, prompt) => {
    try {
        const startTime = Date.now();

        // For now, we'll use DALL-E since Gemini's image generation API might be limited
        // You can switch to Gemini when their image generation API is more accessible

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024"
        });

        const imageUrl = response.data[0].url;
        const processingTime = Date.now() - startTime;

        // Save to conversation
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.user.toString() === userId) {
            conversation.messages.push({
                role: 'user',
                content: prompt,
                messageType: 'text'
            });

            conversation.messages.push({
                role: 'assistant',
                content: `Generated image: ${prompt}`,
                messageType: 'image',
                aiModel: 'dall-e-3',
                metadata: {
                    processingTime,
                    mediaUrl: imageUrl,
                    prompt
                }
            });

            conversation.lastActivity = new Date();
            await conversation.save();
        }

        return {
            imageUrl,
            prompt,
            conversationId,
            metadata: {
                model: 'dall-e-3',
                processingTime
            }
        };

    } catch (error) {
        logger.error(`Image generation error: ${error.message}`);
        throw error;
    }
};

//NOTE - GENERATE RESPONSE USING GOOGLE GEMINI MODEL

const getGeminiResponse = async (userId, conversationId, message) => {
    try {
        const startTime = Date.now();

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();

        const processingTime = Date.now() - startTime;

        // Save to conversation
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.user.toString() === userId) {
            conversation.messages.push({
                role: 'user',
                content: message
            });

            conversation.messages.push({
                role: 'assistant',
                content: text,
                aiModel: 'gemini-pro',
                metadata: {
                    processingTime
                }
            });

            conversation.lastActivity = new Date();
            await conversation.save();
        }

        return {
            response: text,
            conversationId,
            metadata: {
                model: 'gemini-pro',
                processingTime
            }
        };

    } catch (error) {
        logger.error(`Gemini response error: ${error.message}`);
        throw error;
    }
};

//NOTE - CREATE A NEW CONVERSATION FOR USER

const createConversation = async (userId, title = 'New Chat') => {
    try {
        const conversation = new Conversation({
            user: userId,
            title,
            messages: [],
            settings: {
                model: 'gpt-3.5-turbo',
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

//NOTE - FETCH USER'S CONVERSATIONS WITH PAGINATION

const getUserConversations = async (userId, page = 1, limit = 20) => {
    try {
        const skip = (page - 1) * limit;

        const conversations = await Conversation.find({
            user: userId,
            isActive: true
        })
            .sort({ lastActivity: -1 })
            .skip(skip)
            .limit(limit)
            .select('title lastActivity messages settings createdAt');

        return conversations;

    } catch (error) {
        logger.error(`Get conversations error: ${error.message}`);
        throw error;
    }
};

//NOTE - CHECK USER'S DAILY AI MESSAGE LIMIT

const checkUserLimits = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dailyMessages = await Conversation.aggregate([
            { $match: { user: user._id } },
            { $unwind: '$messages' },
            {
                $match: {
                    'messages.timestamp': { $gte: today },
                    'messages.role': 'assistant'
                }
            },
            { $count: 'totalMessages' }
        ]);

        const messageCount = dailyMessages[0]?.totalMessages || 0;
        const limit = user.subscription.features.aiMessageLimit;

        if (messageCount >= limit && user.subscription.type === 'free') {
            throw new Error('Daily AI message limit reached. Please upgrade to premium.');
        }

        return { messageCount, limit };

    } catch (error) {
        logger.error(`Check user limits error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    getChatResponse,
    generateImage,
    getGeminiResponse,
    createConversation,
    getUserConversations,
    checkUserLimits
};