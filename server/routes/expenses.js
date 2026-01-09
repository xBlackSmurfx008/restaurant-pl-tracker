/**
 * Expense Routes
 * Updated with centralized error handling and validation
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  createExpenseSchema,
  updateExpenseSchema,
  expenseQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  createLineItemsSchema,
  updateLineItemSchema,
  createRecurringExpenseSchema,
  createMarketingExpenseSchema,
} = require('../schemas/expense.schema');
const { expenseSummaryQuerySchema } = require('../schemas/report.schema');

// ============================================
// EXPENSE CATEGORIES (Static routes first!)
// ============================================

/**
 * GET /api/expenses/meta/categories
 */
router.get('/meta/categories', asyncHandler(async (req, res) => {
  const categories = await db.promisify.all(`
    SELECT * FROM expense_categories
    WHERE is_active = true
    ORDER BY expense_type, name
  `);
  res.json(categories);
}));

/**
 * POST /api/expenses/suggest-category
 * Auto-suggest category based on vendor and description
 */
router.post('/suggest-category', asyncHandler(async (req, res) => {
  const { vendor_id, description } = req.body;
  const descLower = (description || '').toLowerCase();
  
  // First check if we have previous expenses from this vendor
  if (vendor_id) {
    const vendorCategory = await db.promisify.get(`
      SELECT category_id, ec.name as category_name, ec.expense_type,
             COUNT(*) as usage_count
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.vendor_id = $1 AND ec.is_active = true
      GROUP BY category_id, ec.name, ec.expense_type
      ORDER BY usage_count DESC
      LIMIT 1
    `, [vendor_id]);
    
    if (vendorCategory) {
      return res.json({
        suggested_category_id: vendorCategory.category_id,
        category_name: vendorCategory.category_name,
        expense_type: vendorCategory.expense_type,
        confidence: 0.9,
        reason: 'Based on previous vendor purchases'
      });
    }
  }
  
  // Keyword-based matching
  const keywordRules = [
    // Food/COGS
    { keywords: ['food', 'produce', 'meat', 'dairy', 'seafood', 'grocery', 'ingredients', 'sysco', 'us foods', 'restaurant depot'], type: 'cogs', name: 'Food & Ingredients' },
    { keywords: ['beverage', 'drink', 'coffee', 'tea', 'soda', 'juice'], type: 'cogs', name: 'Beverages' },
    { keywords: ['alcohol', 'wine', 'beer', 'liquor', 'spirits'], type: 'cogs', name: 'Alcohol' },
    { keywords: ['packaging', 'container', 'box', 'bag', 'napkin', 'cup', 'lid', 'to-go', 'takeout'], type: 'cogs', name: 'Packaging & Supplies' },
    
    // Operating
    { keywords: ['rent', 'lease', 'mortgage'], type: 'operating', name: 'Rent & Lease' },
    { keywords: ['electric', 'power', 'utility', 'gas', 'water', 'sewage'], type: 'operating', name: 'Utilities' },
    { keywords: ['phone', 'internet', 'wifi', 'cable', 'communication'], type: 'operating', name: 'Communications' },
    { keywords: ['insurance', 'liability', 'coverage'], type: 'operating', name: 'Insurance' },
    { keywords: ['repair', 'maintenance', 'hvac', 'plumbing', 'fix'], type: 'operating', name: 'Repairs & Maintenance' },
    { keywords: ['cleaning', 'janitorial', 'sanitation', 'pest control'], type: 'operating', name: 'Cleaning & Sanitation' },
    { keywords: ['equipment', 'appliance', 'machine', 'oven', 'fryer', 'refrigerator'], type: 'operating', name: 'Equipment' },
    { keywords: ['license', 'permit', 'fee', 'certification'], type: 'operating', name: 'Licenses & Permits' },
    { keywords: ['pos', 'software', 'subscription', 'saas', 'square', 'toast'], type: 'operating', name: 'Software & Technology' },
    { keywords: ['office', 'supplies', 'paper', 'printer', 'ink'], type: 'operating', name: 'Office Supplies' },
    
    // Marketing
    { keywords: ['advertis', 'marketing', 'promo', 'social media', 'facebook', 'instagram', 'google ads', 'yelp'], type: 'marketing', name: 'Advertising' },
    { keywords: ['print', 'flyer', 'menu print', 'business card', 'signage', 'banner'], type: 'marketing', name: 'Print Materials' },
    { keywords: ['event', 'sponsor', 'catering promo', 'community'], type: 'marketing', name: 'Events & Sponsorships' },
    
    // Payroll
    { keywords: ['payroll', 'wage', 'salary', 'bonus', 'commission'], type: 'payroll', name: 'Wages & Salaries' },
    { keywords: ['payroll tax', 'fica', 'medicare', 'social security'], type: 'payroll', name: 'Payroll Taxes' },
    { keywords: ['health', 'dental', 'vision', 'benefit', '401k', 'retirement'], type: 'payroll', name: 'Benefits' },
    
    // Other
    { keywords: ['bank', 'processing', 'merchant', 'credit card fee'], type: 'other', name: 'Bank & Card Fees' },
    { keywords: ['legal', 'attorney', 'lawyer', 'consulting'], type: 'other', name: 'Professional Services' },
    { keywords: ['accounting', 'bookkeep', 'cpa', 'tax prep'], type: 'other', name: 'Accounting' },
  ];
  
  for (const rule of keywordRules) {
    const matchedKeyword = rule.keywords.find(kw => descLower.includes(kw));
    if (matchedKeyword) {
      // Find or create category
      let category = await db.promisify.get(`
        SELECT id, name, expense_type FROM expense_categories 
        WHERE LOWER(name) = LOWER($1) AND is_active = true
      `, [rule.name]);
      
      if (!category) {
        // Try partial match
        category = await db.promisify.get(`
          SELECT id, name, expense_type FROM expense_categories 
          WHERE expense_type = $1 AND is_active = true
          ORDER BY id LIMIT 1
        `, [rule.type]);
      }
      
      if (category) {
        return res.json({
          suggested_category_id: category.id,
          category_name: category.name,
          expense_type: category.expense_type,
          confidence: 0.7,
          reason: `Keyword match: "${matchedKeyword}"`
        });
      }
    }
  }
  
  // No match found
  res.json({
    suggested_category_id: null,
    category_name: null,
    expense_type: null,
    confidence: 0,
    reason: 'No automatic category match found'
  });
}));

