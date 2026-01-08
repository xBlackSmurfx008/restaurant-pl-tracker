/**
 * Middleware exports
 */
const requestId = require('./requestId');
const { errorHandler, notFoundHandler } = require('./errorHandler');
const { validateBody, validateQuery, validateParams, validateId } = require('./validate');

module.exports = {
  requestId,
  errorHandler,
  notFoundHandler,
  validateBody,
  validateQuery,
  validateParams,
  validateId,
};

