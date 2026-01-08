/**
 * Structured logging with Pino
 */
const pino = require('pino');
const { app, isDev } = require('../config');

// Create logger instance
const logger = pino({
  level: app.logLevel,
  
  // Pretty print in development
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  
  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV || 'development',
  },
  
  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Redact sensitive fields
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'ssn_last_four'],
    remove: true,
  },
});

// Create child logger for specific contexts
const createLogger = (context) => {
  return logger.child({ context });
};

// Convenience loggers for common contexts
const dbLogger = createLogger('database');
const httpLogger = createLogger('http');
const serviceLogger = createLogger('service');

module.exports = {
  logger,
  createLogger,
  dbLogger,
  httpLogger,
  serviceLogger,
};

