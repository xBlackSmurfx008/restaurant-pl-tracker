const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================
// SCHEDULE C DATA
// ============================================

/**
 * GET /api/tax/schedule-c/:year
 * Generate Schedule C data for tax year
 */
router.get('/schedule-c/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Get gross receipts (revenue)
    const revenue = await db.promisify.get(`
      SELECT 
        COALESCE(SUM(total_gross_sales), 0) as gross_receipts,
        COALESCE(SUM(total_net_sales), 0) as net_sales,
        COALESCE(SUM(discounts + refunds), 0) as returns_allowances
      FROM daily_revenue
      WHERE date BETWEEN $1 AND $2
    `, [startDate, endDate]);

    // Get COGS
    const cogs = await db.promisify.get(`
      SELECT COALESCE(SUM(e.amount), 0) as total
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.expense_date BETWEEN $1 AND $2
        AND ec.expense_type = 'cogs'
    `, [startDate, endDate]);

    // Get expenses by Schedule C category
    const expensesByCategory = await db.promisify.all(`
      SELECT 
        ec.tax_category,
        SUM(e.amount) as amount
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.expense_date BETWEEN $1 AND $2
        AND ec.is_tax_deductible = true
        AND ec.expense_type != 'cogs'
      GROUP BY ec.tax_category
    `, [startDate, endDate]);

    // Get payroll (wages)
    const payroll = await db.promisify.get(`
      SELECT 
        COALESCE(SUM(gross_pay), 0) as wages,
        COALESCE(SUM(employer_social_security + employer_medicare + employer_futa + employer_suta), 0) as payroll_taxes
      FROM payroll_records
      WHERE pay_period_start >= $1 AND pay_period_end <= $2
    `, [startDate, endDate]);

    // Map to Schedule C lines
    const expenseMap = {};
    for (const e of expensesByCategory) {
      expenseMap[e.tax_category] = parseFloat(e.amount);
    }

    const scheduleC = {
      tax_year: year,
      
      // Part I - Income
      line_1_gross_receipts: parseFloat(revenue?.gross_receipts) || 0,
      line_2_returns_allowances: parseFloat(revenue?.returns_allowances) || 0,
      line_3_net_receipts: parseFloat(revenue?.net_sales) || 0,
      line_4_cost_of_goods_sold: parseFloat(cogs?.total) || 0,
      line_5_gross_profit: (parseFloat(revenue?.net_sales) || 0) - (parseFloat(cogs?.total) || 0),
      line_7_gross_income: (parseFloat(revenue?.net_sales) || 0) - (parseFloat(cogs?.total) || 0),

      // Part II - Expenses (common lines)
      line_8_advertising: expenseMap.advertising || 0,
      line_9_car_truck: expenseMap.car_expenses || 0,
      line_10_commissions: expenseMap.commissions || 0,
      line_11_contract_labor: expenseMap.contract_labor || 0,
      line_13_depreciation: expenseMap.depreciation || 0,
      line_14_employee_benefits: expenseMap.employee_benefits || 0,
      line_15_insurance: expenseMap.insurance || 0,
      line_16a_mortgage_interest: expenseMap.mortgage_interest || 0,
      line_16b_other_interest: expenseMap.other_interest || 0,
      line_17_legal_professional: expenseMap.legal_professional || 0,
      line_18_office_expense: expenseMap.office_expense || 0,
      line_19_pension_plans: expenseMap.pension_plans || 0,
      line_20a_rent_vehicles: expenseMap.rent_vehicles || 0,
      line_20b_rent_other: expenseMap.rent || 0,
      line_21_repairs: expenseMap.repairs || 0,
      line_22_supplies: expenseMap.supplies || 0,
      line_23_taxes_licenses: expenseMap.taxes || 0,
      line_24a_travel: expenseMap.travel || 0,
      line_24b_meals: expenseMap.meals || 0,
      line_25_utilities: expenseMap.utilities || 0,
      line_26_wages: parseFloat(payroll?.wages) || 0,
      line_27a_other_expenses: expenseMap.other_expenses || 0,
      
      // Calculated totals
      line_28_total_expenses: 0,
      line_29_tentative_profit: 0,
      line_31_net_profit: 0
    };

    // Calculate totals
    const expenseLines = [
      'line_8_advertising', 'line_9_car_truck', 'line_10_commissions', 'line_11_contract_labor',
      'line_13_depreciation', 'line_14_employee_benefits', 'line_15_insurance',
      'line_16a_mortgage_interest', 'line_16b_other_interest', 'line_17_legal_professional',
      'line_18_office_expense', 'line_19_pension_plans', 'line_20a_rent_vehicles',
      'line_20b_rent_other', 'line_21_repairs', 'line_22_supplies', 'line_23_taxes_licenses',
      'line_24a_travel', 'line_24b_meals', 'line_25_utilities', 'line_26_wages', 'line_27a_other_expenses'
    ];

    scheduleC.line_28_total_expenses = expenseLines.reduce((sum, line) => sum + (scheduleC[line] || 0), 0);
    scheduleC.line_29_tentative_profit = scheduleC.line_7_gross_income - scheduleC.line_28_total_expenses;
    scheduleC.line_31_net_profit = scheduleC.line_29_tentative_profit;

    res.json(scheduleC);
  } catch (error) {
    console.error('Schedule C error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DETAILED EXPENSE REPORT FOR TAXES
// ============================================

/**
 * GET /api/tax/expense-report/:year
 * Detailed expense list by category for tax year
 */
router.get('/expense-report/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const expenses = await db.promisify.all(`
      SELECT 
        e.id,
        e.expense_date,
        e.description,
        e.amount,
        e.payment_method,
        e.reference_number,
        v.name as vendor_name,
        ec.name as category_name,
        ec.tax_category,
        ec.expense_type
      FROM expenses e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.expense_date BETWEEN $1 AND $2
        AND ec.is_tax_deductible = true
      ORDER BY ec.tax_category, e.expense_date
    `, [startDate, endDate]);

    // Group by tax category
    const grouped = {};
    for (const exp of expenses) {
      const cat = exp.tax_category || 'other';
      if (!grouped[cat]) {
        grouped[cat] = { expenses: [], total: 0 };
      }
      grouped[cat].expenses.push(exp);
      grouped[cat].total += parseFloat(exp.amount);
    }

    res.json({
      tax_year: year,
      by_category: grouped,
      total_deductible: Object.values(grouped).reduce((s, g) => s + g.total, 0)
    });
  } catch (error) {
    console.error('Tax expense report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// QUARTERLY ESTIMATES
// ============================================

/**
 * GET /api/tax/quarterly-estimates/:year
 * Quarterly income/expense breakdown for estimated tax payments
 */
router.get('/quarterly-estimates/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);

    const quarters = [
      { q: 1, start: `${year}-01-01`, end: `${year}-03-31`, due: `${year}-04-15` },
      { q: 2, start: `${year}-04-01`, end: `${year}-06-30`, due: `${year}-06-15` },
      { q: 3, start: `${year}-07-01`, end: `${year}-09-30`, due: `${year}-09-15` },
      { q: 4, start: `${year}-10-01`, end: `${year}-12-31`, due: `${year + 1}-01-15` }
    ];

    const results = [];

    for (const q of quarters) {
      const revenue = await db.promisify.get(`
        SELECT COALESCE(SUM(total_net_sales), 0) as income
        FROM daily_revenue WHERE date BETWEEN $1 AND $2
      `, [q.start, q.end]);

      const expenses = await db.promisify.get(`
        SELECT COALESCE(SUM(amount), 0) as expenses
        FROM expenses WHERE expense_date BETWEEN $1 AND $2
      `, [q.start, q.end]);

      const payroll = await db.promisify.get(`
        SELECT COALESCE(SUM(total_employer_cost), 0) as payroll
        FROM payroll_records WHERE pay_period_start >= $1 AND pay_period_end <= $2
      `, [q.start, q.end]);

      const income = parseFloat(revenue?.income) || 0;
      const totalExpenses = (parseFloat(expenses?.expenses) || 0) + (parseFloat(payroll?.payroll) || 0);
      const netIncome = income - totalExpenses;

      // Rough self-employment tax estimate (15.3% on 92.35% of net)
      const seTaxBase = netIncome * 0.9235;
      const seTax = seTaxBase > 0 ? seTaxBase * 0.153 : 0;

      results.push({
        quarter: q.q,
        period: { start: q.start, end: q.end },
        due_date: q.due,
        gross_income: income,
        total_expenses: totalExpenses,
        net_income: netIncome,
        estimated_se_tax: seTax,
        ytd_net_income: 0 // Will calculate below
      });
    }

    // Calculate YTD
    let ytd = 0;
    for (const r of results) {
      ytd += r.net_income;
      r.ytd_net_income = ytd;
    }

    res.json({
      tax_year: year,
      quarters: results,
      annual_totals: {
        gross_income: results.reduce((s, r) => s + r.gross_income, 0),
        total_expenses: results.reduce((s, r) => s + r.total_expenses, 0),
        net_income: results.reduce((s, r) => s + r.net_income, 0),
        estimated_se_tax: results.reduce((s, r) => s + r.estimated_se_tax, 0)
      }
    });
  } catch (error) {
    console.error('Quarterly estimates error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 1099 VENDOR REPORT
// ============================================

/**
 * GET /api/tax/1099-vendors/:year
 * Vendors who may need 1099s (>$600 paid)
 */
router.get('/1099-vendors/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const vendors = await db.promisify.all(`
      SELECT 
        v.id,
        v.name,
        v.email,
        v.phone,
        SUM(e.amount) as total_paid,
        COUNT(e.id) as payment_count,
        STRING_AGG(DISTINCT e.payment_method, ', ') as payment_methods
      FROM vendors v
      JOIN expenses e ON v.id = e.vendor_id
      WHERE e.expense_date BETWEEN $1 AND $2
      GROUP BY v.id, v.name, v.email, v.phone
      HAVING SUM(e.amount) >= 600
      ORDER BY total_paid DESC
    `, [startDate, endDate]);

    res.json({
      tax_year: year,
      threshold: 600,
      vendors: vendors.map(v => ({
        ...v,
        total_paid: parseFloat(v.total_paid),
        needs_1099: true,
        has_w9: false // TODO: track W9 status
      })),
      total_vendors: vendors.length,
      total_amount: vendors.reduce((s, v) => s + parseFloat(v.total_paid), 0)
    });
  } catch (error) {
    console.error('1099 vendors error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EXPORT TAX DATA
// ============================================

/**
 * GET /api/tax/export/:year/:type
 * Export tax data as CSV
 * type: 'expenses', 'schedule-c', '1099-vendors'
 */
router.get('/export/:year/:type', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const type = req.params.type;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    let csv = '';
    let filename = '';

    if (type === 'expenses') {
      const expenses = await db.promisify.all(`
        SELECT 
          e.expense_date,
          ec.tax_category,
          ec.name as category,
          e.description,
          v.name as vendor,
          e.amount,
          e.payment_method,
          e.reference_number
        FROM expenses e
        LEFT JOIN vendors v ON e.vendor_id = v.id
        JOIN expense_categories ec ON e.category_id = ec.id
        WHERE e.expense_date BETWEEN $1 AND $2
          AND ec.is_tax_deductible = true
        ORDER BY e.expense_date
      `, [startDate, endDate]);

      csv = 'Date,Tax Category,Category,Description,Vendor,Amount,Payment Method,Reference\n';
      for (const e of expenses) {
        csv += `${e.expense_date},${e.tax_category || ''},${e.category},"${e.description}",${e.vendor || ''},${e.amount},${e.payment_method || ''},${e.reference_number || ''}\n`;
      }
      filename = `tax-expenses-${year}.csv`;

    } else if (type === '1099-vendors') {
      const vendors = await db.promisify.all(`
        SELECT 
          v.name,
          v.email,
          v.phone,
          SUM(e.amount) as total_paid
        FROM vendors v
        JOIN expenses e ON v.id = e.vendor_id
        WHERE e.expense_date BETWEEN $1 AND $2
        GROUP BY v.id, v.name, v.email, v.phone
        HAVING SUM(e.amount) >= 600
        ORDER BY v.name
      `, [startDate, endDate]);

      csv = 'Vendor Name,Email,Phone,Total Paid\n';
      for (const v of vendors) {
        csv += `"${v.name}",${v.email || ''},${v.phone || ''},${v.total_paid}\n`;
      }
      filename = `1099-vendors-${year}.csv`;

    } else {
      return res.status(400).json({ error: 'Invalid export type' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Tax export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TAX DOCUMENTS
// ============================================

/**
 * GET /api/tax/documents/:year
 * Get saved tax documents for a year
 */
router.get('/documents/:year', async (req, res) => {
  try {
    const documents = await db.promisify.all(`
      SELECT * FROM tax_documents
      WHERE tax_year = $1
      ORDER BY generated_date DESC
    `, [req.params.year]);

    res.json(documents);
  } catch (error) {
    console.error('Get tax documents error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tax/documents
 * Save a tax document record
 */
router.post('/documents', async (req, res) => {
  try {
    const { tax_year, document_type, document_name, file_path, status, notes } = req.body;

    const result = await db.promisify.run(`
      INSERT INTO tax_documents (tax_year, document_type, document_name, generated_date, file_path, status, notes)
      VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6)
    `, [tax_year, document_type, document_name, file_path || null, status || 'draft', notes || null]);

    const doc = await db.promisify.get('SELECT * FROM tax_documents WHERE id = $1', [result.id]);
    res.status(201).json(doc);
  } catch (error) {
    console.error('Save tax document error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
