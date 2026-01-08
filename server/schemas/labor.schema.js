/**
 * Labor Operations validation schemas
 */
const { z } = require('zod');
const { dateString, id, optionalId, nonEmptyString, optionalString, money } = require('./common');

// Time string in HH:MM format
const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format');

// Datetime string in ISO format
const datetimeString = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/));

// ============================================
// SCHEDULE SCHEMAS
// ============================================

const createScheduleSchema = z.object({
  employee_id: id,
  schedule_date: dateString,
  shift_start: timeString,
  shift_end: timeString,
  break_minutes: z.coerce.number().int().nonnegative().default(0),
  position: optionalString,
  department: optionalString,
  notes: optionalString,
  created_by: optionalString,
});

const updateScheduleSchema = z.object({
  shift_start: timeString.optional(),
  shift_end: timeString.optional(),
  break_minutes: z.coerce.number().int().nonnegative().optional(),
  position: optionalString,
  department: optionalString,
  status: z.enum(['scheduled', 'confirmed', 'no_show', 'called_out']).optional(),
  notes: optionalString,
});

const scheduleQuerySchema = z.object({
  employee_id: z.coerce.number().int().positive().optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  department: optionalString,
  status: z.enum(['scheduled', 'confirmed', 'no_show', 'called_out']).optional(),
});

// ============================================
// TIMECLOCK SCHEMAS
// ============================================

const clockInSchema = z.object({
  employee_id: id,
  clock_in: datetimeString.optional(), // Defaults to now
  department: optionalString,
  position: optionalString,
  schedule_id: optionalId,
  notes: optionalString,
});

const clockOutSchema = z.object({
  clock_out: datetimeString.optional(), // Defaults to now
  notes: optionalString,
});

const breakSchema = z.object({
  action: z.enum(['start', 'end']),
});

const adjustTimeclockSchema = z.object({
  clock_in: datetimeString.optional(),
  clock_out: datetimeString.optional().nullable(),
  total_break_minutes: z.coerce.number().int().nonnegative().optional(),
  adjusted_by: nonEmptyString,
  adjustment_reason: nonEmptyString,
});

const timeclockQuerySchema = z.object({
  employee_id: z.coerce.number().int().positive().optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  status: z.enum(['active', 'completed', 'adjusted', 'approved']).optional(),
  department: optionalString,
});

// ============================================
// TIP SCHEMAS
// ============================================

const createTipRecordSchema = z.object({
  employee_id: id,
  shift_date: dateString,
  timeclock_entry_id: optionalId,
  cash_tips: z.coerce.number().nonnegative().default(0),
  credit_tips: z.coerce.number().nonnegative().default(0),
  tip_out_given: z.coerce.number().nonnegative().default(0),
  hours_worked: z.coerce.number().nonnegative().optional(),
  notes: optionalString,
});

const tipPoolSessionSchema = z.object({
  pool_date: dateString,
  pool_type: z.enum(['front_of_house', 'bar', 'kitchen', 'all_staff']),
  total_pool_amount: z.coerce.number().positive(),
  distribution_method: z.enum(['hours_worked', 'equal', 'points']),
  notes: optionalString,
});

const distributeTipPoolSchema = z.object({
  approved_by: nonEmptyString,
});

const tipQuerySchema = z.object({
  employee_id: z.coerce.number().int().positive().optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
});

// ============================================
// PAYROLL EXPORT SCHEMAS
// ============================================

const payrollExportSchema = z.object({
  start_date: dateString,
  end_date: dateString,
  include_tips: z.coerce.boolean().default(true),
  format: z.enum(['json', 'csv']).default('json'),
});

module.exports = {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleQuerySchema,
  clockInSchema,
  clockOutSchema,
  breakSchema,
  adjustTimeclockSchema,
  timeclockQuerySchema,
  createTipRecordSchema,
  tipPoolSessionSchema,
  distributeTipPoolSchema,
  tipQuerySchema,
  payrollExportSchema,
};

