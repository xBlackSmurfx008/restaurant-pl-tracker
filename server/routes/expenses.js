const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================
// IMPORTANT: Static routes MUST come before /:id routes!
// Express matches routes in order, so /meta/categories 
// must be defined before /:id or "meta" will be treated as an ID
// ============================================

// ============================================
// EXPENSE CATEGORIES (Static routes first!)
// ============================================

/**
 * GET /api/expenses/meta/categories
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
 * GET /api/expenses/meta/summary
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

/**
 * GET /api/expenses/categories/grouped
 * Get categories grouped by expense type
 */
router.get('/categories/grouped', async (req, res) => {
  try {
    const categories = await db.promisify.all(`
      SELECT * FROM expense_categories
      WHERE is_active = true
      ORDER BY expense_type, name
    `);

    // Group by expense_type
    const grouped = {};
    for (const cat of categories) {
      const type = cat.expense_type || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(cat);
    }

    res.json(grouped);
  } catch (error) {
    console.error('Get grouped categories error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/expenses/categories
 * Create expense category
 */
router.post('/categories', async (req, res) => {
  try {
    const {
      name, parent_category_id, expense_type, account_id,
      is_tax_deductible, tax_category, description, budget_monthly
    } = req.body;

    if (!name || !expense_type) {
      return res.status(400).json({ error: 'name and expense_type are required' });
    }

    const result = await db.promisify.run(`
      INSERT INTO expense_categories (
        name, parent_category_id, expense_type, account_id,
        is_tax_deductible, tax_category, description, budget_monthly
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      name, parent_category_id || null, expense_type, account_id || null,
      is_tax_deductible !== false, tax_category || null, description || null, budget_monthly || null
    ]);

    const category = await db.promisify.get('SELECT * FROM expense_categories WHERE id = $1', [result.id]);
    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/expenses/categories/:id
 * Update expense category
 */
router.put('/categories/:id', async (req, res) => {
  try {
    const {
      name, parent_category_id, expense_type, account_id,
      is_tax_deductible, tax_category, description, budget_monthly, is_active
    } = req.body;

    await db.promisify.run(`
      UPDATE expense_categories SET
        name = COALESCE($1, name),
        parent_category_id = $2,
        expense_type = COALESCE($3, expense_type),
        account_id = $4,
        is_tax_deductible = COALESCE($5, is_tax_deductible),
        tax_category = $6,
        description = $7,
        budget_monthly = $8,
        is_active = COALESCE($9, is_active)
      WHERE id = $10
    `, [
      name, parent_category_id, expense_type, account_id,
      is_tax_deductible, tax_category, description, budget_monthly, is_active,
      req.params.id
    ]);

    const category = await db.promisify.get('SELECT * FROM expense_categories WHERE id = $1', [req.params.id]);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/expenses/summary
 * Enhanced expense summary with grouping options
 */
router.get('/summary', async (req, res) => {
  try {
    const { start_date, end_date, group_by } = req.query;
    const groupBy = group_by || 'category';

    let sql;
    const params = [];
    let paramIndex = 1;
    let dateFilter = '';

    if (start_date) {
      dateFilter += ` AND e.expense_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      dateFilter += ` AND e.expense_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (groupBy === 'type') {
      sql = `
        SELECT 
          ec.expense_type as group_key,
          COUNT(e.id) as expense_count,
          SUM(e.amount) as total_amount
        FROM expenses e
        JOIN expense_categories ec ON e.category_id = ec.id
        WHERE 1=1 ${dateFilter}
        GROUP BY ec.expense_type
        ORDER BY total_amount DESC
      `;
    } else if (groupBy === 'vendor') {
      sql = `
        SELECT 
          COALESCE(v.name, 'No Vendor') as group_key,
          COUNT(e.id) as expense_count,
          SUM(e.amount) as total_amount
        FROM expenses e
        LEFT JOIN vendors v ON e.vendor_id = v.id
        WHERE 1=1 ${dateFilter}
        GROUP BY v.name
        ORDER BY total_amount DESC
      `;
    } else if (groupBy === 'month') {
      sql = `
        SELECT 
          TO_CHAR(e.expense_date, 'YYYY-MM') as group_key,
          COUNT(e.id) as expense_count,
          SUM(e.amount) as total_amount
        FROM expenses e
        WHERE 1=1 ${dateFilter}
        GROUP BY TO_CHAR(e.expense_date, 'YYYY-MM')
        ORDER BY group_key DESC
      `;
    } else {
      sql = `
        SELECT 
          ec.name as group_key,
          ec.expense_type,
          COUNT(e.id) as expense_count,
          SUM(e.amount) as total_amount
        FROM expenses e
        JOIN expense_categories ec ON e.category_id = ec.id
        WHERE 1=1 ${dateFilter}
        GROUP BY ec.name, ec.expense_type
        ORDER BY ec.expense_type, total_amount DESC
      `;
    }

    const summary = await db.promisify.all(sql, params);
    const grandTotal = summary.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);

    res.json({
      group_by: groupBy,
      period: { start_date, end_date },
      items: summary,
      grand_total: grandTotal
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MARKETING EXPENSES (Static routes)
// ============================================

/**
 * GET /api/expenses/marketing-summary
 * Get marketing expense summary with campaign details
 */
router.get('/marketing-summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      dateFilter += ` AND e.expense_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      dateFilter += ` AND e.expense_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    const byChannel = await db.promisify.all(`
      SELECT 
        COALESCE(me.marketing_channel, 'uncategorized') as channel,
        COUNT(e.id) as campaign_count,
        SUM(e.amount) as total_spent,
        SUM(me.impressions) as total_impressions,
        SUM(me.clicks) as total_clicks,
        SUM(me.conversions) as total_conversions
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN marketing_expenses me ON e.id = me.expense_id
      WHERE ec.expense_type = 'marketing' ${dateFilter}
      GROUP BY me.marketing_channel
      ORDER BY total_spent DESC
    `, params);

    const campaigns = await db.promisify.all(`
      SELECT 
        me.*,
        e.expense_date,
        e.amount,
        e.description
      FROM marketing_expenses me
      JOIN expenses e ON me.expense_id = e.id
      WHERE 1=1 ${dateFilter.replace(/e\./g, 'e.')}
      ORDER BY e.expense_date DESC
      LIMIT 20
    `, params);

    res.json({
      period: { start_date, end_date },
      by_channel: byChannel,
      recent_campaigns: campaigns,
      total_spent: byChannel.reduce((s, c) => s + parseFloat(c.total_spent || 0), 0)
    });
  } catch (error) {
    console.error('Marketing summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/expenses/marketing
 * Add marketing details to an expense
 */
router.post('/marketing', async (req, res) => {
  try {
    const {
      expense_id, campaign_name, marketing_channel, platform,
      target_audience, start_date, end_date,
      impressions, clicks, conversions, roi_notes
    } = req.body;

    if (!expense_id) {
      return res.status(400).json({ error: 'expense_id is required' });
    }

    const result = await db.promisify.run(`
      INSERT INTO marketing_expenses (
        expense_id, campaign_name, marketing_channel, platform,
        target_audience, start_date, end_date,
        impressions, clicks, conversions, roi_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      expense_id, campaign_name || null, marketing_channel || null, platform || null,
      target_audience || null, start_date || null, end_date || null,
      impressions || null, clicks || null, conversions || null, roi_notes || null
    ]);

    const marketing = await db.promisify.get('SELECT * FROM marketing_expenses WHERE id = $1', [result.id]);
    res.status(201).json(marketing);
  } catch (error) {
    console.error('Add marketing details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RECURRING EXPENSES (Static routes)
// ============================================

/**
 * GET /api/expenses/recurring
 * Get recurring expense templates
 */
router.get('/recurring', async (req, res) => {
  try {
    const templates = await db.promisify.all(`
      SELECT 
        ret.*,
        ec.name as category_name,
        v.name as vendor_name
      FROM recurring_expense_templates ret
      LEFT JOIN expense_categories ec ON ret.category_id = ec.id
      LEFT JOIN vendors v ON ret.vendor_id = v.id
      WHERE ret.is_active = true
      ORDER BY ret.next_due_date
    `);
    res.json(templates);
  } catch (error) {
    console.error('Get recurring expenses error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/expenses/recurring
 * Create recurring expense template
 */
router.post('/recurring', async (req, res) => {
  try {
    const {
      name, category_id, vendor_id, description, amount,
      frequency, day_of_week, day_of_month, month_of_year,
      start_date, end_date, auto_create, notes
    } = req.body;

    if (!name || !category_id || !amount || !frequency || !start_date) {
      return res.status(400).json({ 
        error: 'name, category_id, amount, frequency, and start_date are required' 
      });
    }

    // Calculate next due date
    let nextDueDate = start_date;

    const result = await db.promisify.run(`
      INSERT INTO recurring_expense_templates (
        name, category_id, vendor_id, description, amount,
        frequency, day_of_week, day_of_month, month_of_year,
        start_date, end_date, next_due_date, auto_create, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      name, category_id, vendor_id || null, description || null, amount,
      frequency, day_of_week || null, day_of_month || null, month_of_year || null,
      start_date, end_date || null, nextDueDate, auto_create !== false, notes || null
    ]);

    const template = await db.promisify.get(`
      SELECT ret.*, ec.name as category_name, v.name as vendor_name
      FROM recurring_expense_templates ret
      LEFT JOIN expense_categories ec ON ret.category_id = ec.id
      LEFT JOIN vendors v ON ret.vendor_id = v.id
      WHERE ret.id = $1
    `, [result.id]);

    res.status(201).json(template);
  } catch (error) {
    console.error('Create recurring expense error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/expenses/recurring/generate
 * Generate expenses from due recurring templates
 */
router.post('/recurring/generate', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get templates that are due
    const dueTemplates = await db.promisify.all(`
      SELECT * FROM recurring_expense_templates
      WHERE is_active = true
        AND auto_create = true
        AND next_due_date <= $1
        AND (end_date IS NULL OR end_date >= $1)
    `, [today]);

    const generated = [];

    for (const template of dueTemplates) {
      // Create the expense
      const result = await db.promisify.run(`
        INSERT INTO expenses (
          expense_date, category_id, vendor_id, description, amount,
          is_recurring, recurring_frequency, notes
        ) VALUES ($1, $2, $3, $4, $5, true, $6, $7)
      `, [
        template.next_due_date,
        template.category_id,
        template.vendor_id,
        template.description || template.name,
        template.amount,
        template.frequency,
        `Auto-generated from recurring template: ${template.name}`
      ]);

      // Calculate next due date
      let nextDate = new Date(template.next_due_date);
      switch (template.frequency) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'annual':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      // Update template
      await db.promisify.run(`
        UPDATE recurring_expense_templates SET
          last_generated_date = $1,
          next_due_date = $2
        WHERE id = $3
      `, [template.next_due_date, nextDate.toISOString().split('T')[0], template.id]);

      generated.push({
        template_id: template.id,
        template_name: template.name,
        expense_id: result.id,
        amount: template.amount
      });
    }

    res.json({
      generated_count: generated.length,
      expenses: generated,
      total_amount: generated.reduce((s, g) => s + parseFloat(g.amount), 0)
    });
  } catch (error) {
    console.error('Generate recurring expenses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LINE ITEMS (Static routes before /:id)
// ============================================

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
// EXPENSES CRUD (Dynamic :id routes LAST)
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

module.exports = router;
