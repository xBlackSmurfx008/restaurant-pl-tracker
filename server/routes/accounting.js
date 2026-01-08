/**
 * Accounting Routes
 * Updated with centralized error handling and validation
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  createAccountSchema,
  accountQuerySchema,
  createPayableSchema,
  recordPaymentSchema,
  payableQuerySchema,
  createReceivableSchema,
  receivableQuerySchema,
  createBankAccountSchema,
  createBankTransactionSchema,
  reconcileTransactionsSchema,
  bankTransactionQuerySchema,
  saveDailyRevenueSchema,
  dailyRevenueQuerySchema,
  updateSettingSchema,
  updateSettingsSchema,
} = require('../schemas/accounting.schema');

// ============================================
// CHART OF ACCOUNTS
// ============================================

router.get('/accounts', validateQuery(accountQuerySchema), asyncHandler(async (req, res) => {
  const { account_type, active_only } = req.query;
  const activeFilter = active_only !== false;

  let sql = 'SELECT * FROM accounts WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (activeFilter) {sql += ' AND is_active = true';}
  if (account_type) {
    sql += ` AND account_type = $${paramIndex++}`;
    params.push(account_type);
  }

  sql += ' ORDER BY account_number';
  const accounts = await db.promisify.all(sql, params);
  res.json(accounts);
}));

router.post('/accounts', validateBody(createAccountSchema), asyncHandler(async (req, res) => {
  const {
    account_number, name, account_type, sub_type,
    parent_account_id, is_tax_deductible, tax_category, description
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO accounts (
      account_number, name, account_type, sub_type,
      parent_account_id, is_tax_deductible, tax_category, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    account_number, name, account_type, sub_type,
    parent_account_id, is_tax_deductible, tax_category, description
  ]);

  const account = await db.promisify.get('SELECT * FROM accounts WHERE id = $1', [result.id]);
  res.status(201).json(account);
}));

// ============================================
// ACCOUNTS PAYABLE
// ============================================

router.get('/payables', validateQuery(payableQuerySchema), asyncHandler(async (req, res) => {
  const { status, vendor_id, overdue_only } = req.query;

  let sql = `
    SELECT ap.*, v.name as vendor_name, (ap.amount - ap.amount_paid) as balance_due
    FROM accounts_payable ap
    JOIN vendors v ON ap.vendor_id = v.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (status) { sql += ` AND ap.status = $${paramIndex++}`; params.push(status); }
  if (vendor_id) { sql += ` AND ap.vendor_id = $${paramIndex++}`; params.push(vendor_id); }
  if (overdue_only) {sql += " AND ap.due_date < CURRENT_DATE AND ap.status != 'paid'";}

  sql += ' ORDER BY ap.due_date';
  const payables = await db.promisify.all(sql, params);
  res.json(payables);
}));

router.post('/payables', validateBody(createPayableSchema), asyncHandler(async (req, res) => {
  const {
    vendor_id, invoice_number, invoice_date, due_date,
    amount, expense_id, terms, notes
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO accounts_payable (
      vendor_id, invoice_number, invoice_date, due_date,
      amount, expense_id, terms, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [vendor_id, invoice_number, invoice_date, due_date, amount, expense_id, terms, notes]);

  const payable = await db.promisify.get(`
    SELECT ap.*, v.name as vendor_name FROM accounts_payable ap
    JOIN vendors v ON ap.vendor_id = v.id WHERE ap.id = $1
  `, [result.id]);

  res.status(201).json(payable);
}));

router.post('/payables/:id/payment', validateId, validateBody(recordPaymentSchema), asyncHandler(async (req, res) => {
  const { amount } = req.body;

  const payable = await db.promisify.get('SELECT * FROM accounts_payable WHERE id = $1', [req.params.id]);
  if (!payable) {throw new NotFoundError('Payable');}

  const newAmountPaid = parseFloat(payable.amount_paid) + parseFloat(amount);
  const newStatus = newAmountPaid >= parseFloat(payable.amount) ? 'paid' : 'partial';

  await db.promisify.run(`
    UPDATE accounts_payable SET amount_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `, [newAmountPaid, newStatus, req.params.id]);

  const updated = await db.promisify.get(`
    SELECT ap.*, v.name as vendor_name FROM accounts_payable ap
    JOIN vendors v ON ap.vendor_id = v.id WHERE ap.id = $1
  `, [req.params.id]);

  res.json({
    payable: updated,
    payment_recorded: parseFloat(amount),
    remaining_balance: parseFloat(updated.amount) - parseFloat(updated.amount_paid)
  });
}));

router.get('/payables/aging', asyncHandler(async (req, res) => {
  const aging = await db.promisify.all(`
    SELECT 
      v.id as vendor_id, v.name as vendor_name,
      SUM(CASE WHEN ap.due_date >= CURRENT_DATE THEN (ap.amount - ap.amount_paid) ELSE 0 END) as current_due,
      SUM(CASE WHEN ap.due_date < CURRENT_DATE AND ap.due_date >= CURRENT_DATE - 30 THEN (ap.amount - ap.amount_paid) ELSE 0 END) as days_1_30,
      SUM(CASE WHEN ap.due_date < CURRENT_DATE - 30 AND ap.due_date >= CURRENT_DATE - 60 THEN (ap.amount - ap.amount_paid) ELSE 0 END) as days_31_60,
      SUM(CASE WHEN ap.due_date < CURRENT_DATE - 60 AND ap.due_date >= CURRENT_DATE - 90 THEN (ap.amount - ap.amount_paid) ELSE 0 END) as days_61_90,
      SUM(CASE WHEN ap.due_date < CURRENT_DATE - 90 THEN (ap.amount - ap.amount_paid) ELSE 0 END) as over_90,
      SUM(ap.amount - ap.amount_paid) as total_due
    FROM accounts_payable ap JOIN vendors v ON ap.vendor_id = v.id
    WHERE ap.status != 'paid'
    GROUP BY v.id, v.name HAVING SUM(ap.amount - ap.amount_paid) > 0
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
}));

// ============================================
// ACCOUNTS RECEIVABLE
// ============================================

router.get('/receivables', validateQuery(receivableQuerySchema), asyncHandler(async (req, res) => {
  const { status, service_type, overdue_only } = req.query;

  let sql = `
    SELECT ar.*, (ar.amount - ar.amount_received) as balance_due
    FROM accounts_receivable ar WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (status) { sql += ` AND ar.status = $${paramIndex++}`; params.push(status); }
  if (service_type) { sql += ` AND ar.service_type = $${paramIndex++}`; params.push(service_type); }
  if (overdue_only) {sql += " AND ar.due_date < CURRENT_DATE AND ar.status != 'paid'";}

  sql += ' ORDER BY ar.due_date';
  const receivables = await db.promisify.all(sql, params);
  res.json(receivables);
}));

router.post('/receivables', validateBody(createReceivableSchema), asyncHandler(async (req, res) => {
  const {
    customer_name, customer_contact, invoice_number,
    invoice_date, due_date, amount, description, service_type, notes
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO accounts_receivable (
      customer_name, customer_contact, invoice_number,
      invoice_date, due_date, amount, description, service_type, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [customer_name, customer_contact, invoice_number, invoice_date, due_date, amount, description, service_type, notes]);

  const receivable = await db.promisify.get('SELECT * FROM accounts_receivable WHERE id = $1', [result.id]);
  res.status(201).json(receivable);
}));

router.post('/receivables/:id/payment', validateId, validateBody(recordPaymentSchema), asyncHandler(async (req, res) => {
  const { amount } = req.body;

  const receivable = await db.promisify.get('SELECT * FROM accounts_receivable WHERE id = $1', [req.params.id]);
  if (!receivable) {throw new NotFoundError('Receivable');}

  const newAmountReceived = parseFloat(receivable.amount_received) + parseFloat(amount);
  const newStatus = newAmountReceived >= parseFloat(receivable.amount) ? 'paid' : 'partial';

  await db.promisify.run(`
    UPDATE accounts_receivable SET amount_received = $1, status = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `, [newAmountReceived, newStatus, req.params.id]);

  const updated = await db.promisify.get('SELECT * FROM accounts_receivable WHERE id = $1', [req.params.id]);

  res.json({
    receivable: updated,
    payment_recorded: parseFloat(amount),
    remaining_balance: parseFloat(updated.amount) - parseFloat(updated.amount_received)
  });
}));

// ============================================
// BANK ACCOUNTS
// ============================================

router.get('/bank-accounts', asyncHandler(async (req, res) => {
  const accounts = await db.promisify.all(`
    SELECT * FROM bank_accounts WHERE is_active = true
    ORDER BY is_primary DESC, account_name
  `);
  res.json(accounts);
}));

router.post('/bank-accounts', validateBody(createBankAccountSchema), asyncHandler(async (req, res) => {
  const {
    account_name, bank_name, account_type,
    account_number_last_four, routing_number,
    opening_balance, is_primary, notes
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO bank_accounts (
      account_name, bank_name, account_type,
      account_number_last_four, routing_number,
      opening_balance, current_balance, is_primary, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8)
  `, [account_name, bank_name, account_type, account_number_last_four, routing_number, opening_balance, is_primary, notes]);

  const account = await db.promisify.get('SELECT * FROM bank_accounts WHERE id = $1', [result.id]);
  res.status(201).json(account);
}));

router.get('/bank-accounts/:id/transactions', validateId, validateQuery(bankTransactionQuerySchema), asyncHandler(async (req, res) => {
  const { start_date, end_date, reconciled } = req.query;

  let sql = 'SELECT * FROM bank_transactions WHERE bank_account_id = $1';
  const params = [req.params.id];
  let paramIndex = 2;

  if (start_date) { sql += ` AND transaction_date >= $${paramIndex++}`; params.push(start_date); }
  if (end_date) { sql += ` AND transaction_date <= $${paramIndex++}`; params.push(end_date); }
  if (reconciled !== undefined) { sql += ` AND is_reconciled = $${paramIndex++}`; params.push(reconciled); }

  sql += ' ORDER BY transaction_date DESC, id DESC';
  const transactions = await db.promisify.all(sql, params);
  res.json(transactions);
}));

router.post('/bank-accounts/:id/transactions', validateId, validateBody(createBankTransactionSchema), asyncHandler(async (req, res) => {
  const {
    transaction_date, transaction_type, description, amount,
    expense_id, payroll_id, sales_date, reference_number
  } = req.body;

  const account = await db.promisify.get('SELECT current_balance FROM bank_accounts WHERE id = $1', [req.params.id]);
  if (!account) {throw new NotFoundError('Bank account');}

  const newBalance = parseFloat(account.current_balance) + parseFloat(amount);

  const result = await db.promisify.run(`
    INSERT INTO bank_transactions (
      bank_account_id, transaction_date, transaction_type, description,
      amount, running_balance, expense_id, payroll_id, sales_date, reference_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [req.params.id, transaction_date, transaction_type, description, amount, newBalance, expense_id, payroll_id, sales_date, reference_number]);

  await db.promisify.run('UPDATE bank_accounts SET current_balance = $1 WHERE id = $2', [newBalance, req.params.id]);

  const transaction = await db.promisify.get('SELECT * FROM bank_transactions WHERE id = $1', [result.id]);
  res.status(201).json(transaction);
}));

router.post('/bank-accounts/:id/reconcile', validateId, validateBody(reconcileTransactionsSchema), asyncHandler(async (req, res) => {
  const { transaction_ids, statement_ending_balance, statement_date } = req.body;

  await db.promisify.run(`
    UPDATE bank_transactions
    SET is_reconciled = true, reconciled_date = $1
    WHERE id = ANY($2::int[]) AND bank_account_id = $3
  `, [statement_date || new Date().toISOString().split('T')[0], transaction_ids, req.params.id]);

  const reconciled = await db.promisify.get(`
    SELECT COUNT(*) as count, SUM(amount) as total
    FROM bank_transactions WHERE id = ANY($1::int[])
  `, [transaction_ids]);

  res.json({
    reconciled_count: parseInt(reconciled.count),
    reconciled_total: parseFloat(reconciled.total) || 0,
    statement_ending_balance: statement_ending_balance || null
  });
}));

// ============================================
// DAILY REVENUE
// ============================================

router.get('/daily-revenue', validateQuery(dailyRevenueQuerySchema), asyncHandler(async (req, res) => {
  const { start_date, end_date, limit } = req.query;

  let sql = 'SELECT * FROM daily_revenue WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (start_date) { sql += ` AND date >= $${paramIndex++}`; params.push(start_date); }
  if (end_date) { sql += ` AND date <= $${paramIndex++}`; params.push(end_date); }
  sql += ' ORDER BY date DESC';
  if (limit) { sql += ` LIMIT $${paramIndex++}`; params.push(parseInt(limit)); }

  const revenue = await db.promisify.all(sql, params);
  res.json(revenue);
}));

router.post('/daily-revenue', validateBody(saveDailyRevenueSchema), asyncHandler(async (req, res) => {
  const {
    date, food_sales, beverage_sales, alcohol_sales,
    catering_sales, gift_card_sales, other_sales,
    discounts, comps, refunds, tips_collected,
    cash_payments, card_payments, other_payments,
    transaction_count, customer_count, weather_notes, event_notes, notes
  } = req.body;

  const grossSales = food_sales + beverage_sales + alcohol_sales + catering_sales + gift_card_sales + other_sales;
  const netSales = grossSales - discounts - comps - refunds;

  await db.promisify.run(`
    INSERT INTO daily_revenue (
      date, food_sales, beverage_sales, alcohol_sales,
      catering_sales, gift_card_sales, other_sales,
      total_gross_sales, discounts, comps, refunds, total_net_sales,
      tips_collected, cash_payments, card_payments, other_payments,
      transaction_count, customer_count, weather_notes, event_notes, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    ON CONFLICT (date) DO UPDATE SET
      food_sales = EXCLUDED.food_sales, beverage_sales = EXCLUDED.beverage_sales,
      alcohol_sales = EXCLUDED.alcohol_sales, catering_sales = EXCLUDED.catering_sales,
      gift_card_sales = EXCLUDED.gift_card_sales, other_sales = EXCLUDED.other_sales,
      total_gross_sales = EXCLUDED.total_gross_sales, discounts = EXCLUDED.discounts,
      comps = EXCLUDED.comps, refunds = EXCLUDED.refunds, total_net_sales = EXCLUDED.total_net_sales,
      tips_collected = EXCLUDED.tips_collected, cash_payments = EXCLUDED.cash_payments,
      card_payments = EXCLUDED.card_payments, other_payments = EXCLUDED.other_payments,
      transaction_count = EXCLUDED.transaction_count, customer_count = EXCLUDED.customer_count,
      weather_notes = EXCLUDED.weather_notes, event_notes = EXCLUDED.event_notes,
      notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
  `, [
    date, food_sales, beverage_sales, alcohol_sales,
    catering_sales, gift_card_sales, other_sales,
    grossSales, discounts, comps, refunds, netSales,
    tips_collected, cash_payments, card_payments, other_payments,
    transaction_count, customer_count, weather_notes, event_notes, notes
  ]);

  const revenue = await db.promisify.get('SELECT * FROM daily_revenue WHERE date = $1', [date]);
  res.json(revenue);
}));

// ============================================
// BUSINESS SETTINGS
// ============================================

router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await db.promisify.all('SELECT * FROM business_settings');
  
  const settingsObj = {};
  for (const s of settings) {
    let value = s.setting_value;
    if (s.setting_type === 'number') {value = parseFloat(value);}
    if (s.setting_type === 'boolean') {value = value === 'true';}
    if (s.setting_type === 'json') {value = JSON.parse(value || '{}');}
    settingsObj[s.setting_key] = value;
  }

  res.json(settingsObj);
}));

router.put('/settings/:key', validateBody(updateSettingSchema), asyncHandler(async (req, res) => {
  const { value } = req.body;
  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

  await db.promisify.run(`
    UPDATE business_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
    WHERE setting_key = $2
  `, [stringValue, req.params.key]);

  res.json({ key: req.params.key, value });
}));

router.put('/settings', validateBody(updateSettingsSchema), asyncHandler(async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await db.promisify.run(`
      UPDATE business_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = $2
    `, [stringValue, key]);
  }

  res.json({ updated: Object.keys(req.body).length });
}));

module.exports = router;
