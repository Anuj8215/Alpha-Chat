const AuditLog = require('../models/auditLog');

class AuditLogger {
    static async logUserAction(action, performedBy, targetId, details, req) {
        return await AuditLog.logAction({
            action,
            performedBy,
            targetType: 'user',
            targetId,
            details,
            ipAddress: this.getClientIP(req),
            userAgent: req ? req.get('User-Agent') : null
        });
    }

    static async logConversationAction(action, performedBy, targetId, details, req) {
        return await AuditLog.logAction({
            action,
            performedBy,
            targetType: 'conversation',
            targetId,
            details,
            ipAddress: this.getClientIP(req),
            userAgent: req ? req.get('User-Agent') : null
        });
    }

    static async logMessageAction(action, performedBy, targetId, details, req) {
        return await AuditLog.logAction({
            action,
            performedBy,
            targetType: 'message',
            targetId,
            details,
            ipAddress: this.getClientIP(req),
            userAgent: req ? req.get('User-Agent') : null
        });
    }

    static async logSystemAction(action, performedBy, details, req) {
        return await AuditLog.logAction({
            action,
            performedBy,
            targetType: 'system',
            details,
            ipAddress: this.getClientIP(req),
            userAgent: req ? req.get('User-Agent') : null
        });
    }

    static async logSettingsAction(action, performedBy, details, req) {
        return await AuditLog.logAction({
            action,
            performedBy,
            targetType: 'settings',
            details,
            ipAddress: this.getClientIP(req),
            userAgent: req ? req.get('User-Agent') : null
        });
    }

    static async logError(action, performedBy, error, req) {
        return await AuditLog.logAction({
            action,
            performedBy,
            targetType: 'system',
            success: false,
            errorMessage: error.message,
            details: { stack: error.stack },
            ipAddress: this.getClientIP(req),
            userAgent: req ? req.get('User-Agent') : null
        });
    }

    static getClientIP(req) {
        if (!req) return null;

        return req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
            req.headers['x-forwarded-for']?.split(',')[0] ||
            req.headers['x-real-ip'];
    }

    // Middleware to automatically log admin actions
    static createAuditMiddleware(action, targetType = 'system') {
        return async (req, res, next) => {
            const originalSend = res.send;

            res.send = function (data) {
                // Log the action after response is sent
                const success = res.statusCode < 400;
                const details = {
                    method: req.method,
                    url: req.originalUrl,
                    body: req.body,
                    params: req.params,
                    query: req.query,
                    statusCode: res.statusCode
                };

                AuditLog.logAction({
                    action,
                    performedBy: req.user?.id,
                    targetType,
                    targetId: req.params.userId || req.params.conversationId || req.params.messageId,
                    details,
                    success,
                    ipAddress: AuditLogger.getClientIP(req),
                    userAgent: req.get('User-Agent')
                });

                return originalSend.call(this, data);
            };

            next();
        };
    }
}

module.exports = AuditLogger;