/**
 * GET /api/expenses/dashboard
 * Get expense dashboard data with breakdowns
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  
  let dateFilter = '';
  const params = [];
  let paramIndex = 1;
  
  if (start) {
    dateFilter += ` AND e.expense_date >= $${paramIndex++}`;
    params.push(start);
  }
  if (end) {
    dateFilter += ` AND e.expense_date <= $${paramIndex++}`;
    params.push(end);
  }
  
  // Get totals by expense type (COGS, Operating, Marketing, Payroll, Other)
  const byType = await db.promisify.all(`
    SELECT 
      ec.expense_type,
      COUNT(e.id) as expense_count,
      SUM(e.amount) as total_amount,
      AVG(e.amount) as avg_amount
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    WHERE 1=1 ${dateFilter}
    GROUP BY ec.expense_type
    ORDER BY total_amount DESC
  `, params);
  
  // Get totals by category
  const byCategory = await db.promisify.all(`
    SELECT 
      ec.id as category_id,
      ec.name as category_name,
      ec.expense_type,
      COUNT(e.id) as expense_count,
      SUM(e.amount) as total_amount,
      ec.budget_monthly
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    WHERE 1=1 ${dateFilter}
    GROUP BY ec.id, ec.name, ec.expense_type, ec.budget_monthly
    ORDER BY total_amount DESC
  `, params);
  
  // Get totals by vendor
  const byVendor = await db.promisify.all(`
    SELECT 
      v.id as vendor_id,
      COALESCE(v.name, 'No Vendor') as vendor_name,
      COUNT(e.id) as expense_count,
      SUM(e.amount) as total_amount
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    WHERE 1=1 ${dateFilter}
    GROUP BY v.id, v.name
    ORDER BY total_amount DESC
    LIMIT 10
  `, params);
  
  // Get daily trend
  const dailyTrend = await db.promisify.all(`
    SELECT 
      e.expense_date::date as date,
      SUM(e.amount) as total_amount,
      COUNT(e.id) as expense_count
    FROM expenses e
    WHERE 1=1 ${dateFilter}
    GROUP BY e.expense_date::date
    ORDER BY date
  `, params);
  
  // Get uncategorized or needs-attention expenses
  const needsAttention = await db.promisify.all(`
    SELECT e.id, e.expense_date, e.description, e.amount, v.name as vendor_name,
           ec.name as category_name
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    WHERE (e.category_id IS NULL OR ec.expense_type = 'other') ${dateFilter}
    ORDER BY e.expense_date DESC
    LIMIT 10
  `, params);
  
  // Calculate grand total
  const grandTotal = byType.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);
  
  // Add percentages
  const byTypeWithPercent = byType.map(t => ({
    ...t,
    total_amount: parseFloat(t.total_amount || 0),
    percent_of_total: grandTotal > 0 ? ((parseFloat(t.total_amount || 0) / grandTotal) * 100).toFixed(1) : 0
  }));
  
  const byCategoryWithPercent = byCategory.map(c => ({
    ...c,
    total_amount: parseFloat(c.total_amount || 0),
    percent_of_total: grandTotal > 0 ? ((parseFloat(c.total_amount || 0) / grandTotal) * 100).toFixed(1) : 0,
    budget_status: c.budget_monthly ? (parseFloat(c.total_amount || 0) / parseFloat(c.budget_monthly) * 100).toFixed(0) : null
  }));
  
  res.json({
    period: { start, end },
    grand_total: grandTotal,
    by_type: byTypeWithPercent,
    by_category: byCategoryWithPercent,
    by_vendor: byVendor.map(v => ({
      ...v,
      total_amount: parseFloat(v.total_amount || 0),
      percent_of_total: grandTotal > 0 ? ((parseFloat(v.total_amount || 0) / grandTotal) * 100).toFixed(1) : 0
    })),
    daily_trend: dailyTrend,
    needs_attention: needsAttention
  });
}));

/**
 * GET /api/expenses/meta/summary
 */
