/**
 * Common schema definitions used across multiple entities
 */
const { z } = require('zod');

// Date string in YYYY-MM-DD format
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// Optional date string
const optionalDateString = dateString.optional().nullable();

// Positive integer ID
const id = z.coerce.number().int().positive();

// Optional positive integer ID
const optionalId = z.coerce.number().int().positive().optional().nullable();

// Money amount (positive number with up to 2 decimal places)
const money = z.coerce.number().nonnegative();

// Positive money amount
const positiveMoney = z.coerce.number().positive();

// Percentage (0-100)
const percentage = z.coerce.number().min(0).max(100);

// Decimal factor (0-1)
const decimalFactor = z.coerce.number().min(0).max(1);

// Non-empty string
const nonEmptyString = z.string().min(1).trim();

// Optional non-empty string
const optionalString = z.string().trim().optional().nullable();

// Email
const email = z.string().email().optional().nullable();

// Phone
const phone = z.string().max(50).optional().nullable();

// Pagination params
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// Date range filter
const dateRangeSchema = z.object({
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  start: dateString.optional(),
  end: dateString.optional(),
});

// ID param schema
const idParamSchema = z.object({
  id: id,
});

module.exports = {
  dateString,
  optionalDateString,
  id,
  optionalId,
  money,
  positiveMoney,
  percentage,
  decimalFactor,
  nonEmptyString,
  optionalString,
  email,
  phone,
  paginationSchema,
  dateRangeSchema,
  idParamSchema,
};

