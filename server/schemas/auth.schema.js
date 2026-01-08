/**
 * Auth validation schemas
 */
const { z } = require('zod');
const { nonEmptyString, optionalString, optionalId, id } = require('./common');

const registerSchema = z.object({
  email: z.string().min(1), // Allow username or email for demo
  password: z.string().min(4, 'Password must be at least 4 characters'), // Relaxed for demo
  first_name: nonEmptyString.max(100),
  last_name: nonEmptyString.max(100),
  role: z.enum(['admin', 'manager', 'accountant', 'viewer', 'staff']).default('viewer'),
  employee_id: optionalId,
});

const loginSchema = z.object({
  email: z.string().min(1), // Allow username or email for demo
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
});

const updateUserSchema = z.object({
  first_name: nonEmptyString.max(100).optional(),
  last_name: nonEmptyString.max(100).optional(),
  role: z.enum(['admin', 'manager', 'accountant', 'viewer', 'staff']).optional(),
  employee_id: optionalId,
  is_active: z.boolean().optional(),
});

const userQuerySchema = z.object({
  role: z.enum(['admin', 'manager', 'accountant', 'viewer', 'staff']).optional(),
  is_active: z.coerce.boolean().optional(),
});

const auditLogQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  resource: optionalString,
  action: optionalString,
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateUserSchema,
  userQuerySchema,
  auditLogQuerySchema,
};

