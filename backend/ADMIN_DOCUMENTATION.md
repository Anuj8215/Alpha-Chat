# Alpha Chat Admin System Documentation

## Overview
The Alpha Chat Admin System provides comprehensive administrative capabilities for managing users, conversations, system settings, and monitoring platform health. This system is designed to handle 50,000+ users with robust security, audit logging, and real-time analytics.

## Features

### 🎛️ **Dashboard Analytics**
- Real-time user statistics (total, active, new, banned)
- AI usage metrics (chat, code, image generation)
- Conversation and message analytics
- Subscription breakdown
- System health monitoring

### 👥 **User Management**
- View all users with pagination and filters
- Search users by name, email, or mobile
- Ban/unban users with reason tracking
- Update user roles and subscriptions
- Delete user accounts (with data cleanup)
- Bulk operations for multiple users

### 💬 **Conversation Management**
- Monitor all conversations across the platform
- Flag inappropriate content for review
- Delete conversations and associated messages
- Filter by user, AI mode, or flagged status

### 🔍 **Content Moderation**
- Review flagged conversations and messages
- Approve, remove, or ban users based on content
- Track moderation history and decisions

### ⚙️ **System Settings**
- Configure application-wide settings
- Manage AI service parameters
- Set user limits and quotas
- Security and authentication settings
- Payment and notification configurations

### 📊 **Audit Logging**
- Complete audit trail of all admin actions
- Track user bans, deletions, and updates
- Monitor system configuration changes
- Export audit logs for compliance

### 📈 **Analytics & Monitoring**
- API usage statistics with time-based grouping
- Error log analysis and filtering
- Storage usage monitoring
- Performance metrics

## API Endpoints

### Dashboard
```
GET /api/admin/dashboard
```
Returns comprehensive dashboard analytics including user stats, AI usage, and system health.

### User Management
```
GET    /api/admin/users                    # List all users
GET    /api/admin/users/:userId            # Get user details
PUT    /api/admin/users/:userId            # Update user
DELETE /api/admin/users/:userId            # Delete user
POST   /api/admin/users/:userId/ban        # Ban user
POST   /api/admin/users/:userId/unban      # Unban user
POST   /api/admin/bulk/users               # Bulk user operations
GET    /api/admin/export/users             # Export user data
```

### Conversation Management
```
GET    /api/admin/conversations            # List conversations
GET    /api/admin/conversations/:id        # Get conversation details
POST   /api/admin/conversations/:id/flag   # Flag conversation
DELETE /api/admin/conversations/:id        # Delete conversation
```

### Content Moderation
```
GET    /api/admin/moderation/flagged       # Get flagged content
POST   /api/admin/moderation/review/:id    # Review flagged content
```

### System Monitoring
```
GET    /api/admin/system/stats             # System statistics
GET    /api/admin/system/api-usage         # API usage stats
GET    /api/admin/system/errors            # Error logs
```

### Settings Management
```
GET    /api/admin/settings                 # Get system settings
PUT    /api/admin/settings                 # Update system settings
```

### Subscription Management
```
GET    /api/admin/subscriptions/analytics  # Subscription analytics
PUT    /api/admin/subscriptions/:userId    # Update user subscription
```

### Audit Logs
```
GET    /api/admin/audit-logs               # Get audit logs
GET    /api/admin/audit-logs/stats         # Audit statistics
```

## Authentication & Security

All admin endpoints require:
1. **Authentication**: Valid JWT token
2. **Authorization**: Admin role (`role: 'admin'`)
3. **Audit Logging**: All actions are automatically logged

### Setting Up an Admin User

To create an admin user, update a user's role in the database:
```javascript
// Using MongoDB directly or admin service
await User.findByIdAndUpdate(userId, { role: 'admin' });
```

## Usage Examples

### Getting Dashboard Data
```javascript
// GET /api/admin/dashboard
{
  "success": true,
  "data": {
    "users": {
      "total": 15420,
      "active": 8934,
      "new": 234,
      "banned": 12,
      "growth": "1.52"
    },
    "conversations": {
      "total": 45678,
      "active": 1234,
      "flagged": 5
    },
    "aiUsage": {
      "total": 2341,
      "chat": 1876,
      "code": 345,
      "image": 120,
      "video": 0
    }
  }
}
```

