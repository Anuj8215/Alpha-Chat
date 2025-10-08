const User = require('../models/users');
const Conversation = require('../models/conversations');
const Message = require('../models/message');
const Chat = require('../models/chat');
const SystemSettings = require('../models/systemSettings');
const AuditLog = require('../models/auditLog');
const AuditLogger = require('../utils/auditLogger');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class AdminService {
    //NOTE - DASHBOARD ANALYTICS
    async getDashboardAnalytics() {
        try {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            // User statistics
            const totalUsers = await User.countDocuments();
            const activeUsers = await User.countDocuments({
                lastLogin: { $gte: sevenDaysAgo }
            });
            const newUsers = await User.countDocuments({
                createdAt: { $gte: thirtyDaysAgo }
            });
            const bannedUsers = await User.countDocuments({
                'accountStatus.isBanned': true
            });

            // Conversation statistics
            const totalConversations = await Conversation.countDocuments();
            const activeConversations = await Conversation.countDocuments({
                updatedAt: { $gte: oneDayAgo }
            });
            const flaggedConversations = await Conversation.countDocuments({
                'moderation.isFlagged': true
            });

            // Message statistics
            const totalMessages = await Message.countDocuments();
            const todayMessages = await Message.countDocuments({
                createdAt: { $gte: oneDayAgo }
            });

            // AI Usage statistics
            const aiUsageStats = await this.getAIUsageStats();

            // Subscription statistics
            const subscriptionStats = await this.getSubscriptionBreakdown();

            return {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    new: newUsers,
                    banned: bannedUsers,
                    growth: newUsers > 0 ? ((newUsers / totalUsers) * 100).toFixed(2) : 0
                },
                conversations: {
                    total: totalConversations,
                    active: activeConversations,
                    flagged: flaggedConversations
                },
                messages: {
                    total: totalMessages,
                    today: todayMessages
                },
                aiUsage: aiUsageStats,
                subscriptions: subscriptionStats,
                systemHealth: await this.getSystemHealth()
            };
        } catch (error) {
            logger.error('Error getting dashboard analytics:', error);
            throw new Error('Failed to fetch dashboard analytics');
        }
    }

    //NOTE - USER MANAGEMENT
    async getAllUsers(options = {}) {
        try {
            const { page = 1, limit = 20, search, role, subscription } = options;
            const skip = (page - 1) * limit;

            // Build query
            const query = {};

            if (search) {
                query.$or = [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { mobileNumber: { $regex: search, $options: 'i' } }
                ];
            }

            if (role) {
                query.role = role;
            }

            if (subscription) {
                query['subscription.plan'] = subscription;
            }

            const users = await User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await User.countDocuments(query);

            return {
                users,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total,
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            logger.error('Error getting all users:', error);
            throw new Error('Failed to fetch users');
        }
    }

    async getUserDetails(userId) {
        try {
            const user = await User.findById(userId).select('-password').lean();
            if (!user) {
                throw new Error('User not found');
            }

            // Get user's conversation count
            const conversationCount = await Conversation.countDocuments({ userId });

            // Get user's message count
            const messageCount = await Message.countDocuments({ senderId: userId });

            // Get user's recent activity
            const recentConversations = await Conversation.find({ userId })
                .sort({ updatedAt: -1 })
                .limit(5)
                .select('title aiMode updatedAt')
                .lean();

            return {
                ...user,
                stats: {
                    conversationCount,
                    messageCount,
                    recentConversations
                }
            };
        } catch (error) {
            logger.error('Error getting user details:', error);
            throw new Error('Failed to fetch user details');
        }
    }

    async updateUser(userId, updateData) {
        try {
            const allowedUpdates = ['role', 'accountStatus', 'subscription'];
            const updates = {};

            // Filter allowed updates
            Object.keys(updateData).forEach(key => {
                if (allowedUpdates.includes(key)) {
                    updates[key] = updateData[key];
                }
            });

            const user = await User.findByIdAndUpdate(
                userId,
                { $set: updates },
                { new: true, runValidators: true }
            ).select('-password');

            if (!user) {
                throw new Error('User not found');
            }

            logger.info(`Admin updated user ${userId}:`, updates);
            return user;
        } catch (error) {
            logger.error('Error updating user:', error);
            throw new Error('Failed to update user');
        }
    }

    async banUser(userId, reason, duration, performedBy) {
        try {
            const banUntil = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;

            const user = await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        'accountStatus.isBanned': true,
                        'accountStatus.banReason': reason,
                        'accountStatus.bannedAt': new Date(),
                        'accountStatus.banUntil': banUntil
                    }
                },
                { new: true }
            ).select('-password');

            if (!user) {
                throw new Error('User not found');
            }

            // Log the ban action
            await AuditLogger.logUserAction(
                'user_banned',
                performedBy,
                userId,
                { reason, duration, banUntil }
            );

            logger.warn(`User ${userId} banned by ${performedBy}. Reason: ${reason}`);
            return user;
        } catch (error) {
            logger.error('Error banning user:', error);
            throw new Error('Failed to ban user');
        }
    } async unbanUser(userId, performedBy) {
        try {
            const user = await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        'accountStatus.isBanned': false,
                        'accountStatus.banReason': null,
                        'accountStatus.bannedAt': null,
                        'accountStatus.banUntil': null
                    }
                },
                { new: true }
            ).select('-password');

            if (!user) {
                throw new Error('User not found');
            }

            // Log the unban action
            await AuditLogger.logUserAction(
                'user_unbanned',
                performedBy,
                userId,
                {}
            );

            logger.info(`User ${userId} unbanned by ${performedBy}`);
            return user;
        } catch (error) {
            logger.error('Error unbanning user:', error);
            throw new Error('Failed to unban user');
        }
    }

    async deleteUser(userId, performedBy) {
        try {
            // Get user info before deletion for audit log
            const user = await User.findById(userId).select('firstName lastName email');
            if (!user) {
                throw new Error('User not found');
            }

            // Delete user's conversations and messages
            const deletedConversations = await Conversation.countDocuments({ userId });
            const deletedMessages = await Message.countDocuments({ senderId: userId });

            await Conversation.deleteMany({ userId });
            await Message.deleteMany({ senderId: userId });

            // Delete user
            await User.findByIdAndDelete(userId);

            // Log the deletion
            await AuditLogger.logUserAction(
                'user_deleted',
                performedBy,
                userId,
                {
                    userInfo: user.toObject(),
                    deletedConversations,
                    deletedMessages
                }
            );

            logger.warn(`User ${userId} deleted by admin ${performedBy}`);
            return { message: 'User deleted successfully' };
        } catch (error) {
            logger.error('Error deleting user:', error);
            throw new Error('Failed to delete user');
        }
    }    //NOTE - CONVERSATION MANAGEMENT
    async getAllConversations(options = {}) {
        try {
            const { page = 1, limit = 20, userId, aiMode, flagged } = options;
            const skip = (page - 1) * limit;

            const query = {};

            if (userId) {
                query.userId = userId;
            }

            if (aiMode) {
                query.aiMode = aiMode;
            }

            if (flagged !== undefined) {
                query['moderation.isFlagged'] = flagged;
            }

            const conversations = await Conversation.find(query)
                .populate('userId', 'firstName lastName email')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await Conversation.countDocuments(query);

            return {
                conversations,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total,
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            logger.error('Error getting conversations:', error);
            throw new Error('Failed to fetch conversations');
        }
    }

    async getConversationDetails(conversationId) {
        try {
            const conversation = await Conversation.findById(conversationId)
                .populate('userId', 'firstName lastName email')
                .lean();

            if (!conversation) {
                throw new Error('Conversation not found');
            }

            // Get messages for this conversation
            const messages = await Message.find({ conversationId })
                .sort({ createdAt: 1 })
                .limit(50)
                .lean();

            return {
                ...conversation,
                messages
            };
        } catch (error) {
            logger.error('Error getting conversation details:', error);
            throw new Error('Failed to fetch conversation details');
        }
    }

    async flagConversation(conversationId, reason) {
        try {
            const conversation = await Conversation.findByIdAndUpdate(
                conversationId,
                {
                    $set: {
                        'moderation.isFlagged': true,
                        'moderation.flagReason': reason,
                        'moderation.flaggedAt': new Date()
                    }
                },
                { new: true }
            );

            if (!conversation) {
                throw new Error('Conversation not found');
            }

            logger.warn(`Conversation ${conversationId} flagged. Reason: ${reason}`);
            return conversation;
        } catch (error) {
            logger.error('Error flagging conversation:', error);
            throw new Error('Failed to flag conversation');
        }
    }

    async deleteConversation(conversationId) {
        try {
            // Delete associated messages
            await Message.deleteMany({ conversationId });

            // Delete conversation
            const conversation = await Conversation.findByIdAndDelete(conversationId);
            if (!conversation) {
                throw new Error('Conversation not found');
            }

            logger.warn(`Conversation ${conversationId} deleted by admin`);
            return { message: 'Conversation deleted successfully' };
        } catch (error) {
            logger.error('Error deleting conversation:', error);
            throw new Error('Failed to delete conversation');
        }
    }

    //NOTE - SYSTEM MONITORING
    async getSystemStats() {
        try {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            // Database stats
            const dbStats = {
                users: await User.countDocuments(),
                conversations: await Conversation.countDocuments(),
                messages: await Message.countDocuments(),
                chats: await Chat.countDocuments()
            };

            // Activity stats
            const activityStats = {
                dailyActiveUsers: await User.countDocuments({ lastLogin: { $gte: oneDayAgo } }),
                weeklyActiveUsers: await User.countDocuments({ lastLogin: { $gte: oneWeekAgo } }),
                dailyMessages: await Message.countDocuments({ createdAt: { $gte: oneDayAgo } }),
                weeklyMessages: await Message.countDocuments({ createdAt: { $gte: oneWeekAgo } })
            };

            // Storage stats (approximate)
            const storageStats = await this.getStorageStats();

            return {
                database: dbStats,
                activity: activityStats,
                storage: storageStats,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error('Error getting system stats:', error);
            throw new Error('Failed to fetch system statistics');
        }
    }

    async getApiUsageStats(options = {}) {
        try {
            const { startDate, endDate, groupBy = 'day' } = options;

            // This would typically come from API logs or analytics service
            // For now, we'll use message creation as a proxy for API usage
            const pipeline = [
                {
                    $match: {
                        createdAt: {
                            $gte: startDate,
                            $lte: endDate
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: groupBy === 'hour' ? '%Y-%m-%d-%H' :
                                    groupBy === 'day' ? '%Y-%m-%d' :
                                        '%Y-%m',
                                date: '$createdAt'
                            }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ];

            const usage = await Message.aggregate(pipeline);

            return usage.map(item => ({
                date: item._id,
                requests: item.count
            }));
        } catch (error) {
            logger.error('Error getting API usage stats:', error);
            throw new Error('Failed to fetch API usage statistics');
        }
    }

    async getErrorLogs(options = {}) {
        try {
            const { page = 1, limit = 50, level } = options;

            // Read error logs from Winston log files
            const logDir = path.join(__dirname, '../../logs');
            const errorLogPath = path.join(logDir, 'error.log');

            try {
                const logContent = await fs.readFile(errorLogPath, 'utf8');
                const lines = logContent.split('\n').filter(line => line.trim());

                let filteredLines = lines;
                if (level) {
                    filteredLines = lines.filter(line => line.includes(`"level":"${level}"`));
                }

                const start = (page - 1) * limit;
                const end = start + limit;
                const paginatedLines = filteredLines.slice(start, end);

                const logs = paginatedLines.map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return { message: line, timestamp: new Date() };
                    }
                });

                return {
                    logs,
                    pagination: {
                        current: page,
                        pages: Math.ceil(filteredLines.length / limit),
                        total: filteredLines.length
                    }
                };
            } catch (fileError) {
                return {
                    logs: [],
                    pagination: { current: 1, pages: 0, total: 0 },
                    message: 'No error logs found'
                };
            }
        } catch (error) {
            logger.error('Error getting error logs:', error);
            throw new Error('Failed to fetch error logs');
        }
    }

    //NOTE - CONTENT MODERATION
    async getFlaggedContent(options = {}) {
        try {
            const { page = 1, limit = 20, type } = options;
            const skip = (page - 1) * limit;

            let flaggedContent = [];
            let total = 0;

            if (!type || type === 'conversation') {
                const conversations = await Conversation.find({ 'moderation.isFlagged': true })
                    .populate('userId', 'firstName lastName email')
                    .sort({ 'moderation.flaggedAt': -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();

                flaggedContent = flaggedContent.concat(
                    conversations.map(conv => ({ ...conv, contentType: 'conversation' }))
                );

                total += await Conversation.countDocuments({ 'moderation.isFlagged': true });
            }

            return {
                flaggedContent,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total,
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            logger.error('Error getting flagged content:', error);
            throw new Error('Failed to fetch flagged content');
        }
    }

    async reviewFlaggedContent(itemId, action, notes, reviewerId) {
        try {
            const validActions = ['approve', 'remove', 'ban_user'];
            if (!validActions.includes(action)) {
                throw new Error('Invalid action');
            }

            // Find the flagged item (conversation or message)
            let item = await Conversation.findById(itemId);
            let itemType = 'conversation';

            if (!item) {
                item = await Message.findById(itemId);
                itemType = 'message';
            }

            if (!item) {
                throw new Error('Flagged content not found');
            }

            // Update moderation status
            item.moderation = {
                ...item.moderation,
                isReviewed: true,
                reviewedAt: new Date(),
                reviewerId,
                reviewAction: action,
                reviewNotes: notes
            };

            if (action === 'approve') {
                item.moderation.isFlagged = false;
            } else if (action === 'remove') {
                item.isDeleted = true;
                item.deletedAt = new Date();
            } else if (action === 'ban_user') {
                // Ban the user
                await this.banUser(item.userId, `Content violation: ${notes}`, 7); // 7 days ban
                item.isDeleted = true;
                item.deletedAt = new Date();
            }

            await item.save();

            logger.info(`Flagged ${itemType} ${itemId} reviewed. Action: ${action}`);
            return item;
        } catch (error) {
            logger.error('Error reviewing flagged content:', error);
            throw new Error('Failed to review flagged content');
        }
    }

    //NOTE - SUBSCRIPTION MANAGEMENT
    async getSubscriptionAnalytics() {
        try {
            const subscriptionBreakdown = await User.aggregate([
                {
                    $group: {
                        _id: '$subscription.plan',
                        count: { $sum: 1 },
                        totalRevenue: { $sum: '$subscription.features.monthlyCredits' } // Simplified
                    }
                }
            ]);

            const totalSubscribers = await User.countDocuments({
                'subscription.plan': { $ne: 'free' }
            });

            const freeUsers = await User.countDocuments({
                'subscription.plan': 'free'
            });

            return {
                breakdown: subscriptionBreakdown,
                summary: {
                    totalSubscribers,
                    freeUsers,
                    conversionRate: totalSubscribers > 0 ? ((totalSubscribers / (totalSubscribers + freeUsers)) * 100).toFixed(2) : 0
                }
            };
        } catch (error) {
            logger.error('Error getting subscription analytics:', error);
            throw new Error('Failed to fetch subscription analytics');
        }
    }

    async updateUserSubscription(userId, subscriptionData) {
        try {
            const user = await User.findByIdAndUpdate(
                userId,
                { $set: { subscription: subscriptionData } },
                { new: true, runValidators: true }
            ).select('-password');

            if (!user) {
                throw new Error('User not found');
            }

            logger.info(`Subscription updated for user ${userId}`);
            return user;
        } catch (error) {
            logger.error('Error updating subscription:', error);
            throw new Error('Failed to update subscription');
        }
    }

    //NOTE - BULK OPERATIONS
    async bulkUserOperation(action, userIds, data) {
        try {
            const validActions = ['ban', 'unban', 'delete', 'update_role', 'update_subscription'];
            if (!validActions.includes(action)) {
                throw new Error('Invalid bulk action');
            }

            const results = [];

            for (const userId of userIds) {
                try {
                    let result;

                    switch (action) {
                        case 'ban':
                            result = await this.banUser(userId, data.reason, data.duration, data.performedBy);
                            break;
                        case 'unban':
                            result = await this.unbanUser(userId, data.performedBy);
                            break;
                        case 'delete':
                            result = await this.deleteUser(userId, data.performedBy);
                            break;
                        case 'update_role':
                            result = await this.updateUser(userId, { role: data.role });
                            break;
                        case 'update_subscription':
                            result = await this.updateUserSubscription(userId, data.subscription);
                            break;
                    }

                    results.push({ userId, success: true, data: result });
                } catch (error) {
                    results.push({ userId, success: false, error: error.message });
                }
            }

            return results;
        } catch (error) {
            logger.error('Error in bulk operation:', error);
            throw new Error('Failed to perform bulk operation');
        }
    }

    async exportUserData(format, filters) {
        try {
            const query = {};

            // Apply filters
            if (filters) {
                const parsedFilters = JSON.parse(filters);
                Object.assign(query, parsedFilters);
            }

            const users = await User.find(query)
                .select('-password')
                .lean();

            if (format === 'csv') {
                return this.convertToCSV(users);
            } else {
                return JSON.stringify(users, null, 2);
            }
        } catch (error) {
            logger.error('Error exporting user data:', error);
            throw new Error('Failed to export user data');
        }
    }

    //NOTE - SYSTEM SETTINGS
    async getSystemSettings() {
        try {
            const categories = ['general', 'ai', 'limits', 'security', 'payments', 'notifications'];
            const settings = {};

            for (const category of categories) {
                settings[category] = await SystemSettings.getByCategory(category);
            }

            // If no settings exist, create defaults
            if (Object.keys(settings.general || {}).length === 0) {
                await this.createDefaultSettings();
                // Re-fetch after creating defaults
                for (const category of categories) {
                    settings[category] = await SystemSettings.getByCategory(category);
                }
            }

            return settings;
        } catch (error) {
            logger.error('Error getting system settings:', error);
            throw new Error('Failed to fetch system settings');
        }
    }

    async updateSystemSettings(settings, modifiedBy) {
        try {
            const updatedSettings = {};

            for (const [category, categorySettings] of Object.entries(settings)) {
                updatedSettings[category] = {};

                for (const [key, value] of Object.entries(categorySettings)) {
                    const dataType = this.getDataType(value);
                    const description = this.getSettingDescription(category, key);

                    const setting = await SystemSettings.setSetting(
                        category,
                        key,
                        value,
                        dataType,
                        description,
                        modifiedBy
                    );

                    updatedSettings[category][key] = setting.value;
                }
            }

            // Log the settings update
            await AuditLogger.logSettingsAction(
                'settings_updated',
                modifiedBy,
                { updatedSettings }
            );

            logger.info('System settings updated by:', modifiedBy);
            return updatedSettings;
        } catch (error) {
            logger.error('Error updating system settings:', error);
            throw new Error('Failed to update system settings');
        }
    }

    async createDefaultSettings() {
        try {
            const defaults = {
                general: {
                    appName: 'Alpha Chat',
                    maintenanceMode: false,
                    allowNewRegistrations: true,
                    maxUsersPerSubscription: 50000
                },
                ai: {
                    defaultModel: 'gpt-3.5-turbo',
                    maxTokensPerRequest: 4000,
                    enableImageGeneration: true,
                    enableVideoGeneration: false
                },
                limits: {
                    freeUserDailyMessages: 20,
                    premiumUserDailyMessages: 500,
                    maxFileUploadSize: '10MB',
                    maxConversationsPerUser: 100
                },
                security: {
                    enableRateLimit: true,
                    maxLoginAttempts: 5,
                    sessionTimeout: 3600,
                    requireEmailVerification: false
                },
                payments: {
                    stripeEnabled: false,
                    paypalEnabled: false,
                    trialPeriodDays: 7
                },
                notifications: {
                    emailEnabled: false,
                    smsEnabled: false,
                    pushEnabled: false
                }
            };

            for (const [category, categorySettings] of Object.entries(defaults)) {
                for (const [key, value] of Object.entries(categorySettings)) {
                    const dataType = this.getDataType(value);
                    const description = this.getSettingDescription(category, key);

                    await SystemSettings.setSetting(
                        category,
                        key,
                        value,
                        dataType,
                        description,
                        null // System default
                    );
                }
            }

            logger.info('Default system settings created');
        } catch (error) {
            logger.error('Error creating default settings:', error);
            throw error;
        }
    }

    getDataType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'object' && Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        return 'string';
    }

    getSettingDescription(category, key) {
        const descriptions = {
            general: {
                appName: 'The name of the application',
                maintenanceMode: 'Enable maintenance mode to prevent user access',
                allowNewRegistrations: 'Allow new users to register',
                maxUsersPerSubscription: 'Maximum number of users supported per subscription'
            },
            ai: {
                defaultModel: 'Default AI model to use for chat responses',
                maxTokensPerRequest: 'Maximum tokens allowed per AI request',
                enableImageGeneration: 'Enable AI image generation features',
                enableVideoGeneration: 'Enable AI video generation features'
            },
            limits: {
                freeUserDailyMessages: 'Daily message limit for free users',
                premiumUserDailyMessages: 'Daily message limit for premium users',
                maxFileUploadSize: 'Maximum file upload size',
                maxConversationsPerUser: 'Maximum conversations per user'
            },
            security: {
                enableRateLimit: 'Enable API rate limiting',
                maxLoginAttempts: 'Maximum login attempts before lockout',
                sessionTimeout: 'Session timeout in seconds',
                requireEmailVerification: 'Require email verification for new accounts'
            },
            payments: {
                stripeEnabled: 'Enable Stripe payment processing',
                paypalEnabled: 'Enable PayPal payment processing',
                trialPeriodDays: 'Free trial period in days'
            },
            notifications: {
                emailEnabled: 'Enable email notifications',
                smsEnabled: 'Enable SMS notifications',
                pushEnabled: 'Enable push notifications'
            }
        };

        return descriptions[category]?.[key] || `Setting for ${key}`;
    }

    //NOTE - HELPER METHODS
    async getAIUsageStats() {
        try {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const aiMessages = await Message.find({
                isAIResponse: true,
                createdAt: { $gte: oneDayAgo }
            });

            const chatMessages = aiMessages.filter(msg => msg.aiMetadata?.mode === 'chat').length;
            const codeMessages = aiMessages.filter(msg => msg.aiMetadata?.mode === 'code').length;
            const imageMessages = aiMessages.filter(msg => msg.aiMetadata?.mode === 'image').length;

            return {
                total: aiMessages.length,
                chat: chatMessages,
                code: codeMessages,
                image: imageMessages,
                video: 0 // Not implemented yet
            };
        } catch (error) {
            logger.error('Error getting AI usage stats:', error);
            return { total: 0, chat: 0, code: 0, image: 0, video: 0 };
        }
    }

    async getSubscriptionBreakdown() {
        try {
            const breakdown = await User.aggregate([
                {
                    $group: {
                        _id: '$subscription.plan',
                        count: { $sum: 1 }
                    }
                }
            ]);

            return breakdown.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {});
        } catch (error) {
            logger.error('Error getting subscription breakdown:', error);
            return {};
        }
    }

    async getSystemHealth() {
        try {
            // Basic health checks
            const dbConnected = require('mongoose').connection.readyState === 1;
            const uptime = process.uptime();
            const memoryUsage = process.memoryUsage();

            return {
                database: dbConnected ? 'healthy' : 'unhealthy',
                uptime: Math.floor(uptime / 3600) + ' hours',
                memory: {
                    used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                    total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
                },
                status: dbConnected ? 'healthy' : 'degraded'
            };
        } catch (error) {
            logger.error('Error getting system health:', error);
            return { status: 'error' };
        }
    }

    async getStorageStats() {
        try {
            const uploadsDir = path.join(__dirname, '../../uploads');

            try {
                const stats = await fs.stat(uploadsDir);
                return {
                    uploadsSize: '~' + Math.round(stats.size / 1024 / 1024) + ' MB'
                };
            } catch {
                return { uploadsSize: '0 MB' };
            }
        } catch (error) {
            logger.error('Error getting storage stats:', error);
            return { uploadsSize: 'Unknown' };
        }
    }

    convertToCSV(data) {
        try {
            if (!data || !data.length) return '';

            const headers = Object.keys(data[0]);
            const csvHeaders = headers.join(',');

            const csvRows = data.map(row => {
                return headers.map(header => {
                    const value = row[header];
                    if (typeof value === 'object' && value !== null) {
                        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                    }
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(',');
            });

            return [csvHeaders, ...csvRows].join('\n');
        } catch (error) {
            logger.error('Error converting to CSV:', error);
            throw new Error('Failed to convert data to CSV');
        }
    }
}

module.exports = new AdminService();