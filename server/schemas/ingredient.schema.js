/**
 * Ingredient validation schemas
 */
const { z } = require('zod');
const { optionalId, nonEmptyString, positiveMoney, decimalFactor } = require('./common');

const createIngredientSchema = z.object({
  vendor_id: optionalId.transform(v => v || null),
  name: nonEmptyString.max(255),
  purchase_price: positiveMoney,
  purchase_unit: nonEmptyString.max(50),
  usage_unit: nonEmptyString.max(50),
  unit_conversion_factor: z.coerce.number().positive(),
  yield_percent: decimalFactor.default(1.0),
});

const updateIngredientSchema = createIngredientSchema.partial();

const suggestConversionSchema = z.object({
  purchase_unit: nonEmptyString,
  usage_unit: nonEmptyString,
});

module.exports = {
  createIngredientSchema,
  updateIngredientSchema,
  suggestConversionSchema,
};

