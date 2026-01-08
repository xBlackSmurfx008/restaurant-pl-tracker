/**
 * Express application factory
 * Creates and configures the Express app
 */
const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');

const { corsOptions } = require('./config/cors');
const { logger } = require('./utils/logger');
const { requestId, errorHandler, notFoundHandler } = require('./middleware');

/**
 * Create and configure Express application
 * @returns {express.Application} Configured Express app
 */
function createApp() {
  const app = express();

  // ============================================
  // PRE-ROUTE MIDDLEWARE
  // ============================================
  
  // Request ID for tracing
  app.use(requestId);
  
  // HTTP request logging
  app.use(pinoHttp({
    logger,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) {return 'error';}
      if (res.statusCode >= 400) {return 'warn';}
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },
    // Don't log these paths
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
  }));
  
  // CORS
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  
  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ============================================
  // ROUTES - Core Restaurant Operations
  // ============================================
  app.use('/api/vendors', require('./routes/vendors'));
  app.use('/api/ingredients', require('./routes/ingredients'));
  app.use('/api/menu-items', require('./routes/menuItems'));
  app.use('/api/sales', require('./routes/sales'));

  // ============================================
  // ROUTES - Accounting & Finance
  // ============================================
  app.use('/api/expenses', require('./routes/expenses'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/tax', require('./routes/tax'));
  app.use('/api/payroll', require('./routes/payroll'));
  app.use('/api/accounting', require('./routes/accounting'));
  app.use('/api/ledger', require('./routes/ledger'));
  app.use('/api/ap', require('./routes/ap'));

  // ============================================
  // ROUTES - Inventory Management
  // ============================================
  app.use('/api/inventory', require('./routes/inventory'));

  // ============================================
  // ROUTES - Labor Operations
  // ============================================
  app.use('/api/labor', require('./routes/labor'));

  // ============================================
  // ROUTES - Authentication & Access Control
  // ============================================
  app.use('/api/auth', require('./routes/auth'));

  // ============================================
  // ROUTES - POS Integration
  // ============================================
  app.use('/api/pos', require('./routes/pos'));

  // ============================================
  // ROUTES - Other
  // ============================================
  app.use('/api/uploads', require('./routes/uploads'));
  app.use('/api/mappings', require('./routes/mappings'));

  // ============================================
  // HEALTH CHECK
  // ============================================
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Restaurant Accounting & P&L System API is running',
      version: '2.6.0',
      features: ['accounting', 'expenses', 'payroll', 'tax-prep', 'reports', 'pnl', 'gl-ledger', 'inventory', 'ap-automation', 'labor-ops', 'auth', 'pos-integration'],
      environment: process.env.NODE_ENV || 'development',
      requestId: req.id,
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================
  
  // 404 handler (must be before error handler)
  app.use(notFoundHandler);
  
  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

module.exports = createApp;

