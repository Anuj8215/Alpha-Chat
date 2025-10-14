const winston = require('winston');

//NOTE - DEFINED LOG FORMAT
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

//NOTE - CREATED LOGGER INSTANCE
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    defaultMeta: { service: 'thynkchat-backend' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(
                    ({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`
                )
            )
        }),
        new winston.transports.File({ filename: "logs/error.log", level: 'error' }),
        new winston.transports.File({ filename: "logs/combined.log" }),
    ]
});

//NOTE - STREAM OBJECT FOR MORGAN INTEGRATION
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};
module.exports = logger;
