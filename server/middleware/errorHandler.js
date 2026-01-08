/**
 * Centralized error handling middleware
 */
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { isProd } = require('../config');

/**
 * Handle 404 - Route not found
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.path,
  });
};

/**
 * Global error handler
 * Must have 4 parameters to be recognized as error middleware
 */
const errorHandler = (err, req, res, _next) => {
  // Log the error with request context
  const logContext = {
    error: err.message,
    code: err.code || 'INTERNAL_ERROR',
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
    requestId: req.id,
    ...(err.stack && !isProd && { stack: err.stack }),
  };

  // Log at appropriate level
  if (err.statusCode >= 500 || !err.statusCode) {
    logger.error(logContext, 'Request failed with error');
  } else if (err.statusCode >= 400) {
    logger.warn(logContext, 'Request failed with client error');
  }

  // Handle operational errors (expected errors)
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details }),
      ...(err.resource && { resource: err.resource }),
      requestId: req.id,
    });
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten(),
      requestId: req.id,
    });
  }

  // Handle PostgreSQL errors
  if (err.code && typeof err.code === 'string') {
    // Unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Resource already exists',
        code: 'CONFLICT',
        requestId: req.id,
      });
    }
    // Foreign key violation
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'Referenced resource does not exist',
        code: 'FOREIGN_KEY_VIOLATION',
        requestId: req.id,
      });
    }
    // Not null violation
    if (err.code === '23502') {
      return res.status(400).json({
        error: 'Required field is missing',
        code: 'NOT_NULL_VIOLATION',
        requestId: req.id,
      });
    }
  }

  // Handle unexpected errors
  // Don't leak internal error details in production
  res.status(500).json({
    error: isProd ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
    requestId: req.id,
    ...(! isProd && { stack: err.stack }),
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};