router.get('/meta/summary', asyncHandler(async (req, res) => {
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
    sql += ` AND e.expense_date >= $${paramIndex++}`;
    params.push(start);
  }
  if (end) {
    sql += ` AND e.expense_date <= $${paramIndex++}`;
    params.push(end);
  }

  sql += ' GROUP BY ec.expense_type, ec.name ORDER BY ec.expense_type, total_amount DESC';
  const summary = await db.promisify.all(sql, params);
  res.json(summary);
}));

/**
 * GET /api/expenses/categories/grouped
 */
router.get('/categories/grouped', asyncHandler(async (req, res) => {
  const categories = await db.promisify.all(`
    SELECT * FROM expense_categories
    WHERE is_active = true
    ORDER BY expense_type, name
  `);

  const grouped = {};
  for (const cat of categories) {
    const type = cat.expense_type || 'other';
    if (!grouped[type]) {grouped[type] = [];}
    grouped[type].push(cat);
  }

  res.json(grouped);
}));

/**
 * POST /api/expenses/categories
 */
router.post('/categories', validateBody(createCategorySchema), asyncHandler(async (req, res) => {
  const {
    name, parent_category_id, expense_type, account_id,
    is_tax_deductible, tax_category, description, budget_monthly
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO expense_categories (
      name, parent_category_id, expense_type, account_id,
      is_tax_deductible, tax_category, description, budget_monthly
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    name, parent_category_id, expense_type, account_id,
    is_tax_deductible, tax_category, description, budget_monthly
  ]);

  const category = await db.promisify.get('SELECT * FROM expense_categories WHERE id = $1', [result.id]);
  res.status(201).json(category);
}));

