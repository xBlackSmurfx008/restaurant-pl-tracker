/**
 * Vendor Item Mapping Routes
 * Updated with centralized error handling and validation
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  createMappingSchema,
  updateMappingSchema,
  mappingQuerySchema,
  applyMappingsSchema,
  testMappingSchema,
} = require('../schemas/mapping.schema');

// Helper function to match rule against item
function matchesRule(rule, code, description) {
  const matchValue = rule.match_value;
  
  switch (rule.match_type) {
    case 'exact_code':
      return code && code.toLowerCase() === matchValue.toLowerCase();
    case 'exact_desc':
      return description && description.toLowerCase() === matchValue.toLowerCase();
    case 'contains':
      return (code && code.toLowerCase().includes(matchValue.toLowerCase())) ||
             (description && description.toLowerCase().includes(matchValue.toLowerCase()));
    case 'regex':
      try {
        const regex = new RegExp(matchValue, 'i');
        return regex.test(code || '') || regex.test(description || '');
      } catch {
        return false;
      }
    default:
      return false;
  }
}

// ============================================
// UNMATCHED LINE ITEMS
// ============================================

router.get('/unmatched/:expense_id', asyncHandler(async (req, res) => {
  const expenseId = parseInt(req.params.expense_id, 10);
  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return res.status(400).json({ error: 'Invalid expense_id', code: 'VALIDATION_ERROR' });
  }
  const lineItems = await db.promisify.all(`
    SELECT eli.*, e.vendor_id
    FROM expense_line_items eli
    JOIN expenses e ON eli.expense_id = e.id
    WHERE eli.expense_id = $1
      AND eli.mapped_ingredient_id IS NULL
      AND eli.mapped_category_id IS NULL
    ORDER BY eli.line_number, eli.id
  `, [expenseId]);

  res.json(lineItems);
}));

// ============================================
// MAPPING CRUD
// ============================================

router.get('/', validateQuery(mappingQuerySchema), asyncHandler(async (req, res) => {
  const { vendor_id, active } = req.query;

  let sql = `
    SELECT vim.*, v.name as vendor_name, i.name as ingredient_name, ec.name as category_name
    FROM vendor_item_mappings vim
    JOIN vendors v ON vim.vendor_id = v.id
    LEFT JOIN ingredients i ON vim.ingredient_id = i.id
    LEFT JOIN expense_categories ec ON vim.category_id = ec.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (vendor_id) { sql += ` AND vim.vendor_id = $${paramIndex++}`; params.push(vendor_id); }
  if (active !== undefined) { sql += ` AND vim.active = $${paramIndex++}`; params.push(active); }

  sql += ' ORDER BY vim.vendor_id, vim.match_value';
  const mappings = await db.promisify.all(sql, params);
  res.json(mappings);
}));

router.get('/:id', validateId, asyncHandler(async (req, res) => {
  const mapping = await db.promisify.get(`
    SELECT vim.*, v.name as vendor_name, i.name as ingredient_name, ec.name as category_name
    FROM vendor_item_mappings vim
    JOIN vendors v ON vim.vendor_id = v.id
    LEFT JOIN ingredients i ON vim.ingredient_id = i.id
    LEFT JOIN expense_categories ec ON vim.category_id = ec.id
    WHERE vim.id = $1
  `, [req.params.id]);

  if (!mapping) {throw new NotFoundError('Mapping');}
  res.json(mapping);
}));

router.post('/', validateBody(createMappingSchema), asyncHandler(async (req, res) => {
  const {
    vendor_id, match_type, match_value, normalized_label,
    ingredient_id, category_id
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO vendor_item_mappings (
      vendor_id, match_type, match_value, normalized_label,
      ingredient_id, category_id
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [vendor_id, match_type, match_value, normalized_label, ingredient_id, category_id]);

  const mapping = await db.promisify.get(`
    SELECT vim.*, v.name as vendor_name, i.name as ingredient_name, ec.name as category_name
    FROM vendor_item_mappings vim
    JOIN vendors v ON vim.vendor_id = v.id
    LEFT JOIN ingredients i ON vim.ingredient_id = i.id
    LEFT JOIN expense_categories ec ON vim.category_id = ec.id
    WHERE vim.id = $1
  `, [result.id]);

  res.status(201).json(mapping);
}));

router.put('/:id', validateId, validateBody(updateMappingSchema), asyncHandler(async (req, res) => {
  const {
    match_type, match_value, normalized_label,
    ingredient_id, category_id, active
  } = req.body;

  await db.promisify.run(`
    UPDATE vendor_item_mappings SET
      match_type = COALESCE($1, match_type),
      match_value = COALESCE($2, match_value),
      normalized_label = $3,
      ingredient_id = $4,
      category_id = $5,
      active = COALESCE($6, active)
    WHERE id = $7
  `, [match_type, match_value, normalized_label, ingredient_id, category_id, active, req.params.id]);

  const mapping = await db.promisify.get(`
    SELECT vim.*, v.name as vendor_name, i.name as ingredient_name, ec.name as category_name
    FROM vendor_item_mappings vim
    JOIN vendors v ON vim.vendor_id = v.id
    LEFT JOIN ingredients i ON vim.ingredient_id = i.id
    LEFT JOIN expense_categories ec ON vim.category_id = ec.id
    WHERE vim.id = $1
  `, [req.params.id]);

  if (!mapping) {throw new NotFoundError('Mapping');}
  res.json(mapping);
}));

router.delete('/:id', validateId, asyncHandler(async (req, res) => {
  const result = await db.promisify.run('DELETE FROM vendor_item_mappings WHERE id = $1', [req.params.id]);
  if (result.changes === 0) {throw new NotFoundError('Mapping');}
  res.json({ success: true, message: 'Mapping deleted' });
}));

// ============================================
// APPLY MAPPINGS
// ============================================

router.post('/apply', validateBody(applyMappingsSchema), asyncHandler(async (req, res) => {
  const { expense_id, line_item_ids } = req.body;

  // Get line items to process
  let lineItems;
  if (line_item_ids && line_item_ids.length > 0) {
    lineItems = await db.promisify.all(`
      SELECT eli.*, e.vendor_id
      FROM expense_line_items eli
      JOIN expenses e ON eli.expense_id = e.id
      WHERE eli.id = ANY($1::int[])
    `, [line_item_ids]);
  } else if (expense_id) {
    lineItems = await db.promisify.all(`
      SELECT eli.*, e.vendor_id
      FROM expense_line_items eli
      JOIN expenses e ON eli.expense_id = e.id
      WHERE eli.expense_id = $1
        AND eli.mapped_ingredient_id IS NULL
        AND eli.mapped_category_id IS NULL
    `, [expense_id]);
  } else {
    return res.json({ applied: 0, total: 0, results: [] });
  }

  if (lineItems.length === 0) {
    return res.json({ applied: 0, total: 0, results: [] });
  }

  // Get mappings for relevant vendors
  const vendorIds = [...new Set(lineItems.map(li => li.vendor_id).filter(Boolean))];
  let mappings = [];
  if (vendorIds.length > 0) {
    mappings = await db.promisify.all(`
      SELECT * FROM vendor_item_mappings
      WHERE vendor_id = ANY($1::int[]) AND active = true
      ORDER BY 
        CASE match_type 
          WHEN 'exact_code' THEN 1 
          WHEN 'exact_desc' THEN 2 
          WHEN 'contains' THEN 3 
          WHEN 'regex' THEN 4 
        END
    `, [vendorIds]);
  }

  const results = [];
  let appliedCount = 0;

  for (const item of lineItems) {
    const vendorMappings = mappings.filter(m => m.vendor_id === item.vendor_id);
    let matched = null;

    for (const mapping of vendorMappings) {
      if (matchesRule(mapping, item.raw_vendor_code, item.raw_description)) {
        matched = mapping;
        break;
      }
    }

    if (matched) {
      await db.promisify.run(`
        UPDATE expense_line_items SET
          mapped_ingredient_id = $1,
          mapped_category_id = $2,
          mapping_confidence = 1.0
        WHERE id = $3
      `, [matched.ingredient_id, matched.category_id, item.id]);

      appliedCount++;
      results.push({
        line_item_id: item.id,
        mapping_id: matched.id,
        matched: true,
        ingredient_id: matched.ingredient_id,
        category_id: matched.category_id
      });
    } else {
      results.push({
        line_item_id: item.id,
        matched: false
      });
    }
  }

  res.json({
    applied: appliedCount,
    total: lineItems.length,
    results
  });
}));

// ============================================
// TEST MAPPING
// ============================================

router.post('/test', validateBody(testMappingSchema), asyncHandler(async (req, res) => {
  const { match_type, match_value, test_code, test_description } = req.body;

  const rule = { match_type, match_value };
  const matches = matchesRule(rule, test_code, test_description);

  res.json({
    rule: { match_type, match_value },
    test_input: { code: test_code, description: test_description },
    matches
  });
}));

module.exports = router;
