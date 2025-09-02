const winston = require("winston");

// Configure Winston logger
const logger = winston.createLogger({
  level: "info", // Log level (can be info, error, warn, etc.)
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Log to console
    new winston.transports.Console(),
    // Log to a file
    new winston.transports.File({ filename: "logs/app.log" }),
  ],
});

// Export logger methods for use in other modules
module.exports = {
  info: (message) => logger.info(message),
  error: (message) => logger.error(message),
  warn: (message) => logger.warn(message),
};