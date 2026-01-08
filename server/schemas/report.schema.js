/**
 * Report validation schemas
 */
const { z } = require('zod');
const { dateString, dateRangeSchema } = require('./common');

const comparePeriods = ['previous_period', 'previous_year'];
const groupByOptions = ['category', 'type', 'vendor', 'month'];

const pnlQuerySchema = z.object({
  start_date: dateString,
  end_date: dateString,
  compare_period: z.enum(comparePeriods).optional(),
});

const taxExpenseQuerySchema = z.object({
  tax_year: z.coerce.number().int().min(2000).max(2100).optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
});

const cashFlowQuerySchema = z.object({
  start_date: dateString,
  end_date: dateString,
});

const vendorAnalysisQuerySchema = dateRangeSchema;

const budgetVsActualQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

const dailySummaryQuerySchema = dateRangeSchema;

const expenseSummaryQuerySchema = dateRangeSchema.extend({
  group_by: z.enum(groupByOptions).optional().default('category'),
});

module.exports = {
  pnlQuerySchema,
  taxExpenseQuerySchema,
  cashFlowQuerySchema,
  vendorAnalysisQuerySchema,
  budgetVsActualQuerySchema,
  dailySummaryQuerySchema,
  expenseSummaryQuerySchema,
  comparePeriods,
  groupByOptions,
};

