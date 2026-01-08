/**
 * Payroll validation schemas
 */
const { z } = require('zod');
const { dateString, id, optionalId, nonEmptyString, optionalString, money, phone, email, dateRangeSchema } = require('./common');

const payTypes = ['hourly', 'salary'];
const departments = ['kitchen', 'front', 'management', 'bar', 'delivery', 'other'];
const paymentMethods = ['direct_deposit', 'check', 'cash'];

// Employee schemas
const createEmployeeSchema = z.object({
  first_name: nonEmptyString.max(100),
  last_name: nonEmptyString.max(100),
  position: nonEmptyString.max(100),
  department: z.enum(departments).optional().nullable(),
  hire_date: dateString,
  pay_type: z.enum(payTypes),
  pay_rate: money,
  hours_per_week: z.coerce.number().min(0).max(168).optional().nullable(),
  ssn_last_four: z.string().length(4).regex(/^\d{4}$/).optional().nullable(),
  address: optionalString.transform(v => v || null),
  phone: phone.transform(v => v || null),
  email: email.transform(v => v || null),
  emergency_contact: optionalString.transform(v => v || null),
  notes: optionalString.transform(v => v || null),
});

const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  termination_date: dateString.optional().nullable(),
  is_active: z.boolean().optional(),
});

// Payroll record schemas
const createPayrollRecordSchema = z.object({
  employee_id: id,
  pay_period_start: dateString,
  pay_period_end: dateString,
  regular_hours: z.coerce.number().nonnegative().default(0),
  overtime_hours: z.coerce.number().nonnegative().default(0),
  tips_reported: money.default(0),
  gross_pay: money,
  federal_tax_withheld: money.default(0),
  state_tax_withheld: money.default(0),
  social_security_withheld: money.default(0),
  medicare_withheld: money.default(0),
  other_deductions: money.default(0),
  net_pay: money,
  employer_social_security: money.default(0),
  employer_medicare: money.default(0),
  employer_futa: money.default(0),
  employer_suta: money.default(0),
  total_employer_cost: money,
  payment_date: dateString.optional().nullable(),
  payment_method: z.enum(paymentMethods).optional().nullable(),
  check_number: optionalString.transform(v => v || null),
  notes: optionalString.transform(v => v || null),
});

// Run payroll schemas
const runPayrollSchema = z.object({
  pay_period_start: dateString,
  pay_period_end: dateString,
  payment_date: dateString.optional().nullable(),
  employee_hours: z.array(z.object({
    employee_id: id,
    regular_hours: z.coerce.number().nonnegative().default(0),
    overtime_hours: z.coerce.number().nonnegative().default(0),
    tips: money.default(0),
  })).min(1),
});

// Query schemas
const payrollQuerySchema = dateRangeSchema.extend({
  employee_id: optionalId,
  department: z.enum(departments).optional(),
});

const employeeQuerySchema = z.object({
  active_only: z.coerce.boolean().default(true),
});

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  createPayrollRecordSchema,
  runPayrollSchema,
  payrollQuerySchema,
  employeeQuerySchema,
  payTypes,
  departments,
  paymentMethods,
};

