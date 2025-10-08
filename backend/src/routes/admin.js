const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const { auditUserAction, auditSystemAction, auditConversationAction } = require('../middleware/auditMiddleware');
const adminService = require('../services/admin');
const User = require('../models/users');
const Conversation = require('../models/conversations');
const Message = require('../models/message');

// Apply admin middleware to all routes
router.use(authenticateToken, isAdmin);

//NOTE - DASHBOARD ANALYTICS
router.get('/dashboard', async (req, res) => {
    try {
        const dashboardData = await adminService.getDashboardAnalytics();
        res.json({
            success: true,
            data: dashboardData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

//NOTE - USER MANAGEMENT
// Get all users with pagination and filters
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role, subscription } = req.query;
        const users = await adminService.getAllUsers({
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            role,
            subscription
        });

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Get specific user details
router.get('/users/:userId', async (req, res) => {
    try {
        const user = await adminService.getUserDetails(req.params.userId);
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Update user (ban/unban, change role, modify subscription)
router.put('/users/:userId', async (req, res) => {
    try {
        const updatedUser = await adminService.updateUser(req.params.userId, req.body);
        res.json({
            success: true,
            data: updatedUser,
            message: 'User updated successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Delete user account
router.delete('/users/:userId', async (req, res) => {
    try {
        await adminService.deleteUser(req.params.userId, req.user.id);
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Ban/Unban user
router.post('/users/:userId/ban', async (req, res) => {
    try {
        const { reason, duration } = req.body;
        const result = await adminService.banUser(req.params.userId, reason, duration, req.user.id);
        res.json({
            success: true,
            data: result,
            message: 'User banned successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

router.post('/users/:userId/unban', async (req, res) => {
    try {
        const result = await adminService.unbanUser(req.params.userId, req.user.id);
        res.json({
            success: true,
            data: result,
            message: 'User unbanned successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

//NOTE - CONVERSATION MANAGEMENT
// Get all conversations with filters
router.get('/conversations', async (req, res) => {
    try {
        const { page = 1, limit = 20, userId, aiMode, flagged } = req.query;
        const conversations = await adminService.getAllConversations({
            page: parseInt(page),
            limit: parseInt(limit),
            userId,
            aiMode,
            flagged: flagged === 'true'
        });

        res.json({
            success: true,
            data: conversations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Get specific conversation details
router.get('/conversations/:conversationId', async (req, res) => {
    try {
        const conversation = await adminService.getConversationDetails(req.params.conversationId);
        res.json({
            success: true,
            data: conversation
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Flag/Unflag conversation for review
router.post('/conversations/:conversationId/flag', async (req, res) => {
    try {
        const { reason } = req.body;
        const result = await adminService.flagConversation(req.params.conversationId, reason);
        res.json({
            success: true,
            data: result,
            message: 'Conversation flagged successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Delete conversation
router.delete('/conversations/:conversationId', async (req, res) => {
    try {
        await adminService.deleteConversation(req.params.conversationId);
        res.json({
            success: true,
            message: 'Conversation deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

//NOTE - SYSTEM MONITORING
// Get system statistics
router.get('/system/stats', async (req, res) => {
    try {
        const stats = await adminService.getSystemStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Get API usage statistics
router.get('/system/api-usage', async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;
        const usage = await adminService.getApiUsageStats({
            startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            endDate: endDate ? new Date(endDate) : new Date(),
            groupBy
        });

        res.json({
            success: true,
            data: usage
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Get error logs
router.get('/system/errors', async (req, res) => {
    try {
        const { page = 1, limit = 50, level } = req.query;
        const errors = await adminService.getErrorLogs({
            page: parseInt(page),
            limit: parseInt(limit),
            level
        });

        res.json({
            success: true,
            data: errors
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

//NOTE - CONTENT MODERATION
// Get flagged content
router.get('/moderation/flagged', async (req, res) => {
    try {
        const { page = 1, limit = 20, type } = req.query;
        const flaggedContent = await adminService.getFlaggedContent({
            page: parseInt(page),
            limit: parseInt(limit),
            type // 'conversation' or 'message'
        });

        res.json({
            success: true,
            data: flaggedContent
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Review flagged content
router.post('/moderation/review/:itemId', async (req, res) => {
    try {
        const { action, notes } = req.body; // action: 'approve', 'remove', 'ban_user'
        const result = await adminService.reviewFlaggedContent(
            req.params.itemId,
            action,
            notes,
            req.user.id
        );

        res.json({
            success: true,
            data: result,
            message: 'Content reviewed successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

//NOTE - SUBSCRIPTION MANAGEMENT
// Get subscription analytics
router.get('/subscriptions/analytics', async (req, res) => {
    try {
        const analytics = await adminService.getSubscriptionAnalytics();
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Update user subscription
router.put('/subscriptions/:userId', async (req, res) => {
    try {
        const { plan, features, expiresAt } = req.body;
        const result = await adminService.updateUserSubscription(req.params.userId, {
            plan,
            features,
            expiresAt
        });

        res.json({
            success: true,
            data: result,
            message: 'Subscription updated successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

//NOTE - BULK OPERATIONS
// Bulk user operations
router.post('/bulk/users', async (req, res) => {
    try {
        const { action, userIds, data } = req.body;
        const result = await adminService.bulkUserOperation(action, userIds, data);

        res.json({
            success: true,
            data: result,
            message: `Bulk ${action} completed successfully`
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Export user data
router.get('/export/users', async (req, res) => {
    try {
        const { format = 'csv', filters } = req.query;
        const exportData = await adminService.exportUserData(format, filters);

        res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=users_export_${Date.now()}.${format}`);
        res.send(exportData);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

//NOTE - SYSTEM SETTINGS
// Get system settings
router.get('/settings', async (req, res) => {
    try {
        const settings = await adminService.getSystemSettings();
        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Update system settings
router.put('/settings', async (req, res) => {
    try {
        const updatedSettings = await adminService.updateSystemSettings(req.body, req.user.id);
        res.json({
            success: true,
            data: updatedSettings,
            message: 'Settings updated successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

//NOTE - AUDIT LOGS
// Get audit logs
router.get('/audit-logs', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            action,
            performedBy,
            targetType,
            dateFrom,
            dateTo,
            success
        } = req.query;

        const filters = {};
        if (action) filters.action = action;
        if (performedBy) filters.performedBy = performedBy;
        if (targetType) filters.targetType = targetType;
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;
        if (success !== undefined) filters.success = success === 'true';

        const AuditLog = require('../models/auditLog');
        const result = await AuditLog.getAuditLogs(filters, {
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Get audit log statistics
router.get('/audit-logs/stats', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const AuditLog = require('../models/auditLog');

        const stats = await AuditLog.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 },
                    successCount: {
                        $sum: { $cond: ['$success', 1, 0] }
                    },
                    errorCount: {
                        $sum: { $cond: ['$success', 0, 1] }
                    }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        const totalLogs = await AuditLog.countDocuments({
            createdAt: { $gte: startDate }
        });

        res.json({
            success: true,
            data: {
                totalLogs,
                actionStats: stats,
                period: `${days} days`
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: error.message }
        });
    }
});

module.exports = router;