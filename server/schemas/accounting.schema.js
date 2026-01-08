/**
 * Accounting validation schemas
 */
const { z } = require('zod');
const { dateString, id, optionalId, nonEmptyString, optionalString, money, dateRangeSchema } = require('./common');

const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const bankAccountTypes = ['checking', 'savings', 'credit', 'other'];
const transactionTypes = ['deposit', 'withdrawal', 'transfer', 'fee', 'interest', 'adjustment'];
const apStatus = ['pending', 'partial', 'paid', 'overdue'];
const arStatus = ['pending', 'partial', 'paid', 'overdue'];

// Chart of Accounts schemas
const createAccountSchema = z.object({
  account_number: nonEmptyString.max(20),
  name: nonEmptyString.max(255),
  account_type: z.enum(accountTypes),
  sub_type: optionalString.transform(v => v || null),
  parent_account_id: optionalId.transform(v => v || null),
  is_tax_deductible: z.boolean().optional().default(false),
  tax_category: optionalString.transform(v => v || null),
  description: optionalString.transform(v => v || null),
});

const accountQuerySchema = z.object({
  account_type: z.enum(accountTypes).optional(),
  active_only: z.coerce.boolean().default(true),
});

// Accounts Payable schemas
const createPayableSchema = z.object({
  vendor_id: id,
  invoice_number: optionalString.transform(v => v || null),
  invoice_date: dateString,
  due_date: dateString,
  amount: money,
  expense_id: optionalId.transform(v => v || null),
  terms: optionalString.transform(v => v || null),
  notes: optionalString.transform(v => v || null),
});

const recordPaymentSchema = z.object({
  amount: money,
  payment_date: dateString.optional(),
  payment_method: optionalString,
  notes: optionalString,
});

const payableQuerySchema = z.object({
  status: z.enum(apStatus).optional(),
  vendor_id: optionalId,
  overdue_only: z.coerce.boolean().default(false),
});

// Accounts Receivable schemas
const createReceivableSchema = z.object({
  customer_name: nonEmptyString.max(255),
  customer_contact: optionalString.transform(v => v || null),
  invoice_number: optionalString.transform(v => v || null),
  invoice_date: dateString,
  due_date: dateString,
  amount: money,
  description: optionalString.transform(v => v || null),
  service_type: optionalString.transform(v => v || null),
  notes: optionalString.transform(v => v || null),
});

const receivableQuerySchema = z.object({
  status: z.enum(arStatus).optional(),
  service_type: optionalString,
  overdue_only: z.coerce.boolean().default(false),
});

// Bank Account schemas
const createBankAccountSchema = z.object({
  account_name: nonEmptyString.max(255),
  bank_name: optionalString.transform(v => v || null),
  account_type: z.enum(bankAccountTypes).default('checking'),
  account_number_last_four: z.string().length(4).regex(/^\d{4}$/).optional().nullable(),
  routing_number: optionalString.transform(v => v || null),
  opening_balance: money.default(0),
  is_primary: z.boolean().optional().default(false),
  notes: optionalString.transform(v => v || null),
});

// Bank Transaction schemas
const createBankTransactionSchema = z.object({
  transaction_date: dateString,
  transaction_type: z.enum(transactionTypes),
  description: nonEmptyString.max(500),
  amount: z.coerce.number(), // Can be negative for withdrawals
  expense_id: optionalId.transform(v => v || null),
  payroll_id: optionalId.transform(v => v || null),
  sales_date: dateString.optional().nullable(),
  reference_number: optionalString.transform(v => v || null),
});

const reconcileTransactionsSchema = z.object({
  transaction_ids: z.array(id).min(1),
  statement_ending_balance: money.optional(),
  statement_date: dateString.optional(),
});

const bankTransactionQuerySchema = dateRangeSchema.extend({
  reconciled: z.coerce.boolean().optional(),
});

// Daily Revenue schemas
const saveDailyRevenueSchema = z.object({
  date: dateString,
  food_sales: money.default(0),
  beverage_sales: money.default(0),
  alcohol_sales: money.default(0),
  catering_sales: money.default(0),
  gift_card_sales: money.default(0),
  other_sales: money.default(0),
  discounts: money.default(0),
  comps: money.default(0),
  refunds: money.default(0),
  tips_collected: money.default(0),
  cash_payments: money.default(0),
  card_payments: money.default(0),
  other_payments: money.default(0),
  transaction_count: z.coerce.number().int().nonnegative().default(0),
  customer_count: z.coerce.number().int().nonnegative().default(0),
  weather_notes: optionalString.transform(v => v || null),
  event_notes: optionalString.transform(v => v || null),
  notes: optionalString.transform(v => v || null),
});

const dailyRevenueQuerySchema = dateRangeSchema.extend({
  limit: z.coerce.number().int().positive().max(365).optional(),
});

// Business Settings schemas
const updateSettingSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.object({}).passthrough()]),
});

const updateSettingsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.object({}).passthrough()]));

module.exports = {
  createAccountSchema,
  accountQuerySchema,
  createPayableSchema,
  recordPaymentSchema,
  payableQuerySchema,
  createReceivableSchema,
  receivableQuerySchema,
  createBankAccountSchema,
  createBankTransactionSchema,
  reconcileTransactionsSchema,
  bankTransactionQuerySchema,
  saveDailyRevenueSchema,
  dailyRevenueQuerySchema,
  updateSettingSchema,
  updateSettingsSchema,
  accountTypes,
  bankAccountTypes,
  transactionTypes,
  apStatus,
  arStatus,
};

