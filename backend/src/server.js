//!SECTION - SERVER ENTRY POINT

require('dotenv').config();
const http = require('http');
const socketIO = require('socket.io');
const connectDb = require('./config/database');
const logger = require('./utils/logger');
const app = require('./config/app');

const PORT = process.env.PORT;

const server = http.createServer(app);

//NOTE - INITIALIZE SOCKET.IO

const io = socketIO(server, {
    cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST'],
    }
});

connectDb();

//NOTE - SOCKET.IO CONNECTION HANDLER

io.on('connection', (socket) => {
    logger.info('New client connected: ' + socket.id);

    socket.on('disconnect', () => {
        logger.info('Client disconnected: ' + socket.id);
    });
});

//NOTE - STARTING SERVER


server.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

});

process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    logger.error(err.stack);
    server.close(() => process.exit(1));
});