/**
 * PUT /api/expenses/categories/:id
 */
router.put('/categories/:id', validateId, validateBody(updateCategorySchema), asyncHandler(async (req, res) => {
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
  if (!category) {throw new NotFoundError('Category');}
  res.json(category);
}));

/**
 * GET /api/expenses/summary
 */
router.get('/summary', validateQuery(expenseSummaryQuerySchema), asyncHandler(async (req, res) => {
  const { start_date, end_date, group_by = 'category' } = req.query;

  let sql;
  const params = [];
  let paramIndex = 1;
  let dateFilter = '';

  if (start_date) {
    dateFilter += ` AND e.expense_date >= $${paramIndex++}`;
    params.push(start_date);
  }
  if (end_date) {
    dateFilter += ` AND e.expense_date <= $${paramIndex++}`;
    params.push(end_date);
  }

  switch (group_by) {
    case 'type':
      sql = `
        SELECT ec.expense_type as group_key, COUNT(e.id) as expense_count, SUM(e.amount) as total_amount
        FROM expenses e JOIN expense_categories ec ON e.category_id = ec.id
        WHERE 1=1 ${dateFilter}
        GROUP BY ec.expense_type ORDER BY total_amount DESC
      `;
      break;
    case 'vendor':
      sql = `
        SELECT COALESCE(v.name, 'No Vendor') as group_key, COUNT(e.id) as expense_count, SUM(e.amount) as total_amount
        FROM expenses e LEFT JOIN vendors v ON e.vendor_id = v.id
        WHERE 1=1 ${dateFilter}
        GROUP BY v.name ORDER BY total_amount DESC
      `;
      break;
    case 'month':
      sql = `
        SELECT TO_CHAR(e.expense_date, 'YYYY-MM') as group_key, COUNT(e.id) as expense_count, SUM(e.amount) as total_amount
        FROM expenses e
        WHERE 1=1 ${dateFilter}
        GROUP BY TO_CHAR(e.expense_date, 'YYYY-MM') ORDER BY group_key DESC
      `;
      break;
    default:
      sql = `
        SELECT ec.name as group_key, ec.expense_type, COUNT(e.id) as expense_count, SUM(e.amount) as total_amount
        FROM expenses e JOIN expense_categories ec ON e.category_id = ec.id
        WHERE 1=1 ${dateFilter}
        GROUP BY ec.name, ec.expense_type ORDER BY ec.expense_type, total_amount DESC
      `;
  }

  const summary = await db.promisify.all(sql, params);
  const grandTotal = summary.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);

  res.json({
    group_by,
    period: { start_date, end_date },
    items: summary,
    grand_total: grandTotal
  });
}));

// ============================================
// MARKETING EXPENSES
// ============================================

