//!SECTION - MONGO-DB DATABASE CONNECTION SETUP

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        logger.info('MongoDB connected successfully');
    } catch (error) {
        logger.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

//NOTE - HANDLE CONNECTION EVENTS

mongoose.connection.on('error', err => {
    logger.error(`MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
});

process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed due to app termination');
        process.exit(0);
    } catch (err) {
        logger.error(`Error during MongoDB disconnection: ${err.message}`);
        process.exit(1);
    }
});

module.exports = connectDB;