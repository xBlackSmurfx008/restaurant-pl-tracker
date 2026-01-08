/**
 * POS Integration validation schemas
 */
const { z } = require('zod');
const { dateString, id, optionalId, nonEmptyString, optionalString, money } = require('./common');

// ============================================
// POS CONFIGURATION SCHEMAS
// ============================================

const posProviders = z.enum(['square', 'toast', 'clover', 'revel', 'lightspeed', 'custom']);

const createPosConfigSchema = z.object({
  provider: posProviders,
  name: nonEmptyString.max(255),
  api_key: optionalString, // Will be encrypted before storage
  location_id: optionalString,
  webhook_secret: optionalString,
  settings: z.record(z.unknown()).optional(),
});

const updatePosConfigSchema = z.object({
  name: nonEmptyString.max(255).optional(),
  api_key: optionalString,
  location_id: optionalString,
  webhook_secret: optionalString,
  is_active: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

// ============================================
// TRANSACTION IMPORT SCHEMAS
// ============================================

const transactionItemSchema = z.object({
  external_item_id: optionalString,
  name: nonEmptyString.max(255),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative(),
  total_price: z.coerce.number().nonnegative(),
  category: optionalString,
  menu_item_id: optionalId,
  modifiers: z.record(z.unknown()).optional(),
});

const importTransactionSchema = z.object({
  external_id: nonEmptyString,
  transaction_date: z.string().datetime().or(dateString),
  transaction_type: z.enum(['sale', 'refund', 'void', 'exchange']).default('sale'),
  subtotal: z.coerce.number().nonnegative(),
  tax_amount: z.coerce.number().nonnegative().default(0),
  tip_amount: z.coerce.number().nonnegative().default(0),
  discount_amount: z.coerce.number().nonnegative().default(0),
  total_amount: z.coerce.number().nonnegative(),
  payment_method: z.enum(['cash', 'card', 'gift_card', 'split', 'other']).optional(),
  card_brand: optionalString,
  card_last_four: z.string().max(4).optional().nullable(),
  customer_name: optionalString,
  customer_email: z.string().email().optional().nullable(),
  employee_external_id: optionalString,
  items: z.array(transactionItemSchema).optional(),
  raw_data: z.record(z.unknown()).optional(),
});

const batchImportSchema = z.object({
  pos_config_id: id,
  transactions: z.array(importTransactionSchema).min(1).max(1000),
});

// ============================================
// SETTLEMENT SCHEMAS
// ============================================

const importSettlementSchema = z.object({
  pos_config_id: id,
  external_id: optionalString,
  settlement_date: dateString,
  cash_sales: z.coerce.number().nonnegative().default(0),
  card_sales: z.coerce.number().nonnegative().default(0),
  gift_card_sales: z.coerce.number().nonnegative().default(0),
  other_sales: z.coerce.number().nonnegative().default(0),
  total_sales: z.coerce.number().nonnegative(),
  total_refunds: z.coerce.number().nonnegative().default(0),
  total_discounts: z.coerce.number().nonnegative().default(0),
  total_tips: z.coerce.number().nonnegative().default(0),
  total_tax: z.coerce.number().nonnegative().default(0),
  net_sales: z.coerce.number().nonnegative(),
  transaction_count: z.coerce.number().int().nonnegative().default(0),
  raw_data: z.record(z.unknown()).optional(),
});

// ============================================
// QUERY SCHEMAS
// ============================================

const transactionQuerySchema = z.object({
  pos_config_id: z.coerce.number().int().positive().optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  transaction_type: z.enum(['sale', 'refund', 'void', 'exchange']).optional(),
  payment_method: z.enum(['cash', 'card', 'gift_card', 'split', 'other']).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const settlementQuerySchema = z.object({
  pos_config_id: z.coerce.number().int().positive().optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
});

module.exports = {
  createPosConfigSchema,
  updatePosConfigSchema,
  importTransactionSchema,
  batchImportSchema,
  importSettlementSchema,
  transactionQuerySchema,
  settlementQuerySchema,
  posProviders,
};

