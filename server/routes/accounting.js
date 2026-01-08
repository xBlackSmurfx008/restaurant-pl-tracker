const express = require('express');
const router = express.Router();
const db = require('../db');

// =====================================================
// CHART OF ACCOUNTS
// =====================================================

// Get all accounts
router.get('/accounts', async (req, res) => {
  try {
    const { account_type, active_only = 'true' } = req.query;
    
    let query = `
      SELECT a.*, p.name as parent_account_name
      FROM accounts a
      LEFT JOIN accounts p ON a.parent_account_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (active_only === 'true') {
      query += ` AND a.is_active = true`;
    }
    if (account_type) {
      query += ` AND a.account_type = $${paramIndex}`;
      params.push(account_type);
      paramIndex++;
    }

    query += ' ORDER BY a.account_number';

    const accounts = await db.promisify.all(query, params);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create account
router.post('/accounts', async (req, res) => {
  try {
    const {
      account_number, name, account_type, sub_type, parent_account_id,
      is_tax_deductible, tax_category, description
    } = req.body;

    if (!account_number || !name || !account_type) {
      return res.status(400).json({ 
        error: 'account_number, name, and account_type are required' 
      });
    }

    const result = await db.query(`
      INSERT INTO accounts 
        (account_number, name, account_type, sub_type, parent_account_id,
         is_tax_deductible, tax_category, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      account_number, name, account_type, sub_type, parent_account_id,
      is_tax_deductible, tax_category, description
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.message.includes('unique')) {
      return res.status(400).json({ error: 'Account number already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// ACCOUNTS PAYABLE (What you owe vendors)
// =====================================================

// Get all AP records
router.get('/payables', async (req, res) => {
  try {
    const { status, vendor_id, overdue_only = 'false' } = req.query;
    
    let query = `
      SELECT ap.*, v.name as vendor_name, v.contact_person, v.phone
      FROM accounts_payable ap
      JOIN vendors v ON ap.vendor_id = v.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND ap.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (vendor_id) {
      query += ` AND ap.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }
    if (overdue_only === 'true') {
      query += ` AND ap.due_date < CURRENT_DATE AND ap.status != 'paid'`;
    }

    query += ' ORDER BY ap.due_date, ap.amount DESC';

    const payables = await db.promisify.all(query, params);

    // Calculate totals
    const totals = payables.reduce((acc, ap) => {
      acc.total_amount += parseFloat(ap.amount);
      acc.total_paid += parseFloat(ap.amount_paid);
      acc.total_outstanding += parseFloat(ap.amount) - parseFloat(ap.amount_paid);
      if (ap.status === 'overdue' || (new Date(ap.due_date) < new Date() && ap.status !== 'paid')) {
        acc.overdue_count++;
        acc.overdue_amount += parseFloat(ap.amount) - parseFloat(ap.amount_paid);
      }
      return acc;
    }, { total_amount: 0, total_paid: 0, total_outstanding: 0, overdue_count: 0, overdue_amount: 0 });

    res.json({
      payables,
      totals: {
        ...totals,
        total_amount: parseFloat(totals.total_amount.toFixed(2)),
        total_paid: parseFloat(totals.total_paid.toFixed(2)),
        total_outstanding: parseFloat(totals.total_outstanding.toFixed(2)),
        overdue_amount: parseFloat(totals.overdue_amount.toFixed(2))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create AP record
router.post('/payables', async (req, res) => {
  try {
    const {
      vendor_id, invoice_number, invoice_date, due_date,
      amount, terms, expense_id, notes
    } = req.body;

    if (!vendor_id || !invoice_date || !due_date || !amount) {
      return res.status(400).json({ 
        error: 'vendor_id, invoice_date, due_date, and amount are required' 
      });
    }

    const result = await db.query(`
      INSERT INTO accounts_payable 
        (vendor_id, invoice_number, invoice_date, due_date, amount, terms, expense_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [vendor_id, invoice_number, invoice_date, due_date, amount, terms, expense_id, notes]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record payment on AP
router.post('/payables/:id/payment', async (req, res) => {
  try {
    const { amount, payment_date, notes } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    // Get current AP record
    const ap = await db.promisify.get(
      'SELECT * FROM accounts_payable WHERE id = $1',
      [req.params.id]
    );

    if (!ap) {
      return res.status(404).json({ error: 'Payable not found' });
    }

    const newAmountPaid = parseFloat(ap.amount_paid) + parseFloat(amount);
    const remainingBalance = parseFloat(ap.amount) - newAmountPaid;
    
    let newStatus = 'partial';
    if (remainingBalance <= 0) {
      newStatus = 'paid';
    }

    const result = await db.query(`
      UPDATE accounts_payable 
      SET amount_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP,
          notes = COALESCE(notes, '') || $3
      WHERE id = $4
      RETURNING *
    `, [
      newAmountPaid, 
      newStatus, 
      `\nPayment $${amount} on ${payment_date || new Date().toISOString().split('T')[0]}${notes ? ': ' + notes : ''}`,
      req.params.id
    ]);

    res.json({
      ...result.rows[0],
      remaining_balance: Math.max(0, remainingBalance)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get AP aging report
router.get('/payables/aging', async (req, res) => {
  try {
    const aging = await db.promisify.all(`
      SELECT 
        v.name as vendor_name,
        SUM(CASE WHEN CURRENT_DATE - ap.due_date <= 0 THEN ap.amount - ap.amount_paid ELSE 0 END) as current_amount,
        SUM(CASE WHEN CURRENT_DATE - ap.due_date BETWEEN 1 AND 30 THEN ap.amount - ap.amount_paid ELSE 0 END) as days_1_30,
        SUM(CASE WHEN CURRENT_DATE - ap.due_date BETWEEN 31 AND 60 THEN ap.amount - ap.amount_paid ELSE 0 END) as days_31_60,
        SUM(CASE WHEN CURRENT_DATE - ap.due_date BETWEEN 61 AND 90 THEN ap.amount - ap.amount_paid ELSE 0 END) as days_61_90,
        SUM(CASE WHEN CURRENT_DATE - ap.due_date > 90 THEN ap.amount - ap.amount_paid ELSE 0 END) as over_90,
        SUM(ap.amount - ap.amount_paid) as total
      FROM accounts_payable ap
      JOIN vendors v ON ap.vendor_id = v.id
      WHERE ap.status != 'paid'
      GROUP BY v.name
      ORDER BY total DESC
    `);

    // Calculate totals
    const totals = aging.reduce((acc, row) => {
      acc.current_amount += parseFloat(row.current_amount || 0);
      acc.days_1_30 += parseFloat(row.days_1_30 || 0);
      acc.days_31_60 += parseFloat(row.days_31_60 || 0);
      acc.days_61_90 += parseFloat(row.days_61_90 || 0);
      acc.over_90 += parseFloat(row.over_90 || 0);
      acc.total += parseFloat(row.total || 0);
      return acc;
    }, { current_amount: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, over_90: 0, total: 0 });

    res.json({
      by_vendor: aging,
      totals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// ACCOUNTS RECEIVABLE (Money owed to you)
// =====================================================

// Get all AR records
router.get('/receivables', async (req, res) => {
  try {
    const { status, service_type, overdue_only = 'false' } = req.query;
    
    let query = 'SELECT * FROM accounts_receivable WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (service_type) {
      query += ` AND service_type = $${paramIndex}`;
      params.push(service_type);
      paramIndex++;
    }
    if (overdue_only === 'true') {
      query += ` AND due_date < CURRENT_DATE AND status != 'paid'`;
    }

    query += ' ORDER BY due_date, amount DESC';

    const receivables = await db.promisify.all(query, params);

    const totals = receivables.reduce((acc, ar) => {
      acc.total_amount += parseFloat(ar.amount);
      acc.total_received += parseFloat(ar.amount_received);
      acc.total_outstanding += parseFloat(ar.amount) - parseFloat(ar.amount_received);
      return acc;
    }, { total_amount: 0, total_received: 0, total_outstanding: 0 });

    res.json({
      receivables,
      totals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create AR record (for catering, private events, etc.)
router.post('/receivables', async (req, res) => {
  try {
    const {
      customer_name, customer_contact, invoice_number, invoice_date,
      due_date, amount, description, service_type, notes
    } = req.body;

    if (!customer_name || !invoice_date || !due_date || !amount) {
      return res.status(400).json({ 
        error: 'customer_name, invoice_date, due_date, and amount are required' 
      });
    }

    const result = await db.query(`
      INSERT INTO accounts_receivable 
        (customer_name, customer_contact, invoice_number, invoice_date,
         due_date, amount, description, service_type, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      customer_name, customer_contact, invoice_number, invoice_date,
      due_date, amount, description, service_type, notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record payment on AR
router.post('/receivables/:id/payment', async (req, res) => {
  try {
    const { amount, payment_date, notes } = req.body;

    const ar = await db.promisify.get(
      'SELECT * FROM accounts_receivable WHERE id = $1',
      [req.params.id]
    );

    if (!ar) {
      return res.status(404).json({ error: 'Receivable not found' });
    }

    const newAmountReceived = parseFloat(ar.amount_received) + parseFloat(amount);
    const remainingBalance = parseFloat(ar.amount) - newAmountReceived;
    
    let newStatus = 'partial';
    if (remainingBalance <= 0) {
      newStatus = 'paid';
    }

    const result = await db.query(`
      UPDATE accounts_receivable 
      SET amount_received = $1, status = $2, updated_at = CURRENT_TIMESTAMP,
          notes = COALESCE(notes, '') || $3
      WHERE id = $4
      RETURNING *
    `, [
      newAmountReceived, 
      newStatus, 
      `\nPayment received $${amount} on ${payment_date || new Date().toISOString().split('T')[0]}${notes ? ': ' + notes : ''}`,
      req.params.id
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// BANK ACCOUNTS & RECONCILIATION
// =====================================================

// Get all bank accounts
router.get('/bank-accounts', async (req, res) => {
  try {
    const accounts = await db.promisify.all(`
      SELECT * FROM bank_accounts 
      WHERE is_active = true 
      ORDER BY is_primary DESC, account_name
    `);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create bank account
router.post('/bank-accounts', async (req, res) => {
  try {
    const {
      account_name, bank_name, account_type, account_number_last_four,
      routing_number, opening_balance, is_primary, notes
    } = req.body;

    if (!account_name) {
      return res.status(400).json({ error: 'account_name is required' });
    }

    const result = await db.query(`
      INSERT INTO bank_accounts 
        (account_name, bank_name, account_type, account_number_last_four,
         routing_number, opening_balance, current_balance, is_primary, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8)
      RETURNING *
    `, [
      account_name, bank_name, account_type, account_number_last_four,
      routing_number, opening_balance || 0, is_primary || false, notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bank transactions
router.get('/bank-accounts/:id/transactions', async (req, res) => {
  try {
    const { start_date, end_date, reconciled } = req.query;
    
    let query = `
      SELECT bt.*, e.description as expense_description
      FROM bank_transactions bt
      LEFT JOIN expenses e ON bt.expense_id = e.id
      WHERE bt.bank_account_id = $1
    `;
    const params = [req.params.id];
    let paramIndex = 2;

    if (start_date) {
      query += ` AND bt.transaction_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      query += ` AND bt.transaction_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    if (reconciled !== undefined) {
      query += ` AND bt.is_reconciled = $${paramIndex}`;
      params.push(reconciled === 'true');
      paramIndex++;
    }

    query += ' ORDER BY bt.transaction_date DESC, bt.id DESC';

    const transactions = await db.promisify.all(query, params);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add bank transaction
router.post('/bank-accounts/:id/transactions', async (req, res) => {
  try {
    const {
      transaction_date, transaction_type, description, amount,
      expense_id, payroll_id, sales_date, reference_number, notes
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

    const transactionAmount = transaction_type === 'withdrawal' || transaction_type === 'fee' 
      ? -Math.abs(amount) 
      : Math.abs(amount);
    
    const newBalance = parseFloat(account.current_balance) + transactionAmount;

    // Use transaction to ensure atomicity
    const result = await db.transaction(async (client) => {
      // Insert transaction
      const txResult = await client.query(`
        INSERT INTO bank_transactions 
          (bank_account_id, transaction_date, transaction_type, description, amount,
           running_balance, expense_id, payroll_id, sales_date, reference_number, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        req.params.id, transaction_date, transaction_type, description, transactionAmount,
        newBalance, expense_id, payroll_id, sales_date, reference_number, notes
      ]);

      // Update account balance
      await client.query(
        'UPDATE bank_accounts SET current_balance = $1 WHERE id = $2',
        [newBalance, req.params.id]
      );

      return txResult.rows[0];
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reconcile transactions
router.post('/bank-accounts/:id/reconcile', async (req, res) => {
  try {
    const { transaction_ids, statement_ending_balance, statement_date } = req.body;

    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ error: 'transaction_ids array is required' });
    }

    // Mark transactions as reconciled
    await db.query(`
      UPDATE bank_transactions 
      SET is_reconciled = true, reconciled_date = $1
      WHERE id = ANY($2::int[])
    `, [statement_date || new Date().toISOString().split('T')[0], transaction_ids]);

    // Get reconciled balance
    const reconciledTotal = await db.promisify.get(`
      SELECT SUM(amount) as reconciled_amount
      FROM bank_transactions
      WHERE bank_account_id = $1 AND is_reconciled = true
    `, [req.params.id]);

    // Get account opening balance
    const account = await db.promisify.get(
      'SELECT opening_balance, current_balance FROM bank_accounts WHERE id = $1',
      [req.params.id]
    );

    const calculatedBalance = parseFloat(account.opening_balance) + parseFloat(reconciledTotal?.reconciled_amount || 0);
    const difference = statement_ending_balance 
      ? parseFloat(statement_ending_balance) - calculatedBalance 
      : 0;

    res.json({
      transactions_reconciled: transaction_ids.length,
      calculated_balance: parseFloat(calculatedBalance.toFixed(2)),
      statement_ending_balance: parseFloat(statement_ending_balance || 0),
      difference: parseFloat(difference.toFixed(2)),
      is_balanced: Math.abs(difference) < 0.01
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// DAILY REVENUE ENTRY
// =====================================================

// Get daily revenue records
router.get('/daily-revenue', async (req, res) => {
  try {
    const { start_date, end_date, limit = 30 } = req.query;
    
    let query = 'SELECT * FROM daily_revenue WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      query += ` AND date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ` ORDER BY date DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const revenue = await db.promisify.all(query, params);
    res.json(revenue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/update daily revenue
router.post('/daily-revenue', async (req, res) => {
  try {
    const {
      date, food_sales, beverage_sales, alcohol_sales, catering_sales,
      gift_card_sales, other_sales, discounts, comps, refunds,
      tips_collected, cash_payments, card_payments, other_payments,
      transaction_count, customer_count, weather_notes, event_notes, notes
    } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    // Calculate totals
    const totalGrossSales = (parseFloat(food_sales) || 0) + 
      (parseFloat(beverage_sales) || 0) + 
      (parseFloat(alcohol_sales) || 0) + 
      (parseFloat(catering_sales) || 0) + 
      (parseFloat(gift_card_sales) || 0) + 
      (parseFloat(other_sales) || 0);

    const totalNetSales = totalGrossSales - 
      (parseFloat(discounts) || 0) - 
      (parseFloat(comps) || 0) - 
      (parseFloat(refunds) || 0);

    const result = await db.query(`
      INSERT INTO daily_revenue 
        (date, food_sales, beverage_sales, alcohol_sales, catering_sales,
         gift_card_sales, other_sales, total_gross_sales, discounts, comps,
         refunds, total_net_sales, tips_collected, cash_payments, card_payments,
         other_payments, transaction_count, customer_count, weather_notes,
         event_notes, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
      RETURNING *
    `, [
      date, food_sales || 0, beverage_sales || 0, alcohol_sales || 0,
      catering_sales || 0, gift_card_sales || 0, other_sales || 0,
      totalGrossSales, discounts || 0, comps || 0, refunds || 0,
      totalNetSales, tips_collected || 0, cash_payments || 0,
      card_payments || 0, other_payments || 0, transaction_count || 0,
      customer_count || 0, weather_notes, event_notes, notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// BUSINESS SETTINGS
// =====================================================

// Get all settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await db.promisify.all('SELECT * FROM business_settings');
    
    // Convert to object
    const settingsObj = settings.reduce((acc, s) => {
      let value = s.setting_value;
      if (s.setting_type === 'number') value = parseFloat(value);
      if (s.setting_type === 'boolean') value = value === 'true';
      if (s.setting_type === 'json') value = JSON.parse(value || '{}');
      acc[s.setting_key] = value;
      return acc;
    }, {});

    res.json(settingsObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update setting
router.put('/settings/:key', async (req, res) => {
  try {
    const { value } = req.body;
    
    const result = await db.query(`
      UPDATE business_settings 
      SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = $2
      RETURNING *
    `, [String(value), req.params.key]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update settings
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body;

    await db.transaction(async (client) => {
      for (const [key, value] of Object.entries(settings)) {
        await client.query(`
          UPDATE business_settings 
          SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
          WHERE setting_key = $2
        `, [String(value), key]);
      }
    });

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