### Banning a User
```javascript
// POST /api/admin/users/user123/ban
{
  "reason": "Violation of terms of service",
  "duration": 7  // days, null for permanent
}

// Response
{
  "success": true,
  "data": {
    // Updated user object
  },
  "message": "User banned successfully"
}
```

### Bulk User Operations
```javascript
// POST /api/admin/bulk/users
{
  "action": "ban",
  "userIds": ["user1", "user2", "user3"],
  "data": {
    "reason": "Spam activity",
    "duration": 3,
    "performedBy": "admin123"
  }
}
```

### Updating System Settings
```javascript
// PUT /api/admin/settings
{
  "ai": {
    "defaultModel": "gpt-4",
    "maxTokensPerRequest": 4000
  },
  "limits": {
    "freeUserDailyMessages": 25,
    "premiumUserDailyMessages": 1000
  }
}
```

### Getting Audit Logs
```javascript
// GET /api/admin/audit-logs?action=user_banned&page=1&limit=20
{
  "success": true,
  "data": {
    "logs": [
      {
        "action": "user_banned",
        "performedBy": {
          "firstName": "Admin",
          "lastName": "User",
          "email": "admin@example.com"
        },
        "targetId": "user123",
        "details": {
          "reason": "Terms violation",
          "duration": 7
        },
        "createdAt": "2025-10-08T10:30:00Z"
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 5,
      "total": 100
    }
  }
}
```

## System Settings Categories

### General Settings
- `appName`: Application name
- `maintenanceMode`: Enable/disable maintenance mode
- `allowNewRegistrations`: Allow new user registrations
- `maxUsersPerSubscription`: Maximum users supported

### AI Settings
- `defaultModel`: Default AI model (gpt-3.5-turbo, gpt-4)
- `maxTokensPerRequest`: Maximum tokens per AI request
- `enableImageGeneration`: Enable/disable image generation
- `enableVideoGeneration`: Enable/disable video generation

### User Limits
- `freeUserDailyMessages`: Daily message limit for free users
- `premiumUserDailyMessages`: Daily message limit for premium users
- `maxFileUploadSize`: Maximum file upload size
- `maxConversationsPerUser`: Maximum conversations per user

### Security Settings
- `enableRateLimit`: Enable API rate limiting
- `maxLoginAttempts`: Maximum login attempts before lockout
- `sessionTimeout`: Session timeout in seconds
- `requireEmailVerification`: Require email verification

## Monitoring & Alerts

The admin system provides comprehensive monitoring:

### Health Checks
- Database connectivity
- Memory usage monitoring
- System uptime tracking
- Storage space monitoring

### Error Tracking
- Real-time error log monitoring
- Error categorization and filtering
- Performance bottleneck identification

### Usage Analytics
- API endpoint usage patterns
- Peak usage time identification
- Resource consumption tracking

## Best Practices

### Security
1. Regularly rotate admin credentials
2. Monitor audit logs for suspicious activity
3. Use HTTPS for all admin operations
4. Implement IP whitelisting for admin access

### Performance
1. Use pagination for large datasets
2. Implement caching for frequently accessed data
3. Monitor database query performance
4. Set appropriate rate limits

### Maintenance
1. Regular backup of audit logs
2. Periodic cleanup of old data
3. Monitor storage usage
4. Update system settings based on usage patterns

## Troubleshooting

### Common Issues

**Admin Access Denied**
- Verify user has `role: 'admin'`
- Check JWT token validity
- Ensure proper middleware order

**Audit Logs Not Appearing**
- Check database connectivity
- Verify AuditLogger is properly imported
- Monitor error logs for audit failures

**Performance Issues**
- Check database indexes
- Monitor memory usage
- Review pagination limits
- Optimize database queries

## Production Deployment

For production deployment:

1. **Environment Variables**
   ```env
   ADMIN_SESSION_TIMEOUT=3600
   AUDIT_LOG_RETENTION_DAYS=365
   MAX_ADMIN_SESSIONS=5
   ```

2. **Database Indexes**
   - Ensure proper indexing on audit logs
   - Index user search fields
   - Index conversation filters

3. **Monitoring Setup**
   - Set up alerts for system health
   - Monitor admin action frequency
   - Track API response times

4. **Backup Strategy**
   - Regular database backups
   - Audit log archival
   - Settings backup automation

This admin system provides enterprise-level management capabilities for your Alpha Chat application, ensuring smooth operations at scale while maintaining security and compliance requirements.