router.get('/marketing-summary', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  let dateFilter = '';
  const params = [];
  let paramIndex = 1;

  if (start_date) {
    dateFilter += ` AND e.expense_date >= $${paramIndex++}`;
    params.push(start_date);
  }
  if (end_date) {
    dateFilter += ` AND e.expense_date <= $${paramIndex++}`;
    params.push(end_date);
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
    SELECT me.*, e.expense_date, e.amount, e.description
    FROM marketing_expenses me
    JOIN expenses e ON me.expense_id = e.id
    WHERE 1=1 ${dateFilter.replace(/e\./g, 'e.')}
    ORDER BY e.expense_date DESC LIMIT 20
  `, params);

  res.json({
    period: { start_date, end_date },
    by_channel: byChannel,
    recent_campaigns: campaigns,
    total_spent: byChannel.reduce((s, c) => s + parseFloat(c.total_spent || 0), 0)
  });
}));

router.post('/marketing', validateBody(createMarketingExpenseSchema), asyncHandler(async (req, res) => {
  const {
    expense_id, campaign_name, marketing_channel, platform,
    target_audience, start_date, end_date,
    impressions, clicks, conversions, roi_notes
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO marketing_expenses (
      expense_id, campaign_name, marketing_channel, platform,
      target_audience, start_date, end_date,
      impressions, clicks, conversions, roi_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    expense_id, campaign_name, marketing_channel, platform,
    target_audience, start_date, end_date,
    impressions, clicks, conversions, roi_notes
  ]);

  const marketing = await db.promisify.get('SELECT * FROM marketing_expenses WHERE id = $1', [result.id]);
  res.status(201).json(marketing);
}));

// ============================================
// RECURRING EXPENSES
// ============================================

router.get('/recurring', asyncHandler(async (req, res) => {
  const templates = await db.promisify.all(`
    SELECT ret.*, ec.name as category_name, v.name as vendor_name
    FROM recurring_expense_templates ret
    LEFT JOIN expense_categories ec ON ret.category_id = ec.id
    LEFT JOIN vendors v ON ret.vendor_id = v.id
    WHERE ret.is_active = true
    ORDER BY ret.next_due_date
  `);
  res.json(templates);
}));

router.post('/recurring', validateBody(createRecurringExpenseSchema), asyncHandler(async (req, res) => {
  const {
    name, category_id, vendor_id, description, amount,
    frequency, day_of_week, day_of_month, month_of_year,
    start_date, end_date, auto_create, notes
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO recurring_expense_templates (
      name, category_id, vendor_id, description, amount,
      frequency, day_of_week, day_of_month, month_of_year,
      start_date, end_date, next_due_date, auto_create, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  `, [
    name, category_id, vendor_id, description, amount,
    frequency, day_of_week, day_of_month, month_of_year,
    start_date, end_date, start_date, auto_create, notes
  ]);

  const template = await db.promisify.get(`
    SELECT ret.*, ec.name as category_name, v.name as vendor_name
    FROM recurring_expense_templates ret
    LEFT JOIN expense_categories ec ON ret.category_id = ec.id
    LEFT JOIN vendors v ON ret.vendor_id = v.id
    WHERE ret.id = $1
  `, [result.id]);

  res.status(201).json(template);
}));

