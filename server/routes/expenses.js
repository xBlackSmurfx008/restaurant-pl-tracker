const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================
// EXPENSES CRUD
// ============================================

/**
 * GET /api/expenses
 * List all expenses with filters
 * Query params: start, end, vendor_id, category_id, status
 */
router.get('/', async (req, res) => {
  try {
    const { start, end, vendor_id, category_id, payment_method } = req.query;
    
    let sql = `
      SELECT 
        e.*,
        v.name as vendor_name,
        ec.name as category_name,
        ec.expense_type,
        (SELECT COUNT(*) FROM expense_documents ed WHERE ed.expense_id = e.id) as document_count,
        (SELECT COUNT(*) FROM expense_line_items eli WHERE eli.expense_id = e.id) as line_item_count
      FROM expenses e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (start) {
      sql += ` AND e.expense_date >= $${paramIndex}`;
      params.push(start);
      paramIndex++;
    }
    if (end) {
      sql += ` AND e.expense_date <= $${paramIndex}`;
      params.push(end);
      paramIndex++;
    }
    if (vendor_id) {
      sql += ` AND e.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }
    if (category_id) {
      sql += ` AND e.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }
    if (payment_method) {
      sql += ` AND e.payment_method = $${paramIndex}`;
      params.push(payment_method);
      paramIndex++;
    }

    sql += ' ORDER BY e.expense_date DESC, e.id DESC';

    const expenses = await db.promisify.all(sql, params);
    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/expenses/:id
 * Get single expense with line items and documents
 */
router.get('/:id', async (req, res) => {
  try {
    const expense = await db.promisify.get(`
      SELECT 
        e.*,
        v.name as vendor_name,
        ec.name as category_name,
        ec.expense_type
      FROM expenses e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.id = $1
    `, [req.params.id]);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Get line items
    const lineItems = await db.promisify.all(`
      SELECT 
        eli.*,
        i.name as ingredient_name,
        ec.name as mapped_category_name
      FROM expense_line_items eli
      LEFT JOIN ingredients i ON eli.mapped_ingredient_id = i.id
      LEFT JOIN expense_categories ec ON eli.mapped_category_id = ec.id
      WHERE eli.expense_id = $1
      ORDER BY eli.line_number, eli.id
    `, [req.params.id]);

    // Get documents
    const documents = await db.promisify.all(`
      SELECT d.*
      FROM documents d
      JOIN expense_documents ed ON d.id = ed.document_id
      WHERE ed.expense_id = $1
      ORDER BY d.created_at DESC
    `, [req.params.id]);

    res.json({
      ...expense,
      line_items: lineItems,
      documents: documents
    });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/expenses
 * Create a new expense
 */
router.post('/', async (req, res) => {
  try {
    const {
      expense_date,
      category_id,
      vendor_id,
      description,
      amount,
      payment_method,
      reference_number,
      is_recurring,
      recurring_frequency,
      tax_deductible,
      tax_category,
      notes
    } = req.body;

    if (!expense_date || !category_id || !description || amount === undefined) {
      return res.status(400).json({ 
        error: 'expense_date, category_id, description, and amount are required' 
      });
    }

    const result = await db.promisify.run(`
      INSERT INTO expenses (
        expense_date, category_id, vendor_id, description, amount,
        payment_method, reference_number, is_recurring, recurring_frequency,
        tax_deductible, tax_category, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      expense_date,
      category_id,
      vendor_id || null,
      description,
      amount,
      payment_method || null,
      reference_number || null,
      is_recurring || false,
      recurring_frequency || null,
      tax_deductible !== false,
      tax_category || null,
      notes || null
    ]);

    const expense = await db.promisify.get(`
      SELECT e.*, v.name as vendor_name, ec.name as category_name
      FROM expenses e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.id = $1
    `, [result.id]);

    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/expenses/:id
 * Update an expense
 */
router.put('/:id', async (req, res) => {
  try {
    const {
      expense_date,
      category_id,
      vendor_id,
      description,
      amount,
      payment_method,
      reference_number,
      is_recurring,
      recurring_frequency,
      tax_deductible,
      tax_category,
      notes
    } = req.body;

    await db.promisify.run(`
      UPDATE expenses SET
        expense_date = COALESCE($1, expense_date),
        category_id = COALESCE($2, category_id),
        vendor_id = $3,
        description = COALESCE($4, description),
        amount = COALESCE($5, amount),
        payment_method = $6,
        reference_number = $7,
        is_recurring = COALESCE($8, is_recurring),
        recurring_frequency = $9,
        tax_deductible = COALESCE($10, tax_deductible),
        tax_category = $11,
        notes = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
    `, [
      expense_date,
      category_id,
      vendor_id || null,
      description,
      amount,
      payment_method || null,
      reference_number || null,
      is_recurring,
      recurring_frequency || null,
      tax_deductible,
      tax_category || null,
      notes || null,
      req.params.id
    ]);

    const expense = await db.promisify.get(`
      SELECT e.*, v.name as vendor_name, ec.name as category_name
      FROM expenses e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.id = $1
    `, [req.params.id]);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/expenses/:id
 * Delete an expense (cascades to line items and document links)
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.promisify.run(
      'DELETE FROM expenses WHERE id = $1',
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LINE ITEMS
// ============================================

/**
 * GET /api/expenses/:id/line-items
 * Get all line items for an expense
 */
router.get('/:id/line-items', async (req, res) => {
  try {
    const lineItems = await db.promisify.all(`
      SELECT 
        eli.*,
        i.name as ingredient_name,
        ec.name as mapped_category_name
      FROM expense_line_items eli
      LEFT JOIN ingredients i ON eli.mapped_ingredient_id = i.id
      LEFT JOIN expense_categories ec ON eli.mapped_category_id = ec.id
      WHERE eli.expense_id = $1
      ORDER BY eli.line_number, eli.id
    `, [req.params.id]);

    res.json(lineItems);
  } catch (error) {
    console.error('Get line items error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/expenses/:id/line-items
 * Add line items (bulk insert)
 * Body: { items: [{ raw_vendor_code, raw_description, quantity, unit, unit_price, line_total }] }
 */
router.post('/:id/line-items', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    // Verify expense exists
    const expense = await db.promisify.get(
      'SELECT id FROM expenses WHERE id = $1',
      [expenseId]
    );
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const insertedIds = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const result = await db.promisify.run(`
        INSERT INTO expense_line_items (
          expense_id, line_number, raw_vendor_code, raw_description,
          quantity, unit, unit_price, line_total, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        expenseId,
        item.line_number || i + 1,
        item.raw_vendor_code || null,
        item.raw_description || 'No description',
        item.quantity || null,
        item.unit || null,
        item.unit_price || null,
        item.line_total || null,
        item.notes || null
      ]);
      insertedIds.push(result.id);
    }

    // Return the inserted items
    const lineItems = await db.promisify.all(`
      SELECT * FROM expense_line_items 
      WHERE id = ANY($1::int[])
      ORDER BY line_number, id
    `, [insertedIds]);

    res.status(201).json(lineItems);
  } catch (error) {
    console.error('Create line items error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/expenses/line-items/:id
 * Update a single line item
 */
router.put('/line-items/:id', async (req, res) => {
  try {
    const {
      raw_vendor_code,
      raw_description,
      quantity,
      unit,
      unit_price,
      line_total,
      mapped_ingredient_id,
      mapped_category_id,
      mapping_confidence,
      notes
    } = req.body;

    await db.promisify.run(`
      UPDATE expense_line_items SET
        raw_vendor_code = COALESCE($1, raw_vendor_code),
        raw_description = COALESCE($2, raw_description),
        quantity = $3,
        unit = $4,
        unit_price = $5,
        line_total = $6,
        mapped_ingredient_id = $7,
        mapped_category_id = $8,
        mapping_confidence = COALESCE($9, mapping_confidence),
        notes = $10
      WHERE id = $11
    `, [
      raw_vendor_code,
      raw_description,
      quantity || null,
      unit || null,
      unit_price || null,
      line_total || null,
      mapped_ingredient_id || null,
      mapped_category_id || null,
      mapping_confidence,
      notes || null,
      req.params.id
    ]);

    const lineItem = await db.promisify.get(`
      SELECT eli.*, i.name as ingredient_name, ec.name as mapped_category_name
      FROM expense_line_items eli
      LEFT JOIN ingredients i ON eli.mapped_ingredient_id = i.id
      LEFT JOIN expense_categories ec ON eli.mapped_category_id = ec.id
      WHERE eli.id = $1
    `, [req.params.id]);

    if (!lineItem) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    res.json(lineItem);
  } catch (error) {
    console.error('Update line item error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/expenses/line-items/:id
 * Delete a single line item
 */
router.delete('/line-items/:id', async (req, res) => {
  try {
    const result = await db.promisify.run(
      'DELETE FROM expense_line_items WHERE id = $1',
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    res.json({ success: true, message: 'Line item deleted' });
  } catch (error) {
    console.error('Delete line item error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EXPENSE CATEGORIES
// ============================================

/**
 * GET /api/expenses/categories
 * Get all expense categories
 */
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await db.promisify.all(`
      SELECT * FROM expense_categories
      WHERE is_active = true
      ORDER BY expense_type, name
    `);
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/expenses/summary
 * Get expense summary by category for a date range
 */
router.get('/meta/summary', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let sql = `
      SELECT 
        ec.expense_type,
        ec.name as category_name,
        COUNT(e.id) as expense_count,
        SUM(e.amount) as total_amount
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (start) {
      sql += ` AND e.expense_date >= $${paramIndex}`;
      params.push(start);
      paramIndex++;
    }
    if (end) {
      sql += ` AND e.expense_date <= $${paramIndex}`;
      params.push(end);
      paramIndex++;
    }

    sql += ' GROUP BY ec.expense_type, ec.name ORDER BY ec.expense_type, total_amount DESC';

    const summary = await db.promisify.all(sql, params);
    res.json(summary);
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
