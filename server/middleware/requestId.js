/**
 * Request ID middleware for request tracing
 */
const { v4: uuidv4 } = require('uuid');

/**
 * Adds a unique request ID to each request
 * Used for tracing requests through logs
 */
const requestId = (req, res, next) => {
  // Use existing request ID from header or generate new one
  req.id = req.headers['x-request-id'] || uuidv4();
  
  // Add to response headers for client correlation
  res.setHeader('x-request-id', req.id);
  
  next();
};

module.exports = requestId;

