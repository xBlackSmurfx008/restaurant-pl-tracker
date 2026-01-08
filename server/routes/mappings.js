const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================
// VENDOR ITEM MAPPINGS ("Teach codes" system)
// ============================================

// ============================================
// STATIC ROUTES FIRST (before /:id)
// ============================================

/**
 * GET /api/mappings/unmatched/:expense_id
 * Get line items from an expense that have no mappings
 */
router.get('/unmatched/:expense_id', async (req, res) => {
  try {
    const lineItems = await db.promisify.all(`
      SELECT eli.*, e.vendor_id, v.name as vendor_name
      FROM expense_line_items eli
      JOIN expenses e ON eli.expense_id = e.id
      LEFT JOIN vendors v ON e.vendor_id = v.id
      WHERE eli.expense_id = $1
        AND eli.mapped_ingredient_id IS NULL
        AND eli.mapped_category_id IS NULL
      ORDER BY eli.line_number, eli.id
    `, [req.params.expense_id]);

    res.json(lineItems);
  } catch (error) {
    console.error('Get unmatched error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CRUD ROUTES
// ============================================

/**
 * GET /api/mappings
 * List all mappings (optionally filtered by vendor)
 */
router.get('/', async (req, res) => {
  try {
    const { vendor_id, active } = req.query;
    
    let sql = `
      SELECT 
        m.*,
        v.name as vendor_name,
        i.name as ingredient_name,
        ec.name as category_name
      FROM vendor_item_mappings m
      LEFT JOIN vendors v ON m.vendor_id = v.id
      LEFT JOIN ingredients i ON m.ingredient_id = i.id
      LEFT JOIN expense_categories ec ON m.category_id = ec.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (vendor_id) {
      sql += ` AND m.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }
    if (active !== undefined) {
      sql += ` AND m.active = $${paramIndex}`;
      params.push(active === 'true');
      paramIndex++;
    }

    sql += ' ORDER BY v.name, m.match_value';

    const mappings = await db.promisify.all(sql, params);
    res.json(mappings);
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mappings/:id
 * Get a single mapping
 */
router.get('/:id', async (req, res) => {
  try {
    const mapping = await db.promisify.get(`
      SELECT 
        m.*,
        v.name as vendor_name,
        i.name as ingredient_name,
        ec.name as category_name
      FROM vendor_item_mappings m
      LEFT JOIN vendors v ON m.vendor_id = v.id
      LEFT JOIN ingredients i ON m.ingredient_id = i.id
      LEFT JOIN expense_categories ec ON m.category_id = ec.id
      WHERE m.id = $1
    `, [req.params.id]);

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    res.json(mapping);
  } catch (error) {
    console.error('Get mapping error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mappings
 * Create a new mapping rule
 * 
 * Body: { vendor_id, match_type, match_value, normalized_label?, ingredient_id?, category_id? }
 */
router.post('/', async (req, res) => {
  try {
    const {
      vendor_id,
      match_type,
      match_value,
      normalized_label,
      ingredient_id,
      category_id
    } = req.body;

    if (!vendor_id || !match_type || !match_value) {
      return res.status(400).json({ 
        error: 'vendor_id, match_type, and match_value are required' 
      });
    }

    const validMatchTypes = ['exact_code', 'contains', 'regex', 'exact_desc'];
    if (!validMatchTypes.includes(match_type)) {
      return res.status(400).json({ 
        error: `match_type must be one of: ${validMatchTypes.join(', ')}` 
      });
    }

    const result = await db.promisify.run(`
      INSERT INTO vendor_item_mappings (
        vendor_id, match_type, match_value, normalized_label, ingredient_id, category_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      vendor_id,
      match_type,
      match_value,
      normalized_label || null,
      ingredient_id || null,
      category_id || null
    ]);

    const mapping = await db.promisify.get(`
      SELECT m.*, v.name as vendor_name, i.name as ingredient_name, ec.name as category_name
      FROM vendor_item_mappings m
      LEFT JOIN vendors v ON m.vendor_id = v.id
      LEFT JOIN ingredients i ON m.ingredient_id = i.id
      LEFT JOIN expense_categories ec ON m.category_id = ec.id
      WHERE m.id = $1
    `, [result.id]);

    res.status(201).json(mapping);
  } catch (error) {
    console.error('Create mapping error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/mappings/:id
 * Update a mapping
 */
router.put('/:id', async (req, res) => {
  try {
    const {
      match_type,
      match_value,
      normalized_label,
      ingredient_id,
      category_id,
      active
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
    `, [
      match_type,
      match_value,
      normalized_label || null,
      ingredient_id || null,
      category_id || null,
      active,
      req.params.id
    ]);

    const mapping = await db.promisify.get(`
      SELECT m.*, v.name as vendor_name, i.name as ingredient_name, ec.name as category_name
      FROM vendor_item_mappings m
      LEFT JOIN vendors v ON m.vendor_id = v.id
      LEFT JOIN ingredients i ON m.ingredient_id = i.id
      LEFT JOIN expense_categories ec ON m.category_id = ec.id
      WHERE m.id = $1
    `, [req.params.id]);

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    res.json(mapping);
  } catch (error) {
    console.error('Update mapping error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/mappings/:id
 * Delete a mapping
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.promisify.run(
      'DELETE FROM vendor_item_mappings WHERE id = $1',
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    res.json({ success: true, message: 'Mapping deleted' });
  } catch (error) {
    console.error('Delete mapping error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// APPLY MAPPINGS
// ============================================

/**
 * Apply a single mapping rule to a value
 */
function matchesRule(rule, code, description) {
  const value = rule.match_value;
  
  switch (rule.match_type) {
    case 'exact_code':
      return code && code.toLowerCase() === value.toLowerCase();
    case 'exact_desc':
      return description && description.toLowerCase() === value.toLowerCase();
    case 'contains':
      const target = code || description || '';
      return target.toLowerCase().includes(value.toLowerCase());
    case 'regex':
      try {
        const regex = new RegExp(value, 'i');
        return regex.test(code || '') || regex.test(description || '');
      } catch (e) {
        return false;
      }
    default:
      return false;
  }
}

/**
 * POST /api/mappings/apply
 * Apply all active mappings to line items of an expense
 * 
 * Body: { expense_id } or { line_item_ids: [...] }
 */
router.post('/apply', async (req, res) => {
  try {
    const { expense_id, line_item_ids } = req.body;

    if (!expense_id && (!line_item_ids || line_item_ids.length === 0)) {
      return res.status(400).json({ 
        error: 'expense_id or line_item_ids required' 
      });
    }

    // Get the line items to process
    let lineItems;
    if (expense_id) {
      lineItems = await db.promisify.all(`
        SELECT eli.*, e.vendor_id
        FROM expense_line_items eli
        JOIN expenses e ON eli.expense_id = e.id
        WHERE eli.expense_id = $1
      `, [expense_id]);
    } else {
      lineItems = await db.promisify.all(`
        SELECT eli.*, e.vendor_id
        FROM expense_line_items eli
        JOIN expenses e ON eli.expense_id = e.id
        WHERE eli.id = ANY($1::int[])
      `, [line_item_ids]);
    }

    if (lineItems.length === 0) {
      return res.json({ applied: 0, line_items: [] });
    }

    // Get vendor IDs from line items
    const vendorIds = [...new Set(lineItems.map(li => li.vendor_id).filter(Boolean))];

    // Get active mappings for these vendors
    const mappings = await db.promisify.all(`
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

    let appliedCount = 0;
    const results = [];

    for (const lineItem of lineItems) {
      // Find first matching rule (priority order is already sorted)
      const matchingRule = mappings.find(rule => 
        rule.vendor_id === lineItem.vendor_id &&
        matchesRule(rule, lineItem.raw_vendor_code, lineItem.raw_description)
      );

      if (matchingRule) {
        await db.promisify.run(`
          UPDATE expense_line_items SET
            mapped_ingredient_id = COALESCE($1, mapped_ingredient_id),
            mapped_category_id = COALESCE($2, mapped_category_id),
            mapping_confidence = 1.0
          WHERE id = $3
        `, [
          matchingRule.ingredient_id,
          matchingRule.category_id,
          lineItem.id
        ]);
        appliedCount++;
        results.push({
          line_item_id: lineItem.id,
          matched_rule_id: matchingRule.id,
          matched_by: matchingRule.match_type,
          normalized_label: matchingRule.normalized_label
        });
      } else {
        results.push({
          line_item_id: lineItem.id,
          matched_rule_id: null,
          unmatched: true
        });
      }
    }

    res.json({ 
      applied: appliedCount, 
      total: lineItems.length,
      results 
    });
  } catch (error) {
    console.error('Apply mappings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mappings/test
 * Test a mapping rule against a value (for UI preview)
 * 
 * Body: { match_type, match_value, test_code?, test_description? }
 */
router.post('/test', (req, res) => {
  try {
    const { match_type, match_value, test_code, test_description } = req.body;

    if (!match_type || !match_value) {
      return res.status(400).json({ error: 'match_type and match_value required' });
    }

    const rule = { match_type, match_value };
    const matches = matchesRule(rule, test_code, test_description);

    res.json({ matches });
  } catch (error) {
    console.error('Test mapping error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

