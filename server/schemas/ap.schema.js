/**
 * AP Automation validation schemas
 */
const { z } = require('zod');
const { dateString, id, optionalId, nonEmptyString, optionalString, money } = require('./common');

// ============================================
// AP INVOICE SCHEMAS
// ============================================

const apInvoiceLineSchema = z.object({
  line_number: z.coerce.number().int().positive().optional(),
  raw_vendor_code: optionalString,
  raw_description: nonEmptyString.max(500),
  quantity: z.coerce.number().positive().optional().nullable(),
  unit: optionalString,
  unit_price: z.coerce.number().nonnegative().optional().nullable(),
  line_total: z.coerce.number().nonnegative().optional().nullable(),
  mapped_ingredient_id: optionalId,
  mapped_category_id: optionalId,
  mapped_account_id: optionalId,
  notes: optionalString,
});

const createApInvoiceSchema = z.object({
  vendor_id: id,
  invoice_number: optionalString,
  invoice_date: dateString.optional(),
  due_date: dateString.optional(),
  terms: optionalString,
  subtotal: z.coerce.number().nonnegative().optional(),
  tax: z.coerce.number().nonnegative().optional(),
  shipping: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().nonnegative().optional(),
  document_id: optionalId,
  purchase_order_id: optionalId,
  notes: optionalString,
  lines: z.array(apInvoiceLineSchema).optional(),
});

const updateApInvoiceSchema = z.object({
  vendor_id: optionalId,
  invoice_number: optionalString,
  invoice_date: dateString.optional(),
  due_date: dateString.optional(),
  terms: optionalString,
  subtotal: z.coerce.number().nonnegative().optional(),
  tax: z.coerce.number().nonnegative().optional(),
  shipping: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().nonnegative().optional(),
  notes: optionalString,
});

const apInvoiceQuerySchema = z.object({
  vendor_id: z.coerce.number().int().positive().optional(),
  approval_status: z.enum(['pending', 'approved', 'rejected', 'hold']).optional(),
  posting_status: z.enum(['pending', 'posted', 'failed']).optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const approveInvoiceSchema = z.object({
  approved_by: nonEmptyString,
  notes: optionalString,
});

const rejectInvoiceSchema = z.object({
  rejected_by: nonEmptyString,
  reason: nonEmptyString,
});

// ============================================
// PAYMENT BATCH SCHEMAS
// ============================================

const paymentBatchItemSchema = z.object({
  accounts_payable_id: id,
  amount: z.coerce.number().positive(),
  notes: optionalString,
});

const createPaymentBatchSchema = z.object({
  batch_date: dateString.optional(),
  bank_account_id: optionalId,
  payment_method: z.enum(['check', 'ach', 'wire', 'card']).optional(),
  notes: optionalString,
  items: z.array(paymentBatchItemSchema).min(1),
});

const updatePaymentBatchSchema = z.object({
  batch_date: dateString.optional(),
  bank_account_id: optionalId,
  payment_method: z.enum(['check', 'ach', 'wire', 'card']).optional(),
  notes: optionalString,
});

const paymentBatchQuerySchema = z.object({
  status: z.enum(['draft', 'approved', 'processing', 'completed', 'cancelled']).optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const approveBatchSchema = z.object({
  approved_by: nonEmptyString,
});

const processBatchSchema = z.object({
  check_start_number: z.coerce.number().int().positive().optional(),
});

module.exports = {
  createApInvoiceSchema,
  updateApInvoiceSchema,
  apInvoiceQuerySchema,
  apInvoiceLineSchema,
  approveInvoiceSchema,
  rejectInvoiceSchema,
  createPaymentBatchSchema,
  updatePaymentBatchSchema,
  paymentBatchQuerySchema,
  approveBatchSchema,
  processBatchSchema,
};

