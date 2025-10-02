//!SECTION - MONGO-DB DATABASE CONNECTION SETUP

const mongoose = require('mongoose');
const logger = require('../src/utils/logger');

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