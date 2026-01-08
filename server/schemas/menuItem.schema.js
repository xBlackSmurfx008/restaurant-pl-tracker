/**
 * Menu Item validation schemas
 */
const { z } = require('zod');
const { id, nonEmptyString, positiveMoney, money, percentage } = require('./common');

const createMenuItemSchema = z.object({
  name: nonEmptyString.max(255),
  selling_price: positiveMoney,
  q_factor: money.default(0),
  target_cost_percent: percentage.default(35),
  estimated_prep_time_minutes: money.default(0),
});

const updateMenuItemSchema = createMenuItemSchema.partial();

const addRecipeIngredientSchema = z.object({
  ingredient_id: id,
  quantity_used: z.coerce.number().positive(),
});

module.exports = {
  createMenuItemSchema,
  updateMenuItemSchema,
  addRecipeIngredientSchema,
};

