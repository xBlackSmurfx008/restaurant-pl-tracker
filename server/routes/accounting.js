const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================
// CHART OF ACCOUNTS
// ============================================

/**
 * GET /api/accounting/accounts
 * Get chart of accounts
 */
router.get('/accounts', async (req, res) => {
  try {
    const { account_type, active_only } = req.query;
    const activeFilter = active_only !== 'false';

    let sql = 'SELECT * FROM accounts WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (activeFilter) {
      sql += ' AND is_active = true';
    }
    if (account_type) {
      sql += ` AND account_type = $${paramIndex}`;
      params.push(account_type);
      paramIndex++;
    }

    sql += ' ORDER BY account_number';

    const accounts = await db.promisify.all(sql, params);
    res.json(accounts);
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounting/accounts
 * Create new account
 */
router.post('/accounts', async (req, res) => {
  try {
    const {
      account_number, name, account_type, sub_type,
      parent_account_id, is_tax_deductible, tax_category, description
    } = req.body;

    if (!account_number || !name || !account_type) {
      return res.status(400).json({ error: 'account_number, name, and account_type are required' });
    }

    const result = await db.promisify.run(`
      INSERT INTO accounts (
        account_number, name, account_type, sub_type,
        parent_account_id, is_tax_deductible, tax_category, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      account_number, name, account_type, sub_type || null,
      parent_account_id || null, is_tax_deductible || false, tax_category || null, description || null
    ]);

    const account = await db.promisify.get('SELECT * FROM accounts WHERE id = $1', [result.id]);
    res.status(201).json(account);
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ACCOUNTS PAYABLE
// ============================================

/**
 * GET /api/accounting/payables
 * Get accounts payable
 */
router.get('/payables', async (req, res) => {
  try {
    const { status, vendor_id, overdue_only } = req.query;

    let sql = `
      SELECT 
        ap.*,
        v.name as vendor_name,
        (ap.amount - ap.amount_paid) as balance_due
      FROM accounts_payable ap
      JOIN vendors v ON ap.vendor_id = v.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND ap.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (vendor_id) {
      sql += ` AND ap.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }
    if (overdue_only === 'true') {
      sql += ' AND ap.due_date < CURRENT_DATE AND ap.status != \'paid\'';
    }

    sql += ' ORDER BY ap.due_date';

    const payables = await db.promisify.all(sql, params);
    res.json(payables);
  } catch (error) {
    console.error('Get payables error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounting/payables
 * Create accounts payable entry
 */
router.post('/payables', async (req, res) => {
  try {
    const {
      vendor_id, invoice_number, invoice_date, due_date,
      amount, expense_id, terms, notes
    } = req.body;

    if (!vendor_id || !invoice_date || !due_date || !amount) {
      return res.status(400).json({ 
        error: 'vendor_id, invoice_date, due_date, and amount are required' 
      });
    }

    const result = await db.promisify.run(`
      INSERT INTO accounts_payable (
        vendor_id, invoice_number, invoice_date, due_date,
        amount, expense_id, terms, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      vendor_id, invoice_number || null, invoice_date, due_date,
      amount, expense_id || null, terms || null, notes || null
    ]);

    const payable = await db.promisify.get(`
      SELECT ap.*, v.name as vendor_name
      FROM accounts_payable ap
      JOIN vendors v ON ap.vendor_id = v.id
      WHERE ap.id = $1
    `, [result.id]);

    res.status(201).json(payable);
  } catch (error) {
    console.error('Create payable error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounting/payables/:id/payment
 * Record payment on accounts payable
 */
router.post('/payables/:id/payment', async (req, res) => {
  try {
    const { amount, payment_date, payment_method, notes } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const payable = await db.promisify.get(
      'SELECT * FROM accounts_payable WHERE id = $1',
      [req.params.id]
    );

    if (!payable) {
      return res.status(404).json({ error: 'Payable not found' });
    }

    const newAmountPaid = parseFloat(payable.amount_paid) + parseFloat(amount);
    const newStatus = newAmountPaid >= parseFloat(payable.amount) ? 'paid' : 'partial';

    await db.promisify.run(`
      UPDATE accounts_payable SET
        amount_paid = $1,
        status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newAmountPaid, newStatus, req.params.id]);

    const updated = await db.promisify.get(`
      SELECT ap.*, v.name as vendor_name
      FROM accounts_payable ap
      JOIN vendors v ON ap.vendor_id = v.id
      WHERE ap.id = $1
    `, [req.params.id]);

    res.json({
      payable: updated,
      payment_recorded: parseFloat(amount),
      remaining_balance: parseFloat(updated.amount) - parseFloat(updated.amount_paid)
    });
  } catch (error) {
    console.error('Record AP payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/accounting/payables/aging
 * AP Aging report
 */
router.get('/payables/aging', async (req, res) => {
  try {
    const aging = await db.promisify.all(`
      SELECT 
        v.id as vendor_id,
        v.name as vendor_name,
        SUM(CASE WHEN ap.due_date >= CURRENT_DATE THEN (ap.amount - ap.amount_paid) ELSE 0 END) as current_due,
        SUM(CASE WHEN ap.due_date < CURRENT_DATE AND ap.due_date >= CURRENT_DATE - 30 THEN (ap.amount - ap.amount_paid) ELSE 0 END) as days_1_30,
        SUM(CASE WHEN ap.due_date < CURRENT_DATE - 30 AND ap.due_date >= CURRENT_DATE - 60 THEN (ap.amount - ap.amount_paid) ELSE 0 END) as days_31_60,
        SUM(CASE WHEN ap.due_date < CURRENT_DATE - 60 AND ap.due_date >= CURRENT_DATE - 90 THEN (ap.amount - ap.amount_paid) ELSE 0 END) as days_61_90,
        SUM(CASE WHEN ap.due_date < CURRENT_DATE - 90 THEN (ap.amount - ap.amount_paid) ELSE 0 END) as over_90,
        SUM(ap.amount - ap.amount_paid) as total_due
      FROM accounts_payable ap
      JOIN vendors v ON ap.vendor_id = v.id
      WHERE ap.status != 'paid'
      GROUP BY v.id, v.name
      HAVING SUM(ap.amount - ap.amount_paid) > 0
      ORDER BY total_due DESC
    `);

    const totals = {
      current: aging.reduce((s, a) => s + parseFloat(a.current_due || 0), 0),
      days_1_30: aging.reduce((s, a) => s + parseFloat(a.days_1_30 || 0), 0),
      days_31_60: aging.reduce((s, a) => s + parseFloat(a.days_31_60 || 0), 0),
      days_61_90: aging.reduce((s, a) => s + parseFloat(a.days_61_90 || 0), 0),
      over_90: aging.reduce((s, a) => s + parseFloat(a.over_90 || 0), 0),
      total: aging.reduce((s, a) => s + parseFloat(a.total_due || 0), 0)
    };

    res.json({ by_vendor: aging, totals });
  } catch (error) {
    console.error('AP aging error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ACCOUNTS RECEIVABLE
// ============================================

/**
 * GET /api/accounting/receivables
 * Get accounts receivable
 */
router.get('/receivables', async (req, res) => {
  try {
    const { status, service_type, overdue_only } = req.query;

    let sql = `
      SELECT 
        ar.*,
        (ar.amount - ar.amount_received) as balance_due
      FROM accounts_receivable ar
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND ar.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (service_type) {
      sql += ` AND ar.service_type = $${paramIndex}`;
      params.push(service_type);
      paramIndex++;
    }
    if (overdue_only === 'true') {
      sql += ' AND ar.due_date < CURRENT_DATE AND ar.status != \'paid\'';
    }

    sql += ' ORDER BY ar.due_date';

    const receivables = await db.promisify.all(sql, params);
    res.json(receivables);
  } catch (error) {
    console.error('Get receivables error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounting/receivables
 * Create accounts receivable entry
 */
router.post('/receivables', async (req, res) => {
  try {
    const {
      customer_name, customer_contact, invoice_number,
      invoice_date, due_date, amount, description, service_type, notes
    } = req.body;

    if (!customer_name || !invoice_date || !due_date || !amount) {
      return res.status(400).json({ 
        error: 'customer_name, invoice_date, due_date, and amount are required' 
      });
    }

    const result = await db.promisify.run(`
      INSERT INTO accounts_receivable (
        customer_name, customer_contact, invoice_number,
        invoice_date, due_date, amount, description, service_type, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      customer_name, customer_contact || null, invoice_number || null,
      invoice_date, due_date, amount, description || null, service_type || null, notes || null
    ]);

    const receivable = await db.promisify.get(
      'SELECT * FROM accounts_receivable WHERE id = $1',
      [result.id]
    );

    res.status(201).json(receivable);
  } catch (error) {
    console.error('Create receivable error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounting/receivables/:id/payment
 * Record payment on accounts receivable
 */
router.post('/receivables/:id/payment', async (req, res) => {
  try {
    const { amount, payment_date, notes } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const receivable = await db.promisify.get(
      'SELECT * FROM accounts_receivable WHERE id = $1',
      [req.params.id]
    );

    if (!receivable) {
      return res.status(404).json({ error: 'Receivable not found' });
    }

    const newAmountReceived = parseFloat(receivable.amount_received) + parseFloat(amount);
    const newStatus = newAmountReceived >= parseFloat(receivable.amount) ? 'paid' : 'partial';

    await db.promisify.run(`
      UPDATE accounts_receivable SET
        amount_received = $1,
        status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newAmountReceived, newStatus, req.params.id]);

    const updated = await db.promisify.get(
      'SELECT * FROM accounts_receivable WHERE id = $1',
      [req.params.id]
    );

    res.json({
      receivable: updated,
      payment_recorded: parseFloat(amount),
      remaining_balance: parseFloat(updated.amount) - parseFloat(updated.amount_received)
    });
  } catch (error) {
    console.error('Record AR payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BANK ACCOUNTS
// ============================================

/**
 * GET /api/accounting/bank-accounts
 * Get all bank accounts
 */
router.get('/bank-accounts', async (req, res) => {
  try {
    const accounts = await db.promisify.all(`
      SELECT * FROM bank_accounts
      WHERE is_active = true
      ORDER BY is_primary DESC, account_name
    `);
    res.json(accounts);
  } catch (error) {
    console.error('Get bank accounts error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounting/bank-accounts
 * Create bank account
 */
router.post('/bank-accounts', async (req, res) => {
  try {
    const {
      account_name, bank_name, account_type,
      account_number_last_four, routing_number,
      opening_balance, is_primary, notes
    } = req.body;

    if (!account_name) {
      return res.status(400).json({ error: 'account_name is required' });
    }

    const result = await db.promisify.run(`
      INSERT INTO bank_accounts (
        account_name, bank_name, account_type,
        account_number_last_four, routing_number,
        opening_balance, current_balance, is_primary, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8)
    `, [
      account_name, bank_name || null, account_type || 'checking',
      account_number_last_four || null, routing_number || null,
      opening_balance || 0, is_primary || false, notes || null
    ]);

    const account = await db.promisify.get('SELECT * FROM bank_accounts WHERE id = $1', [result.id]);
    res.status(201).json(account);
  } catch (error) {
    console.error('Create bank account error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/accounting/bank-accounts/:id/transactions
 * Get transactions for a bank account
 */
router.get('/bank-accounts/:id/transactions', async (req, res) => {
  try {
    const { start_date, end_date, reconciled } = req.query;

    let sql = `
      SELECT * FROM bank_transactions
      WHERE bank_account_id = $1
    `;
    const params = [req.params.id];
    let paramIndex = 2;

    if (start_date) {
      sql += ` AND transaction_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      sql += ` AND transaction_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    if (reconciled !== undefined) {
      sql += ` AND is_reconciled = $${paramIndex}`;
      params.push(reconciled === 'true');
      paramIndex++;
    }

    sql += ' ORDER BY transaction_date DESC, id DESC';

    const transactions = await db.promisify.all(sql, params);
    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounting/bank-accounts/:id/transactions
 * Add transaction to bank account
 */
router.post('/bank-accounts/:id/transactions', async (req, res) => {
  try {
    const {
      transaction_date, transaction_type, description, amount,
      expense_id, payroll_id, sales_date, reference_number
    } = req.body;

    if (!transaction_date || !transaction_type || !description || amount === undefined) {
      return res.status(400).json({ 
        error: 'transaction_date, transaction_type, description, and amount are required' 
      });
    }

    // Get current balance
    const account = await db.promisify.get(
      'SELECT current_balance FROM bank_accounts WHERE id = $1',
      [req.params.id]
    );

    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const newBalance = parseFloat(account.current_balance) + parseFloat(amount);

    const result = await db.promisify.run(`
      INSERT INTO bank_transactions (
        bank_account_id, transaction_date, transaction_type, description,
        amount, running_balance, expense_id, payroll_id, sales_date, reference_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      req.params.id, transaction_date, transaction_type, description,
      amount, newBalance, expense_id || null, payroll_id || null,
      sales_date || null, reference_number || null
    ]);

    // Update account balance
    await db.promisify.run(
      'UPDATE bank_accounts SET current_balance = $1 WHERE id = $2',
      [newBalance, req.params.id]
    );

    const transaction = await db.promisify.get(
      'SELECT * FROM bank_transactions WHERE id = $1',
      [result.id]
    );

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounting/bank-accounts/:id/reconcile
 * Reconcile transactions
 */
router.post('/bank-accounts/:id/reconcile', async (req, res) => {
  try {
    const { transaction_ids, statement_ending_balance, statement_date } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ error: 'transaction_ids array required' });
    }

    // Mark transactions as reconciled
    await db.promisify.run(`
      UPDATE bank_transactions
      SET is_reconciled = true, reconciled_date = $1
      WHERE id = ANY($2::int[]) AND bank_account_id = $3
    `, [statement_date || new Date().toISOString().split('T')[0], transaction_ids, req.params.id]);

    // Get reconciled total
    const reconciled = await db.promisify.get(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM bank_transactions
      WHERE id = ANY($1::int[])
    `, [transaction_ids]);

    res.json({
      reconciled_count: parseInt(reconciled.count),
      reconciled_total: parseFloat(reconciled.total) || 0,
      statement_ending_balance: parseFloat(statement_ending_balance) || null
    });
  } catch (error) {
    console.error('Reconcile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DAILY REVENUE
// ============================================

/**
 * GET /api/accounting/daily-revenue
 * Get daily revenue records
 */
router.get('/daily-revenue', async (req, res) => {
  try {
    const { start_date, end_date, limit } = req.query;

    let sql = 'SELECT * FROM daily_revenue WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      sql += ` AND date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      sql += ` AND date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    sql += ' ORDER BY date DESC';

    if (limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(parseInt(limit));
    }

    const revenue = await db.promisify.all(sql, params);
    res.json(revenue);
  } catch (error) {
    console.error('Get daily revenue error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounting/daily-revenue
 * Save daily revenue (upsert)
 */
router.post('/daily-revenue', async (req, res) => {
  try {
    const {
      date, food_sales, beverage_sales, alcohol_sales,
      catering_sales, gift_card_sales, other_sales,
      discounts, comps, refunds,
      tips_collected, cash_payments, card_payments, other_payments,
      transaction_count, customer_count, weather_notes, event_notes, notes
    } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    // Calculate totals
    const grossSales = (food_sales || 0) + (beverage_sales || 0) + (alcohol_sales || 0) +
                       (catering_sales || 0) + (gift_card_sales || 0) + (other_sales || 0);
    const netSales = grossSales - (discounts || 0) - (comps || 0) - (refunds || 0);

    await db.promisify.run(`
      INSERT INTO daily_revenue (
        date, food_sales, beverage_sales, alcohol_sales,
        catering_sales, gift_card_sales, other_sales,
        total_gross_sales, discounts, comps, refunds, total_net_sales,
        tips_collected, cash_payments, card_payments, other_payments,
        transaction_count, customer_count, weather_notes, event_notes, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (date) DO UPDATE SET
        food_sales = EXCLUDED.food_sales,
        beverage_sales = EXCLUDED.beverage_sales,
        alcohol_sales = EXCLUDED.alcohol_sales,
        catering_sales = EXCLUDED.catering_sales,
        gift_card_sales = EXCLUDED.gift_card_sales,
        other_sales = EXCLUDED.other_sales,
        total_gross_sales = EXCLUDED.total_gross_sales,
        discounts = EXCLUDED.discounts,
        comps = EXCLUDED.comps,
        refunds = EXCLUDED.refunds,
        total_net_sales = EXCLUDED.total_net_sales,
        tips_collected = EXCLUDED.tips_collected,
        cash_payments = EXCLUDED.cash_payments,
        card_payments = EXCLUDED.card_payments,
        other_payments = EXCLUDED.other_payments,
        transaction_count = EXCLUDED.transaction_count,
        customer_count = EXCLUDED.customer_count,
        weather_notes = EXCLUDED.weather_notes,
        event_notes = EXCLUDED.event_notes,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
    `, [
      date, food_sales || 0, beverage_sales || 0, alcohol_sales || 0,
      catering_sales || 0, gift_card_sales || 0, other_sales || 0,
      grossSales, discounts || 0, comps || 0, refunds || 0, netSales,
      tips_collected || 0, cash_payments || 0, card_payments || 0, other_payments || 0,
      transaction_count || 0, customer_count || 0,
      weather_notes || null, event_notes || null, notes || null
    ]);

    const revenue = await db.promisify.get('SELECT * FROM daily_revenue WHERE date = $1', [date]);
    res.json(revenue);
  } catch (error) {
    console.error('Save daily revenue error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BUSINESS SETTINGS
// ============================================

/**
 * GET /api/accounting/settings
 * Get all business settings
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = await db.promisify.all('SELECT * FROM business_settings');
    
    // Convert to object
    const settingsObj = {};
    for (const s of settings) {
      let value = s.setting_value;
      if (s.setting_type === 'number') value = parseFloat(value);
      if (s.setting_type === 'boolean') value = value === 'true';
      if (s.setting_type === 'json') value = JSON.parse(value || '{}');
      settingsObj[s.setting_key] = value;
    }

    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/accounting/settings/:key
 * Update a single setting
 */
router.put('/settings/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    await db.promisify.run(`
      UPDATE business_settings
      SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = $2
    `, [stringValue, req.params.key]);

    res.json({ key: req.params.key, value });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/accounting/settings
 * Update multiple settings
 */
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body;

    for (const [key, value] of Object.entries(settings)) {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await db.promisify.run(`
        UPDATE business_settings
        SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
        WHERE setting_key = $2
      `, [stringValue, key]);
    }

    res.json({ updated: Object.keys(settings).length });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
