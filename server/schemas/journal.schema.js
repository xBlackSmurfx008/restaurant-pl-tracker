/**
 * Journal / Ledger validation schemas
 */
const { z } = require('zod');
const { dateString, id, optionalId, nonEmptyString } = require('./common');

const journalLineSchema = z.object({
  account_id: id,
  debit: z.coerce.number().nonnegative().default(0),
  credit: z.coerce.number().nonnegative().default(0),
  description: z.string().trim().optional().nullable(),
}).refine(
  (l) => (l.debit > 0 && l.credit === 0) || (l.credit > 0 && l.debit === 0),
  { message: 'Each line must have either debit or credit (but not both)' }
);

const createJournalEntrySchema = z.object({
  entry_date: dateString,
  description: nonEmptyString.max(500),
  reference_type: z.string().trim().optional().nullable(),
  reference_id: optionalId.transform(v => v || null),
  is_adjusting: z.boolean().optional().default(false),
  is_closing: z.boolean().optional().default(false),
  fiscal_period_id: optionalId.transform(v => v || null),
  created_by: z.string().trim().optional().nullable(),
  lines: z.array(journalLineSchema).min(2),
});

const ledgerQuerySchema = z.object({
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const trialBalanceQuerySchema = z.object({
  as_of_date: dateString.optional(),
  include_zero: z.coerce.boolean().default(false),
});

const incomeStatementQuerySchema = z.object({
  start_date: dateString,
  end_date: dateString,
});

const balanceSheetQuerySchema = z.object({
  as_of_date: dateString,
});

const createFiscalPeriodSchema = z.object({
  period_type: z.enum(['month', 'quarter', 'year']),
  start_date: dateString,
  end_date: dateString,
  period_name: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

module.exports = {
  createJournalEntrySchema,
  ledgerQuerySchema,
  trialBalanceQuerySchema,
  incomeStatementQuerySchema,
  balanceSheetQuerySchema,
  createFiscalPeriodSchema,
};


