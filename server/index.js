/**
 * Server entry point
 * Uses the app factory and starts the HTTP server
 */
const createApp = require('./app');
const { server: serverConfig } = require('./config');
const { logger, dbLogger } = require('./utils/logger');
const db = require('./db');

const app = createApp();
const PORT = serverConfig.port;

// Start server
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, '✅ Server running');
  logger.info({ url: `http://localhost:${PORT}/api` }, '📡 API available');
});

// Server error handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error({ port: PORT }, '❌ Port already in use');
    logger.error('Please free the port or change PORT in .env file');
    process.exit(1);
  } else {
    logger.error({ error: err.message }, 'Server error');
    process.exit(1);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info({ signal }, 'Received shutdown signal, closing gracefully...');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    if (db.pool) {
      try {
        await db.pool.end();
        dbLogger.info('Database connections closed');
      } catch (err) {
        dbLogger.error({ error: err.message }, 'Error closing database');
      }
    }
    
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.fatal({ error: err.message, stack: err.stack }, 'Uncaught Exception');
  process.exit(1);
});