router.post('/recurring/generate', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const dueTemplates = await db.promisify.all(`
    SELECT * FROM recurring_expense_templates
    WHERE is_active = true AND auto_create = true
      AND next_due_date <= $1 AND (end_date IS NULL OR end_date >= $1)
  `, [today]);

  const generated = [];

  for (const template of dueTemplates) {
    const result = await db.promisify.run(`
      INSERT INTO expenses (
        expense_date, category_id, vendor_id, description, amount,
        is_recurring, recurring_frequency, notes
      ) VALUES ($1, $2, $3, $4, $5, true, $6, $7)
    `, [
      template.next_due_date, template.category_id, template.vendor_id,
      template.description || template.name, template.amount,
      template.frequency, `Auto-generated from: ${template.name}`
    ]);

    const nextDate = new Date(template.next_due_date);
    switch (template.frequency) {
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
      case 'annual': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
    }

    await db.promisify.run(`
      UPDATE recurring_expense_templates SET
        last_generated_date = $1, next_due_date = $2
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
}));

// ============================================
// LINE ITEMS
// ============================================

router.put('/line-items/:id', validateId, validateBody(updateLineItemSchema), asyncHandler(async (req, res) => {
  const {
    raw_vendor_code, raw_description, quantity, unit,
    unit_price, line_total, mapped_ingredient_id,
    mapped_category_id, mapping_confidence, notes
  } = req.body;

  await db.promisify.run(`
    UPDATE expense_line_items SET
      raw_vendor_code = COALESCE($1, raw_vendor_code),
      raw_description = COALESCE($2, raw_description),
      quantity = $3, unit = $4, unit_price = $5, line_total = $6,
      mapped_ingredient_id = $7, mapped_category_id = $8,
      mapping_confidence = COALESCE($9, mapping_confidence), notes = $10
    WHERE id = $11
  `, [
    raw_vendor_code, raw_description, quantity, unit,
    unit_price, line_total, mapped_ingredient_id,
    mapped_category_id, mapping_confidence, notes, req.params.id
  ]);

  const lineItem = await db.promisify.get(`
    SELECT eli.*, i.name as ingredient_name, ec.name as mapped_category_name
    FROM expense_line_items eli
    LEFT JOIN ingredients i ON eli.mapped_ingredient_id = i.id
    LEFT JOIN expense_categories ec ON eli.mapped_category_id = ec.id
    WHERE eli.id = $1
  `, [req.params.id]);

  if (!lineItem) {throw new NotFoundError('Line item');}
  res.json(lineItem);
}));

router.delete('/line-items/:id', validateId, asyncHandler(async (req, res) => {
  const result = await db.promisify.run('DELETE FROM expense_line_items WHERE id = $1', [req.params.id]);
  if (result.changes === 0) {throw new NotFoundError('Line item');}
  res.json({ success: true, message: 'Line item deleted' });
}));

// ============================================
// EXPENSES CRUD
// ============================================

router.get('/', validateQuery(expenseQuerySchema), asyncHandler(async (req, res) => {
  const { start, end, vendor_id, category_id, payment_method } = req.query;
  
  let sql = `
    SELECT e.*, v.name as vendor_name, ec.name as category_name, ec.expense_type,
      (SELECT COUNT(*) FROM expense_documents ed WHERE ed.expense_id = e.id) as document_count,
      (SELECT COUNT(*) FROM expense_line_items eli WHERE eli.expense_id = e.id) as line_item_count
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (start) { sql += ` AND e.expense_date >= $${paramIndex++}`; params.push(start); }
  if (end) { sql += ` AND e.expense_date <= $${paramIndex++}`; params.push(end); }
  if (vendor_id) { sql += ` AND e.vendor_id = $${paramIndex++}`; params.push(vendor_id); }
  if (category_id) { sql += ` AND e.category_id = $${paramIndex++}`; params.push(category_id); }
  if (payment_method) { sql += ` AND e.payment_method = $${paramIndex++}`; params.push(payment_method); }

  sql += ' ORDER BY e.expense_date DESC, e.id DESC';
  const expenses = await db.promisify.all(sql, params);
  res.json(expenses);
}));

router.get('/:id', validateId, asyncHandler(async (req, res) => {
  const expense = await db.promisify.get(`
    SELECT e.*, v.name as vendor_name, ec.name as category_name, ec.expense_type
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    WHERE e.id = $1
  `, [req.params.id]);

  if (!expense) {throw new NotFoundError('Expense');}

  const lineItems = await db.promisify.all(`
    SELECT eli.*, i.name as ingredient_name, ec.name as mapped_category_name
    FROM expense_line_items eli
    LEFT JOIN ingredients i ON eli.mapped_ingredient_id = i.id
    LEFT JOIN expense_categories ec ON eli.mapped_category_id = ec.id
    WHERE eli.expense_id = $1
    ORDER BY eli.line_number, eli.id
  `, [req.params.id]);

  const documents = await db.promisify.all(`
    SELECT d.* FROM documents d
    JOIN expense_documents ed ON d.id = ed.document_id
    WHERE ed.expense_id = $1
    ORDER BY d.created_at DESC
  `, [req.params.id]);

  res.json({ ...expense, line_items: lineItems, documents });
}));

