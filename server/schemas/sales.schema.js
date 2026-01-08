/**
 * Sales validation schemas
 */
const { z } = require('zod');
const { dateString, id, dateRangeSchema } = require('./common');

const createSalesRecordSchema = z.object({
  date: dateString,
  menu_item_id: id,
  quantity_sold: z.coerce.number().int().nonnegative(),
});

const updateSalesRecordSchema = z.object({
  quantity_sold: z.coerce.number().int().nonnegative(),
});

const dailySalesSchema = z.object({
  date: dateString,
  sales: z.array(z.object({
    menu_item_id: id,
    quantity_sold: z.coerce.number().int().nonnegative(),
  })),
});

const addSalesSchema = z.object({
  date: dateString,
  menu_item_id: id,
  quantity_sold: z.coerce.number().int().positive(),
});

const salesQuerySchema = dateRangeSchema.extend({
  period: z.enum(['today', 'week', 'month', 'quarter', 'year', 'ytd']).optional(),
});

module.exports = {
  createSalesRecordSchema,
  updateSalesRecordSchema,
  dailySalesSchema,
  addSalesSchema,
  salesQuerySchema,
};

