const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'user_created', 'user_updated', 'user_deleted', 'user_banned', 'user_unbanned',
            'conversation_created', 'conversation_deleted', 'conversation_flagged',
            'message_created', 'message_deleted', 'message_flagged',
            'admin_login', 'admin_logout', 'settings_updated',
            'bulk_operation', 'export_data', 'system_backup'
        ]
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targetType: {
        type: String,
        enum: ['user', 'conversation', 'message', 'system', 'settings'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false // Some actions don't have a specific target
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    ipAddress: {
        type: String,
        required: false
    },
    userAgent: {
        type: String,
        required: false
    },
    success: {
        type: Boolean,
        default: true
    },
    errorMessage: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ createdAt: -1 });

// Static method to log an action
auditLogSchema.statics.logAction = async function (actionData) {
    try {
        const log = new this(actionData);
        await log.save();
        return log;
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw error to prevent disrupting main operations
        return null;
    }
};

// Static method to get audit logs with filters
auditLogSchema.statics.getAuditLogs = async function (filters = {}, options = {}) {
    const {
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = -1
    } = options;

    const query = {};

    if (filters.performedBy) query.performedBy = filters.performedBy;
    if (filters.action) query.action = filters.action;
    if (filters.targetType) query.targetType = filters.targetType;
    if (filters.success !== undefined) query.success = filters.success;

    if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }

    const skip = (page - 1) * limit;

    const logs = await this.find(query)
        .populate('performedBy', 'firstName lastName email role')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean();

    const total = await this.countDocuments(query);

    return {
        logs,
        pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
        }
    };
};

module.exports = mongoose.model('AuditLog', auditLogSchema);