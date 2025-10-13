const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const logger = require('../utils/logger');


// Import routes
const authRoutes = require('../routes/auth');
const chatRoutes = require('../routes/chat');
const aiRoutes = require('../routes/ai');
const profileRoutes = require('../routes/profile');
const adminRoutes = require('../routes/admin');
const temporaryChatRoutes = require('../routes/temporaryChat');

const app = express();

app.use(helmet());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

//NOTE - SERVE STATIC FILES FROM PUBLIC DIRECTORY
app.use(express.static(path.join(__dirname, '../..', 'public')));

//NOTE - CORS CONFIGURATION

app.use(cors());

//NOTE - HTTP REQUEST LOGGING

app.use(morgan('combined', { stream: logger.stream }));

//NOTE - RATE LIMITING 

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    message: 'Too many requests from this IP, please try again later.'
})
app.use('/api/', apiLimiter);

//NOTE - HTML ROUTES FOR PASSWORD RESET PAGES
app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, '../..', 'public', 'forgot-password.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, '../..', 'public', 'reset-password.html'));
});

app.get('/reset-success', (req, res) => {
    res.sendFile(path.join(__dirname, '../..', 'public', 'reset-success.html'));
});

app.get('/reset-error', (req, res) => {
    res.sendFile(path.join(__dirname, '../..', 'public', 'reset-error.html'));
});

//NOTE - API ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/temporary-chat', temporaryChatRoutes);

//NOTE - BASIC ROUTE FOR HEALTH CHECK

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Health check successful' });
});

// 404 Not Found handler
app.use((req, res, next) => {
    res.status(404).json({
        error: {
            message: 'Resource not found'
        }
    });
});

app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: {
            message, ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
});



module.exports = app;