router.post('/', validateBody(createExpenseSchema), asyncHandler(async (req, res) => {
  const {
    expense_date, category_id, vendor_id, description, amount,
    payment_method, reference_number, is_recurring, recurring_frequency,
    tax_deductible, tax_category, notes
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO expenses (
      expense_date, category_id, vendor_id, description, amount,
      payment_method, reference_number, is_recurring, recurring_frequency,
      tax_deductible, tax_category, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, [
    expense_date, category_id, vendor_id, description, amount,
    payment_method, reference_number, is_recurring, recurring_frequency,
    tax_deductible, tax_category, notes
  ]);

  const expense = await db.promisify.get(`
    SELECT e.*, v.name as vendor_name, ec.name as category_name
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    WHERE e.id = $1
  `, [result.id]);

  res.status(201).json(expense);
}));

router.put('/:id', validateId, validateBody(updateExpenseSchema), asyncHandler(async (req, res) => {
  const {
    expense_date, category_id, vendor_id, description, amount,
    payment_method, reference_number, is_recurring, recurring_frequency,
    tax_deductible, tax_category, notes
  } = req.body;

  await db.promisify.run(`
    UPDATE expenses SET
      expense_date = COALESCE($1, expense_date),
      category_id = COALESCE($2, category_id),
      vendor_id = $3,
      description = COALESCE($4, description),
      amount = COALESCE($5, amount),
      payment_method = $6, reference_number = $7,
      is_recurring = COALESCE($8, is_recurring),
      recurring_frequency = $9,
      tax_deductible = COALESCE($10, tax_deductible),
      tax_category = $11, notes = $12,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $13
  `, [
    expense_date, category_id, vendor_id, description, amount,
    payment_method, reference_number, is_recurring, recurring_frequency,
    tax_deductible, tax_category, notes, req.params.id
  ]);

  const expense = await db.promisify.get(`
    SELECT e.*, v.name as vendor_name, ec.name as category_name
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    WHERE e.id = $1
  `, [req.params.id]);

  if (!expense) {throw new NotFoundError('Expense');}
  res.json(expense);
}));

router.delete('/:id', validateId, asyncHandler(async (req, res) => {
  const result = await db.promisify.run('DELETE FROM expenses WHERE id = $1', [req.params.id]);
  if (result.changes === 0) {throw new NotFoundError('Expense');}
  res.json({ success: true, message: 'Expense deleted' });
}));

// ============================================
// LINE ITEMS FOR EXPENSE
// ============================================

router.get('/:id/line-items', validateId, asyncHandler(async (req, res) => {
  const lineItems = await db.promisify.all(`
    SELECT eli.*, i.name as ingredient_name, ec.name as mapped_category_name
    FROM expense_line_items eli
    LEFT JOIN ingredients i ON eli.mapped_ingredient_id = i.id
    LEFT JOIN expense_categories ec ON eli.mapped_category_id = ec.id
    WHERE eli.expense_id = $1
    ORDER BY eli.line_number, eli.id
  `, [req.params.id]);
  res.json(lineItems);
}));

router.post('/:id/line-items', validateId, validateBody(createLineItemsSchema), asyncHandler(async (req, res) => {
  const expenseId = req.params.id;
  const { items } = req.body;

  const expense = await db.promisify.get('SELECT id FROM expenses WHERE id = $1', [expenseId]);
  if (!expense) {throw new NotFoundError('Expense');}

  const insertedIds = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = await db.promisify.run(`
      INSERT INTO expense_line_items (
        expense_id, line_number, raw_vendor_code, raw_description,
        quantity, unit, unit_price, line_total, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      expenseId, item.line_number || i + 1,
      item.raw_vendor_code, item.raw_description,
      item.quantity, item.unit, item.unit_price, item.line_total, item.notes
    ]);
    insertedIds.push(result.id);
  }

  const lineItems = await db.promisify.all(`
    SELECT * FROM expense_line_items 
    WHERE id = ANY($1::int[])
    ORDER BY line_number, id
  `, [insertedIds]);

  res.status(201).json(lineItems);
}));

module.exports = router;
