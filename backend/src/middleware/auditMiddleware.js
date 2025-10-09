const AuditLogger = require('../utils/auditLogger');

// Middleware to add audit logging to admin routes
const auditMiddleware = (action, targetType = 'system') => {
    return async (req, res, next) => {
        // Store original json method
        const originalJson = res.json;

        // Override json method to capture response
        res.json = function (body) {
            // Log the action
            const success = res.statusCode < 400;
            const details = {
                method: req.method,
                url: req.originalUrl,
                body: req.body,
                params: req.params,
                query: req.query,
                statusCode: res.statusCode,
                responseBody: success ? body : null
            };

            // Don't await this to avoid slowing down the response
            AuditLogger.logSystemAction(
                action,
                req.user?.id,
                details,
                req
            ).catch(err => {
                console.error('Failed to log audit action:', err);
            });

            // Call original json method
            return originalJson.call(this, body);
        };

        next();
    };
};

// Specific audit middleware for different actions
const auditUserAction = (action) => auditMiddleware(action, 'user');
const auditConversationAction = (action) => auditMiddleware(action, 'conversation');
const auditSystemAction = (action) => auditMiddleware(action, 'system');

module.exports = {
    auditMiddleware,
    auditUserAction,
    auditConversationAction,
    auditSystemAction
};