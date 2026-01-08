/**
 * Request validation middleware using Zod
 */
const { ValidationError } = require('../utils/errors');

/**
 * Create validation middleware for request body
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  
  if (!result.success) {
    const errors = result.error.flatten();
    throw new ValidationError('Validation failed', errors);
  }
  
  // Replace body with validated/transformed data
  req.body = result.data;
  next();
};

/**
 * Create validation middleware for query parameters
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  
  if (!result.success) {
    const errors = result.error.flatten();
    throw new ValidationError('Invalid query parameters', errors);
  }
  
  // Replace query with validated/transformed data
  req.query = result.data;
  next();
};

/**
 * Create validation middleware for route parameters
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  
  if (!result.success) {
    const errors = result.error.flatten();
    throw new ValidationError('Invalid route parameters', errors);
  }
  
  // Replace params with validated/transformed data
  req.params = result.data;
  next();
};

/**
 * Validate ID parameter (common case)
 */
const { z } = require('zod');
const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const validateId = validateParams(idParamSchema);

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  validateId,
};

