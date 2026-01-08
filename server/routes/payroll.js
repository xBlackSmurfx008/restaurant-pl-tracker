/**
 * Payroll Routes
 * Updated with centralized error handling and validation
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { asyncHandler, NotFoundError, ValidationError } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  createEmployeeSchema,
  updateEmployeeSchema,
  createPayrollRecordSchema,
  runPayrollSchema,
  payrollQuerySchema,
  employeeQuerySchema,
} = require('../schemas/payroll.schema');
const { dateRangeSchema } = require('../schemas/common');

// ============================================
// EMPLOYEES
// ============================================

router.get('/employees', validateQuery(employeeQuerySchema), asyncHandler(async (req, res) => {
  const activeOnly = req.query.active_only;
  
  let sql = 'SELECT * FROM employees';
  if (activeOnly) {sql += ' WHERE is_active = true';}
  sql += ' ORDER BY last_name, first_name';

  const employees = await db.promisify.all(sql);
  res.json(employees);
}));

router.get('/employees/:id', validateId, asyncHandler(async (req, res) => {
  const employee = await db.promisify.get('SELECT * FROM employees WHERE id = $1', [req.params.id]);
  if (!employee) {throw new NotFoundError('Employee');}

  const payroll = await db.promisify.all(`
    SELECT * FROM payroll_records WHERE employee_id = $1
    ORDER BY pay_period_end DESC LIMIT 10
  `, [req.params.id]);

  res.json({ ...employee, recent_payroll: payroll });
}));

router.post('/employees', validateBody(createEmployeeSchema), asyncHandler(async (req, res) => {
  const {
    first_name, last_name, position, department,
    hire_date, pay_type, pay_rate, hours_per_week,
    ssn_last_four, address, phone, email, emergency_contact, notes
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO employees (
      first_name, last_name, position, department, hire_date,
      pay_type, pay_rate, hours_per_week, ssn_last_four,
      address, phone, email, emergency_contact, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  `, [
    first_name, last_name, position, department, hire_date,
    pay_type, pay_rate, hours_per_week, ssn_last_four,
    address, phone, email, emergency_contact, notes
  ]);

  const employee = await db.promisify.get('SELECT * FROM employees WHERE id = $1', [result.id]);
  res.status(201).json(employee);
}));

router.put('/employees/:id', validateId, validateBody(updateEmployeeSchema), asyncHandler(async (req, res) => {
  const {
    first_name, last_name, position, department,
    termination_date, pay_type, pay_rate, hours_per_week,
    is_active, ssn_last_four, address, phone, email, emergency_contact, notes
  } = req.body;

  await db.promisify.run(`
    UPDATE employees SET
      first_name = COALESCE($1, first_name),
      last_name = COALESCE($2, last_name),
      position = COALESCE($3, position),
      department = $4, termination_date = $5,
      pay_type = COALESCE($6, pay_type),
      pay_rate = COALESCE($7, pay_rate),
      hours_per_week = $8, is_active = COALESCE($9, is_active),
      ssn_last_four = $10, address = $11, phone = $12,
      email = $13, emergency_contact = $14, notes = $15
    WHERE id = $16
  `, [
    first_name, last_name, position, department,
    termination_date, pay_type, pay_rate, hours_per_week,
    is_active, ssn_last_four, address, phone, email, emergency_contact, notes,
    req.params.id
  ]);

  const employee = await db.promisify.get('SELECT * FROM employees WHERE id = $1', [req.params.id]);
  if (!employee) {throw new NotFoundError('Employee');}
  res.json(employee);
}));

// ============================================
// PAYROLL RECORDS
// ============================================

router.get('/records', validateQuery(payrollQuerySchema), asyncHandler(async (req, res) => {
  const { start_date, end_date, employee_id, department } = req.query;

  let sql = `
    SELECT pr.*, e.first_name, e.last_name, e.position, e.department
    FROM payroll_records pr
    JOIN employees e ON pr.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (start_date) { sql += ` AND pr.pay_period_start >= $${paramIndex++}`; params.push(start_date); }
  if (end_date) { sql += ` AND pr.pay_period_end <= $${paramIndex++}`; params.push(end_date); }
  if (employee_id) { sql += ` AND pr.employee_id = $${paramIndex++}`; params.push(employee_id); }
  if (department) { sql += ` AND e.department = $${paramIndex++}`; params.push(department); }

  sql += ' ORDER BY pr.pay_period_end DESC, e.last_name';
  const records = await db.promisify.all(sql, params);
  res.json(records);
}));

router.post('/records', validateBody(createPayrollRecordSchema), asyncHandler(async (req, res) => {
  const {
    employee_id, pay_period_start, pay_period_end,
    regular_hours, overtime_hours, tips_reported,
    gross_pay, federal_tax_withheld, state_tax_withheld,
    social_security_withheld, medicare_withheld, other_deductions,
    net_pay, employer_social_security, employer_medicare,
    employer_futa, employer_suta, total_employer_cost,
    payment_date, payment_method, check_number, notes
  } = req.body;

  const result = await db.promisify.run(`
    INSERT INTO payroll_records (
      employee_id, pay_period_start, pay_period_end,
      regular_hours, overtime_hours, tips_reported,
      gross_pay, federal_tax_withheld, state_tax_withheld,
      social_security_withheld, medicare_withheld, other_deductions,
      net_pay, employer_social_security, employer_medicare,
      employer_futa, employer_suta, total_employer_cost,
      payment_date, payment_method, check_number, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
  `, [
    employee_id, pay_period_start, pay_period_end,
    regular_hours, overtime_hours, tips_reported,
    gross_pay, federal_tax_withheld, state_tax_withheld,
    social_security_withheld, medicare_withheld, other_deductions,
    net_pay, employer_social_security, employer_medicare,
    employer_futa, employer_suta, total_employer_cost,
    payment_date, payment_method, check_number, notes
  ]);

  const record = await db.promisify.get(`
    SELECT pr.*, e.first_name, e.last_name
    FROM payroll_records pr JOIN employees e ON pr.employee_id = e.id
    WHERE pr.id = $1
  `, [result.id]);

  res.status(201).json(record);
}));

router.post('/run-payroll', validateBody(runPayrollSchema), asyncHandler(async (req, res) => {
  const { pay_period_start, pay_period_end, employee_hours, payment_date } = req.body;

  const results = [];

  for (const eh of employee_hours) {
    const { employee_id, regular_hours, overtime_hours, tips } = eh;

    const employee = await db.promisify.get('SELECT * FROM employees WHERE id = $1', [employee_id]);
    if (!employee) {continue;}

    const regularPay = regular_hours * parseFloat(employee.pay_rate);
    const overtimePay = overtime_hours * parseFloat(employee.pay_rate) * 1.5;
    const grossPay = regularPay + overtimePay + tips;

    // Tax calculations (simplified)
    const federalTax = grossPay * 0.12;
    const stateTax = grossPay * 0.05;
    const ssTax = grossPay * 0.062;
    const medicareTax = grossPay * 0.0145;
    const netPay = grossPay - federalTax - stateTax - ssTax - medicareTax;

    // Employer taxes
    const employerSS = grossPay * 0.062;
    const employerMedicare = grossPay * 0.0145;
    const employerFuta = grossPay * 0.006;
    const employerSuta = grossPay * 0.027;
    const totalEmployerCost = grossPay + employerSS + employerMedicare + employerFuta + employerSuta;

    const result = await db.promisify.run(`
      INSERT INTO payroll_records (
        employee_id, pay_period_start, pay_period_end,
        regular_hours, overtime_hours, tips_reported,
        gross_pay, federal_tax_withheld, state_tax_withheld,
        social_security_withheld, medicare_withheld,
        net_pay, employer_social_security, employer_medicare,
        employer_futa, employer_suta, total_employer_cost, payment_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      employee_id, pay_period_start, pay_period_end,
      regular_hours, overtime_hours, tips,
      grossPay.toFixed(2), federalTax.toFixed(2), stateTax.toFixed(2),
      ssTax.toFixed(2), medicareTax.toFixed(2),
      netPay.toFixed(2), employerSS.toFixed(2), employerMedicare.toFixed(2),
      employerFuta.toFixed(2), employerSuta.toFixed(2), totalEmployerCost.toFixed(2), payment_date
    ]);

    results.push({
      employee_id,
      employee_name: `${employee.first_name} ${employee.last_name}`,
      gross_pay: grossPay,
      net_pay: netPay,
      total_employer_cost: totalEmployerCost,
      payroll_record_id: result.id
    });
  }

  res.status(201).json({
    pay_period: { start: pay_period_start, end: pay_period_end },
    employees_processed: results.length,
    total_gross: results.reduce((s, r) => s + r.gross_pay, 0),
    total_net: results.reduce((s, r) => s + r.net_pay, 0),
    total_employer_cost: results.reduce((s, r) => s + r.total_employer_cost, 0),
    records: results
  });
}));

// ============================================
// PAYROLL SUMMARIES
// ============================================

router.get('/summary/department', validateQuery(dateRangeSchema), asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  let dateFilter = '';
  const params = [];

  if (start_date && end_date) {
    dateFilter = 'AND pr.pay_period_start >= $1 AND pr.pay_period_end <= $2';
    params.push(start_date, end_date);
  }

  const summary = await db.promisify.all(`
    SELECT 
      COALESCE(e.department, 'Unassigned') as department,
      COUNT(DISTINCT e.id) as employee_count,
      SUM(pr.regular_hours) as total_regular_hours,
      SUM(pr.overtime_hours) as total_overtime_hours,
      SUM(pr.gross_pay) as total_gross_pay,
      SUM(pr.net_pay) as total_net_pay,
      SUM(pr.total_employer_cost) as total_employer_cost
    FROM payroll_records pr
    JOIN employees e ON pr.employee_id = e.id
    WHERE 1=1 ${dateFilter}
    GROUP BY e.department
    ORDER BY total_employer_cost DESC
  `, params);

  res.json({
    period: start_date && end_date ? { start_date, end_date } : { all_time: true },
    by_department: summary.map(d => ({
      ...d,
      total_gross_pay: parseFloat(d.total_gross_pay) || 0,
      total_net_pay: parseFloat(d.total_net_pay) || 0,
      total_employer_cost: parseFloat(d.total_employer_cost) || 0
    })),
    totals: {
      employees: summary.reduce((s, d) => s + parseInt(d.employee_count), 0),
      gross_pay: summary.reduce((s, d) => s + (parseFloat(d.total_gross_pay) || 0), 0),
      employer_cost: summary.reduce((s, d) => s + (parseFloat(d.total_employer_cost) || 0), 0)
    }
  });
}));

router.get('/labor-analysis', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    throw new ValidationError('start_date and end_date are required');
  }

  const labor = await db.promisify.get(`
    SELECT 
      COALESCE(SUM(total_employer_cost), 0) as total_labor_cost,
      COALESCE(SUM(regular_hours + overtime_hours), 0) as total_hours,
      COUNT(DISTINCT employee_id) as employees_paid
    FROM payroll_records
    WHERE pay_period_start >= $1 AND pay_period_end <= $2
  `, [start_date, end_date]);

  const revenue = await db.promisify.get(`
    SELECT SUM(total_net_sales) as total_revenue
    FROM daily_revenue WHERE date BETWEEN $1 AND $2
  `, [start_date, end_date]);

  const laborCost = parseFloat(labor?.total_labor_cost) || 0;
  const totalRevenue = parseFloat(revenue?.total_revenue) || 0;

  res.json({
    period: { start_date, end_date },
    labor: {
      total_cost: laborCost,
      total_hours: parseFloat(labor?.total_hours) || 0,
      employees_paid: parseInt(labor?.employees_paid) || 0,
      avg_cost_per_hour: labor?.total_hours > 0 
        ? (laborCost / parseFloat(labor.total_hours)).toFixed(2) : 0
    },
    revenue: totalRevenue,
    labor_cost_percent: totalRevenue > 0 ? ((laborCost / totalRevenue) * 100).toFixed(1) : 0,
    revenue_per_labor_hour: labor?.total_hours > 0 
      ? (totalRevenue / parseFloat(labor.total_hours)).toFixed(2) : 0
  });
}));

module.exports = router;
