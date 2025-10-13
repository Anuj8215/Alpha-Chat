//!SECTION - SCHEDULED TASKS FOR TEMPORARY CHAT CLEANUP

const temporaryChatService = require('../services/temporaryChat');
const logger = require('../utils/logger');

//NOTE - CLEANUP EXPIRED TEMPORARY CHATS EVERY HOUR
const scheduleCleanup = () => {
    const CLEANUP_INTERVAL = 60 * 60 * 1000;

    setInterval(async () => {
        try {
            logger.info('Starting scheduled cleanup of expired temporary chat sessions...');
            const deletedCount = await temporaryChatService.cleanupExpiredSessions();

            if (deletedCount > 0) {
                logger.info(`Scheduled cleanup completed: ${deletedCount} expired sessions removed`);
            } else {
                logger.info('Scheduled cleanup completed: No expired sessions found');
            }
        } catch (error) {
            logger.error(`Scheduled cleanup error: ${error.message}`);
        }
    }, CLEANUP_INTERVAL);

    logger.info('Temporary chat cleanup scheduler initialized (runs every hour)');
};

//NOTE - MANUAL CLEANUP FUNCTION (CAN BE CALLED ON SERVER START)
const runInitialCleanup = async () => {
    try {
        logger.info('Running initial cleanup of expired temporary chat sessions...');
        const deletedCount = await temporaryChatService.cleanupExpiredSessions();

        if (deletedCount > 0) {
            logger.info(`Initial cleanup completed: ${deletedCount} expired sessions removed`);
        } else {
            logger.info('Initial cleanup completed: No expired sessions found');
        }
    } catch (error) {
        logger.error(`Initial cleanup error: ${error.message}`);
    }
};

module.exports = {
    scheduleCleanup,
    runInitialCleanup
};