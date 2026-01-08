/**
 * Tax Routes
 * Updated with centralized error handling and validation
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { asyncHandler, ValidationError } = require('../utils/errors');
const { validateBody, validateParams } = require('../middleware');
const {
  taxYearParamSchema,
  exportParamSchema,
  saveTaxDocumentSchema,
} = require('../schemas/tax.schema');

// ============================================
// SCHEDULE C
// ============================================

router.get('/schedule-c/:year', validateParams(taxYearParamSchema), asyncHandler(async (req, res) => {
  const year = req.params.year;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const revenue = await db.promisify.get(`
    SELECT COALESCE(SUM(total_net_sales), 0) as gross_receipts
    FROM daily_revenue WHERE date BETWEEN $1 AND $2
  `, [startDate, endDate]);

  const cogs = await db.promisify.get(`
    SELECT COALESCE(SUM(
      sl.quantity_sold * (
        SELECT COALESCE(SUM(rm.quantity_used * (i.purchase_price / (i.unit_conversion_factor * i.yield_percent))), 0)
        FROM recipe_map rm JOIN ingredients i ON rm.ingredient_id = i.id
        WHERE rm.menu_item_id = sl.menu_item_id
      )
    ), 0) as cost_of_goods
    FROM sales_log sl WHERE sl.date BETWEEN $1 AND $2
  `, [startDate, endDate]);

  const expenses = await db.promisify.all(`
    SELECT ec.tax_category, SUM(e.amount) as total
    FROM expenses e JOIN expense_categories ec ON e.category_id = ec.id
    WHERE e.expense_date BETWEEN $1 AND $2 AND ec.is_tax_deductible = true
    GROUP BY ec.tax_category
  `, [startDate, endDate]);

  const payroll = await db.promisify.get(`
    SELECT 
      COALESCE(SUM(gross_pay), 0) as wages,
      COALESCE(SUM(employer_social_security + employer_medicare + employer_futa + employer_suta), 0) as payroll_taxes
    FROM payroll_records
    WHERE pay_period_start >= $1 AND pay_period_end <= $2
  `, [startDate, endDate]);

  const expenseMap = {};
  for (const exp of expenses) {
    expenseMap[exp.tax_category || 'other_expenses'] = parseFloat(exp.total);
  }

  const grossReceipts = parseFloat(revenue?.gross_receipts) || 0;
  const costOfGoods = parseFloat(cogs?.cost_of_goods) || 0;
  const grossProfit = grossReceipts - costOfGoods;

  const totalExpenses = Object.values(expenseMap).reduce((s, v) => s + v, 0) + parseFloat(payroll?.wages || 0);
  const netProfit = grossProfit - totalExpenses;

  const scheduleC = {
    tax_year: year,
    part_I: {
      line_1_gross_receipts: grossReceipts,
      line_2_returns_allowances: 0,
      line_3_net_gross_receipts: grossReceipts,
      line_4_cost_of_goods: costOfGoods,
      line_5_gross_profit: grossProfit,
      line_7_gross_income: grossProfit
    },
    part_II_expenses: {
      line_8_advertising: expenseMap.advertising || 0,
      line_9_car_truck: expenseMap.car_and_truck || 0,
      line_10_commissions: expenseMap.commissions || 0,
      line_11_contract_labor: expenseMap.contract_labor || 0,
      line_12_depletion: 0,
      line_13_depreciation: expenseMap.depreciation || 0,
      line_14_employee_benefits: expenseMap.employee_benefits || 0,
      line_15_insurance: expenseMap.insurance || 0,
      line_16a_mortgage_interest: expenseMap.mortgage_interest || 0,
      line_16b_other_interest: expenseMap.other_interest || 0,
      line_17_legal_professional: expenseMap.legal_and_professional || 0,
      line_18_office_expense: expenseMap.office_expense || 0,
      line_19_pension_profit_sharing: expenseMap.pension || 0,
      line_20a_rent_vehicles: expenseMap.rent_vehicles || 0,
      line_20b_rent_other: expenseMap.rent || 0,
      line_21_repairs_maintenance: expenseMap.repairs || 0,
      line_22_supplies: expenseMap.supplies || 0,
      line_23_taxes_licenses: expenseMap.taxes_and_licenses || 0,
      line_24a_travel: expenseMap.travel || 0,
      line_24b_meals: expenseMap.meals || 0,
      line_25_utilities: expenseMap.utilities || 0,
      line_26_wages: parseFloat(payroll?.wages) || 0,
      line_27a_other: expenseMap.other_expenses || 0
    },
    part_III_cost_of_goods: {
      line_35_inventory_beginning: 0,
      line_36_purchases: costOfGoods,
      line_37_cost_of_labor: 0,
      line_38_materials_supplies: 0,
      line_39_other_costs: 0,
      line_40_add_35_39: costOfGoods,
      line_41_inventory_ending: 0,
      line_42_cost_of_goods_sold: costOfGoods
    },
    totals: {
      total_expenses: totalExpenses,
      net_profit_loss: netProfit
    }
  };

  res.json(scheduleC);
}));

// ============================================
// EXPENSE REPORTS
// ============================================

router.get('/expense-report/:year', validateParams(taxYearParamSchema), asyncHandler(async (req, res) => {
  const year = req.params.year;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const expenses = await db.promisify.all(`
    SELECT 
      e.id, e.expense_date, e.description, e.amount, e.payment_method, e.reference_number,
      ec.name as category, ec.tax_category, ec.is_tax_deductible,
      v.name as vendor_name
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    LEFT JOIN vendors v ON e.vendor_id = v.id
    WHERE e.expense_date BETWEEN $1 AND $2
    ORDER BY e.expense_date, e.id
  `, [startDate, endDate]);

  const byCategory = {};
  for (const exp of expenses) {
    const cat = exp.tax_category || 'uncategorized';
    if (!byCategory[cat]) {byCategory[cat] = { items: [], total: 0, deductible_total: 0 };}
    byCategory[cat].items.push(exp);
    byCategory[cat].total += parseFloat(exp.amount);
    if (exp.is_tax_deductible) {byCategory[cat].deductible_total += parseFloat(exp.amount);}
  }

  const byMonth = {};
  for (const exp of expenses) {
    const month = exp.expense_date.substring(0, 7);
    if (!byMonth[month]) {byMonth[month] = { total: 0, count: 0 };}
    byMonth[month].total += parseFloat(exp.amount);
    byMonth[month].count++;
  }

  res.json({
    tax_year: year,
    expenses,
    by_tax_category: byCategory,
    by_month: byMonth,
    totals: {
      total_expenses: expenses.reduce((s, e) => s + parseFloat(e.amount), 0),
      deductible_total: expenses.filter(e => e.is_tax_deductible).reduce((s, e) => s + parseFloat(e.amount), 0),
      transaction_count: expenses.length
    }
  });
}));

// ============================================
// QUARTERLY ESTIMATES
// ============================================

router.get('/quarterly-estimates/:year', validateParams(taxYearParamSchema), asyncHandler(async (req, res) => {
  const year = req.params.year;

  const quarters = [
    { q: 1, start: `${year}-01-01`, end: `${year}-03-31`, dueDate: `${year}-04-15` },
    { q: 2, start: `${year}-04-01`, end: `${year}-06-30`, dueDate: `${year}-06-15` },
    { q: 3, start: `${year}-07-01`, end: `${year}-09-30`, dueDate: `${year}-09-15` },
    { q: 4, start: `${year}-10-01`, end: `${year}-12-31`, dueDate: `${Number(year) + 1}-01-15` }
  ];

  const estimates = [];

  for (const qtr of quarters) {
    const revenue = await db.promisify.get(`
      SELECT COALESCE(SUM(total_net_sales), 0) as income
      FROM daily_revenue WHERE date BETWEEN $1 AND $2
    `, [qtr.start, qtr.end]);

    const expenses = await db.promisify.get(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE expense_date BETWEEN $1 AND $2
    `, [qtr.start, qtr.end]);

    const income = parseFloat(revenue?.income) || 0;
    const deductions = parseFloat(expenses?.total) || 0;
    const netIncome = income - deductions;
    const estimatedTax = Math.max(0, netIncome * 0.25);

    estimates.push({
      quarter: qtr.q,
      period: { start: qtr.start, end: qtr.end },
      due_date: qtr.dueDate,
      gross_income: income,
      deductions: deductions,
      net_income: netIncome,
      estimated_tax: estimatedTax,
      self_employment_tax: Math.max(0, netIncome * 0.1413)
    });
  }

  res.json({
    tax_year: year,
    quarters: estimates,
    annual_totals: {
      gross_income: estimates.reduce((s, e) => s + e.gross_income, 0),
      deductions: estimates.reduce((s, e) => s + e.deductions, 0),
      net_income: estimates.reduce((s, e) => s + e.net_income, 0),
      total_estimated_tax: estimates.reduce((s, e) => s + e.estimated_tax, 0),
      total_se_tax: estimates.reduce((s, e) => s + e.self_employment_tax, 0)
    }
  });
}));

// ============================================
// 1099 VENDORS
// ============================================

router.get('/1099-vendors/:year', validateParams(taxYearParamSchema), asyncHandler(async (req, res) => {
  const year = req.params.year;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const vendors = await db.promisify.all(`
    SELECT 
      v.id, v.name, v.email, v.phone,
      SUM(e.amount) as total_paid, COUNT(e.id) as payment_count,
      STRING_AGG(DISTINCT e.payment_method, ', ') as payment_methods
    FROM vendors v
    JOIN expenses e ON v.id = e.vendor_id
    WHERE e.expense_date BETWEEN $1 AND $2
    GROUP BY v.id, v.name, v.email, v.phone
    HAVING SUM(e.amount) >= 600
    ORDER BY total_paid DESC
  `, [startDate, endDate]);

  const requires1099 = vendors.filter(v => parseFloat(v.total_paid) >= 600);
  const nearThreshold = vendors.filter(v => parseFloat(v.total_paid) >= 400 && parseFloat(v.total_paid) < 600);

  res.json({
    tax_year: year,
    threshold: 600,
    requires_1099: requires1099.map(v => ({
      ...v,
      total_paid: parseFloat(v.total_paid),
      needs_tin: true
    })),
    near_threshold: nearThreshold.map(v => ({
      ...v,
      total_paid: parseFloat(v.total_paid)
    })),
    summary: {
      count_requires_1099: requires1099.length,
      count_near_threshold: nearThreshold.length,
      total_1099_payments: requires1099.reduce((s, v) => s + parseFloat(v.total_paid), 0)
    }
  });
}));

// ============================================
// CSV EXPORT
// ============================================

router.get('/export/:year/:type', validateParams(exportParamSchema), asyncHandler(async (req, res) => {
  const { year, type } = req.params;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  let data, filename, headers;

  if (type === 'expenses') {
    data = await db.promisify.all(`
      SELECT 
        e.expense_date as date, ec.name as category, ec.tax_category,
        v.name as vendor, e.description, e.amount,
        e.payment_method, e.reference_number,
        CASE WHEN ec.is_tax_deductible THEN 'Yes' ELSE 'No' END as tax_deductible
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN vendors v ON e.vendor_id = v.id
      WHERE e.expense_date BETWEEN $1 AND $2
      ORDER BY e.expense_date
    `, [startDate, endDate]);
    
    headers = ['Date', 'Category', 'Tax Category', 'Vendor', 'Description', 'Amount', 'Payment Method', 'Reference', 'Tax Deductible'];
    filename = `expenses_${year}.csv`;
  } else if (type === 'schedule-c') {
    res.redirect(`/api/tax/schedule-c/${year}`);
    return;
  } else if (type === '1099-vendors') {
    data = await db.promisify.all(`
      SELECT v.name, v.email, v.phone, SUM(e.amount) as total_paid
      FROM vendors v JOIN expenses e ON v.id = e.vendor_id
      WHERE e.expense_date BETWEEN $1 AND $2
      GROUP BY v.id, v.name, v.email, v.phone
      HAVING SUM(e.amount) >= 600
      ORDER BY total_paid DESC
    `, [startDate, endDate]);
    
    headers = ['Vendor Name', 'Email', 'Phone', 'Total Paid'];
    filename = `1099_vendors_${year}.csv`;
  } else {
    throw new ValidationError(`Unknown export type: ${type}`);
  }

  // Build CSV
  const csvRows = [headers.join(',')];
  for (const row of data) {
    const values = Object.values(row).map(v => {
      const str = String(v || '');
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    });
    csvRows.push(values.join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvRows.join('\n'));
}));

// ============================================
// TAX DOCUMENTS
// ============================================

router.get('/documents/:year', validateParams(taxYearParamSchema), asyncHandler(async (req, res) => {
  const docs = await db.promisify.all(`
    SELECT * FROM tax_documents WHERE tax_year = $1 ORDER BY created_at DESC
  `, [req.params.year]);
  res.json(docs);
}));

router.post('/documents', validateBody(saveTaxDocumentSchema), asyncHandler(async (req, res) => {
  const { tax_year, document_type, document_name, file_path, status, notes } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO tax_documents (tax_year, document_type, document_name, file_path, status, notes)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [tax_year, document_type, document_name, file_path, status, notes]);

  const doc = await db.promisify.get('SELECT * FROM tax_documents WHERE id = $1', [result.id]);
  res.status(201).json(doc);
}));

module.exports = router;
