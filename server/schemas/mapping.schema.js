/**
 * Vendor item mapping validation schemas
 */
const { z } = require('zod');
const { id, optionalId, nonEmptyString, optionalString } = require('./common');

const matchTypes = ['exact_code', 'contains', 'regex', 'exact_desc'];

const createMappingSchema = z.object({
  vendor_id: id,
  match_type: z.enum(matchTypes),
  match_value: nonEmptyString.max(500),
  normalized_label: optionalString.transform(v => v || null),
  ingredient_id: optionalId.transform(v => v || null),
  category_id: optionalId.transform(v => v || null),
});

const updateMappingSchema = z.object({
  match_type: z.enum(matchTypes).optional(),
  match_value: nonEmptyString.max(500).optional(),
  normalized_label: optionalString.transform(v => v || null),
  ingredient_id: optionalId.transform(v => v || null),
  category_id: optionalId.transform(v => v || null),
  active: z.boolean().optional(),
});

const mappingQuerySchema = z.object({
  vendor_id: optionalId,
  active: z.coerce.boolean().optional(),
});

const applyMappingsSchema = z.object({
  expense_id: optionalId,
  line_item_ids: z.array(id).optional(),
}).refine(
  (data) => data.expense_id || (data.line_item_ids && data.line_item_ids.length > 0),
  { message: 'Either expense_id or line_item_ids is required' }
);

const testMappingSchema = z.object({
  match_type: z.enum(matchTypes),
  match_value: nonEmptyString,
  test_code: optionalString,
  test_description: optionalString,
});

module.exports = {
  createMappingSchema,
  updateMappingSchema,
  mappingQuerySchema,
  applyMappingsSchema,
  testMappingSchema,
  matchTypes,
};

