/**
 * Inventory validation schemas
 */
const { z } = require('zod');
const { dateString, id, optionalId, nonEmptyString, optionalString, money } = require('./common');

// ============================================
// PURCHASE ORDER SCHEMAS
// ============================================

const poItemSchema = z.object({
  ingredient_id: optionalId,
  description: nonEmptyString.max(500),
  quantity: z.coerce.number().positive(),
  unit: nonEmptyString.max(50),
  unit_price: z.coerce.number().nonnegative(),
  notes: optionalString,
});

const createPurchaseOrderSchema = z.object({
  vendor_id: id,
  order_date: dateString,
  expected_delivery: dateString.optional().nullable(),
  notes: optionalString,
  items: z.array(poItemSchema).min(1),
});

const updatePurchaseOrderSchema = z.object({
  order_date: dateString.optional(),
  expected_delivery: dateString.optional().nullable(),
  status: z.enum(['pending', 'ordered', 'partial', 'received', 'cancelled']).optional(),
  notes: optionalString,
});

const poQuerySchema = z.object({
  vendor_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'ordered', 'partial', 'received', 'cancelled']).optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ============================================
// RECEIVING SCHEMAS
// ============================================

const receiptLineSchema = z.object({
  po_item_id: id,
  ingredient_id: optionalId,
  quantity_received: z.coerce.number().positive(),
  unit: nonEmptyString.max(50),
  unit_cost: z.coerce.number().nonnegative(),
  condition: z.enum(['good', 'damaged', 'returned', 'short']).default('good'),
  notes: optionalString,
});

const createReceiptSchema = z.object({
  purchase_order_id: id,
  receipt_date: dateString.optional(), // Defaults to today
  received_by: optionalString,
  invoice_number: optionalString,
  invoice_total: z.coerce.number().nonnegative().optional().nullable(),
  notes: optionalString,
  lines: z.array(receiptLineSchema).min(1),
});

// ============================================
// INVENTORY MOVEMENT SCHEMAS
// ============================================

const movementTypes = z.enum([
  'receipt',
  'usage',
  'adjustment',
  'waste',
  'transfer_in',
  'transfer_out',
  'count_adjustment',
]);

const createMovementSchema = z.object({
  ingredient_id: id,
  movement_type: movementTypes,
  quantity: z.coerce.number(), // Can be negative for outbound
  unit: nonEmptyString.max(50),
  unit_cost: z.coerce.number().nonnegative().optional().nullable(),
  reference_type: optionalString,
  reference_id: optionalId,
  reason: optionalString,
  performed_by: optionalString,
  movement_date: dateString.optional(), // Defaults to today
  notes: optionalString,
});

const movementQuerySchema = z.object({
  ingredient_id: z.coerce.number().int().positive().optional(),
  movement_type: movementTypes.optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ============================================
// INVENTORY COUNT SCHEMAS
// ============================================

const countLineSchema = z.object({
  ingredient_id: id,
  quantity_on_hand: z.coerce.number().nonnegative(),
  unit: nonEmptyString.max(50),
  unit_cost: z.coerce.number().nonnegative().optional().nullable(),
  notes: optionalString,
});

const createCountSchema = z.object({
  count_date: dateString.optional(), // Defaults to today
  counted_by: optionalString,
  notes: optionalString,
  items: z.array(countLineSchema).min(1),
});

const countQuerySchema = z.object({
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  ingredient_id: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ============================================
// INVENTORY LEVEL SCHEMAS
// ============================================

const updateLevelSchema = z.object({
  reorder_point: z.coerce.number().nonnegative().optional().nullable(),
  reorder_quantity: z.coerce.number().nonnegative().optional().nullable(),
  par_level: z.coerce.number().nonnegative().optional().nullable(),
});

const levelQuerySchema = z.object({
  below_reorder: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

module.exports = {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  poQuerySchema,
  createReceiptSchema,
  createMovementSchema,
  movementQuerySchema,
  createCountSchema,
  countQuerySchema,
  updateLevelSchema,
  levelQuerySchema,
};

