/**
 * Expense validation schemas
 */
const { z } = require('zod');
const { dateString, id, optionalId, nonEmptyString, optionalString, money, dateRangeSchema } = require('./common');

const paymentMethods = ['cash', 'card', 'check', 'ach', 'credit', 'debit', 'other'];
const recurringFrequencies = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'];

const createExpenseSchema = z.object({
  expense_date: dateString,
  category_id: id,
  vendor_id: optionalId.transform(v => v || null),
  description: nonEmptyString.max(500),
  amount: money,
  payment_method: z.enum(paymentMethods).optional().nullable(),
  reference_number: optionalString.transform(v => v || null),
  is_recurring: z.boolean().optional().default(false),
  recurring_frequency: z.enum(recurringFrequencies).optional().nullable(),
  tax_deductible: z.boolean().optional().default(true),
  tax_category: optionalString.transform(v => v || null),
  notes: optionalString.transform(v => v || null),
});

const updateExpenseSchema = createExpenseSchema.partial();

const expenseQuerySchema = dateRangeSchema.extend({
  vendor_id: optionalId,
  category_id: optionalId,
  payment_method: z.enum(paymentMethods).optional(),
});

// Category schemas
const createCategorySchema = z.object({
  name: nonEmptyString.max(255),
  expense_type: z.enum(['cogs', 'operating', 'marketing', 'payroll', 'other']),
  parent_category_id: optionalId.transform(v => v || null),
  account_id: optionalId.transform(v => v || null),
  is_tax_deductible: z.boolean().optional().default(true),
  tax_category: optionalString.transform(v => v || null),
  description: optionalString.transform(v => v || null),
  budget_monthly: money.optional().nullable(),
});

const updateCategorySchema = createCategorySchema.partial().extend({
  is_active: z.boolean().optional(),
});

// Line item schemas
const createLineItemsSchema = z.object({
  items: z.array(z.object({
    line_number: z.coerce.number().int().positive().optional(),
    raw_vendor_code: optionalString,
    raw_description: optionalString.default('No description'),
    quantity: z.coerce.number().optional().nullable(),
    unit: optionalString,
    unit_price: money.optional().nullable(),
    line_total: money.optional().nullable(),
    notes: optionalString,
  })).min(1),
});

const updateLineItemSchema = z.object({
  raw_vendor_code: optionalString,
  raw_description: optionalString,
  quantity: z.coerce.number().optional().nullable(),
  unit: optionalString,
  unit_price: money.optional().nullable(),
  line_total: money.optional().nullable(),
  mapped_ingredient_id: optionalId,
  mapped_category_id: optionalId,
  mapping_confidence: z.coerce.number().min(0).max(1).optional(),
  notes: optionalString,
});

// Recurring expense schemas
const createRecurringExpenseSchema = z.object({
  name: nonEmptyString.max(255),
  category_id: id,
  vendor_id: optionalId.transform(v => v || null),
  description: optionalString.transform(v => v || null),
  amount: money,
  frequency: z.enum(recurringFrequencies),
  day_of_week: z.coerce.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.coerce.number().int().min(1).max(31).optional().nullable(),
  month_of_year: z.coerce.number().int().min(1).max(12).optional().nullable(),
  start_date: dateString,
  end_date: dateString.optional().nullable(),
  auto_create: z.boolean().optional().default(true),
  notes: optionalString.transform(v => v || null),
});

// Marketing expense schemas
const createMarketingExpenseSchema = z.object({
  expense_id: id,
  campaign_name: optionalString,
  marketing_channel: optionalString,
  platform: optionalString,
  target_audience: optionalString,
  start_date: dateString.optional().nullable(),
  end_date: dateString.optional().nullable(),
  impressions: z.coerce.number().int().nonnegative().optional().nullable(),
  clicks: z.coerce.number().int().nonnegative().optional().nullable(),
  conversions: z.coerce.number().int().nonnegative().optional().nullable(),
  roi_notes: optionalString,
});

module.exports = {
  createExpenseSchema,
  updateExpenseSchema,
  expenseQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  createLineItemsSchema,
  updateLineItemSchema,
  createRecurringExpenseSchema,
  createMarketingExpenseSchema,
  paymentMethods,
  recurringFrequencies,
};

