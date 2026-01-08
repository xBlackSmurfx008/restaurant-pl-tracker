/**
 * Labor Operations Routes
 * Scheduling, timeclock, tips, payroll exports
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const LaborService = require('../services/LaborService');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleQuerySchema,
  clockInSchema,
  clockOutSchema,
  breakSchema,
  adjustTimeclockSchema,
  timeclockQuerySchema,
  createTipRecordSchema,
  tipPoolSessionSchema,
  distributeTipPoolSchema,
  tipQuerySchema,
  payrollExportSchema,
} = require('../schemas/labor.schema');

// Instantiate service
const laborService = new LaborService(db.pool);

// ============================================
// SCHEDULING
// ============================================

/**
 * GET /schedules - List schedules
 */
router.get(
  '/schedules',
  validateQuery(scheduleQuerySchema),
  asyncHandler(async (req, res) => {
    const { employee_id, start_date, end_date, department, status } = req.query;

    let sql = `
      SELECT s.*, e.first_name, e.last_name, e.position as employee_position
      FROM schedules s
      JOIN employees e ON s.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (employee_id) {
      sql += ` AND s.employee_id = $${p++}`;
      params.push(employee_id);
    }
    if (start_date) {
      sql += ` AND s.schedule_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND s.schedule_date <= $${p++}`;
      params.push(end_date);
    }
    if (department) {
      sql += ` AND s.department = $${p++}`;
      params.push(department);
    }
    if (status) {
      sql += ` AND s.status = $${p++}`;
      params.push(status);
    }

    sql += ' ORDER BY s.schedule_date, s.shift_start, e.last_name';

    const schedules = await db.promisify.all(sql, params);
    res.json(schedules);
  })
);

/**
 * POST /schedules - Create schedule
 */
router.post(
  '/schedules',
  validateBody(createScheduleSchema),
  asyncHandler(async (req, res) => {
    const {
      employee_id, schedule_date, shift_start, shift_end,
      break_minutes, position, department, notes, created_by
    } = req.body;

    const result = await db.promisify.run(
      `INSERT INTO schedules (
         employee_id, schedule_date, shift_start, shift_end,
         break_minutes, position, department, notes, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [employee_id, schedule_date, shift_start, shift_end, break_minutes, position, department, notes, created_by]
    );

    const schedule = await db.promisify.get(
      `SELECT s.*, e.first_name, e.last_name
       FROM schedules s JOIN employees e ON s.employee_id = e.id
       WHERE s.id = $1`,
      [result.id]
    );
    res.status(201).json(schedule);
  })
);

/**
 * POST /schedules/bulk - Create multiple schedules
 */
router.post(
  '/schedules/bulk',
  asyncHandler(async (req, res) => {
    const { schedules } = req.body;
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      throw new Error('Schedules array is required');
    }

    const created = [];
    for (const sched of schedules) {
      const result = await db.promisify.run(
        `INSERT INTO schedules (
           employee_id, schedule_date, shift_start, shift_end,
           break_minutes, position, department, notes, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [sched.employee_id, sched.schedule_date, sched.shift_start, sched.shift_end,
         sched.break_minutes || 0, sched.position, sched.department, sched.notes, sched.created_by]
      );
      created.push({ id: result.id, ...sched });
    }

    res.status(201).json({ created: created.length, schedules: created });
  })
);

/**
 * PUT /schedules/:id - Update schedule
 */
router.put(
  '/schedules/:id',
  validateId,
  validateBody(updateScheduleSchema),
  asyncHandler(async (req, res) => {
    const { shift_start, shift_end, break_minutes, position, department, status, notes } = req.body;

    await db.promisify.run(
      `UPDATE schedules SET
         shift_start = COALESCE($1, shift_start),
         shift_end = COALESCE($2, shift_end),
         break_minutes = COALESCE($3, break_minutes),
         position = COALESCE($4, position),
         department = COALESCE($5, department),
         status = COALESCE($6, status),
         notes = $7,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [shift_start, shift_end, break_minutes, position, department, status, notes, req.params.id]
    );

    const schedule = await db.promisify.get('SELECT * FROM schedules WHERE id = $1', [req.params.id]);
    if (!schedule) {
      throw new NotFoundError('Schedule');
    }
    res.json(schedule);
  })
);

/**
 * DELETE /schedules/:id - Delete schedule
 */
router.delete(
  '/schedules/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const result = await db.promisify.run('DELETE FROM schedules WHERE id = $1', [req.params.id]);
    if (result.changes === 0) {
      throw new NotFoundError('Schedule');
    }
    res.json({ success: true, message: 'Schedule deleted' });
  })
);

// ============================================
// TIMECLOCK
// ============================================

/**
 * GET /timeclock - List timeclock entries
 */
router.get(
  '/timeclock',
  validateQuery(timeclockQuerySchema),
  asyncHandler(async (req, res) => {
    const { employee_id, start_date, end_date, status, department } = req.query;

    let sql = `
      SELECT tc.*, e.first_name, e.last_name,
        CASE WHEN tc.clock_out IS NOT NULL THEN
          EXTRACT(EPOCH FROM (tc.clock_out - tc.clock_in)) / 3600 - COALESCE(tc.total_break_minutes, 0) / 60
        ELSE
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tc.clock_in)) / 3600 - COALESCE(tc.total_break_minutes, 0) / 60
        END as hours_worked
      FROM timeclock_entries tc
      JOIN employees e ON tc.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (employee_id) {
      sql += ` AND tc.employee_id = $${p++}`;
      params.push(employee_id);
    }
    if (start_date) {
      sql += ` AND DATE(tc.clock_in) >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND DATE(tc.clock_in) <= $${p++}`;
      params.push(end_date);
    }
    if (status) {
      sql += ` AND tc.status = $${p++}`;
      params.push(status);
    }
    if (department) {
      sql += ` AND tc.department = $${p++}`;
      params.push(department);
    }

    sql += ' ORDER BY tc.clock_in DESC LIMIT 500';

    const entries = await db.promisify.all(sql, params);
    res.json(entries);
  })
);

/**
 * GET /timeclock/active - Get all currently clocked-in employees
 */
router.get(
  '/timeclock/active',
  asyncHandler(async (req, res) => {
    const entries = await db.promisify.all(`
      SELECT tc.*, e.first_name, e.last_name, e.position as employee_position,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tc.clock_in)) / 3600 as hours_since_clock_in
      FROM timeclock_entries tc
      JOIN employees e ON tc.employee_id = e.id
      WHERE tc.clock_out IS NULL
      ORDER BY tc.clock_in
    `);
    res.json(entries);
  })
);

/**
 * POST /timeclock/clock-in - Clock in
 */
router.post(
  '/timeclock/clock-in',
  validateBody(clockInSchema),
  asyncHandler(async (req, res) => {
    const entry = await laborService.clockIn(req.body);
    res.status(201).json(entry);
  })
);

/**
 * POST /timeclock/:id/clock-out - Clock out
 */
router.post(
  '/timeclock/:id/clock-out',
  validateId,
  validateBody(clockOutSchema),
  asyncHandler(async (req, res) => {
    const entry = await laborService.clockOut(req.params.id, req.body.clock_out, req.body.notes);
    res.json(entry);
  })
);

/**
 * POST /timeclock/:id/break - Start/end break
 */
router.post(
  '/timeclock/:id/break',
  validateId,
  validateBody(breakSchema),
  asyncHandler(async (req, res) => {
    const entry = await laborService.handleBreak(req.params.id, req.body.action);
    res.json(entry);
  })
);

/**
 * PUT /timeclock/:id/adjust - Adjust timeclock entry
 */
router.put(
  '/timeclock/:id/adjust',
  validateId,
  validateBody(adjustTimeclockSchema),
  asyncHandler(async (req, res) => {
    const { clock_in, clock_out, total_break_minutes, adjusted_by, adjustment_reason } = req.body;

    await db.promisify.run(
      `UPDATE timeclock_entries SET
         clock_in = COALESCE($1, clock_in),
         clock_out = $2,
         total_break_minutes = COALESCE($3, total_break_minutes),
         status = 'adjusted',
         adjusted_by = $4,
         adjusted_at = CURRENT_TIMESTAMP,
         adjustment_reason = $5
       WHERE id = $6`,
      [clock_in, clock_out, total_break_minutes, adjusted_by, adjustment_reason, req.params.id]
    );

    const entry = await db.promisify.get('SELECT * FROM timeclock_entries WHERE id = $1', [req.params.id]);
    if (!entry) {
      throw new NotFoundError('Timeclock entry');
    }
    res.json(entry);
  })
);

/**
 * GET /timeclock/employee/:employeeId/active - Get active entry for employee
 */
router.get(
  '/timeclock/employee/:employeeId/active',
  asyncHandler(async (req, res) => {
    const entry = await laborService.getActiveEntry(req.params.employeeId);
    res.json(entry || { active: false });
  })
);

// ============================================
// TIPS
// ============================================

/**
 * GET /tips - List tip records
 */
router.get(
  '/tips',
  validateQuery(tipQuerySchema),
  asyncHandler(async (req, res) => {
    const { employee_id, start_date, end_date } = req.query;

    let sql = `
      SELECT tr.*, e.first_name, e.last_name
      FROM tip_records tr
      JOIN employees e ON tr.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (employee_id) {
      sql += ` AND tr.employee_id = $${p++}`;
      params.push(employee_id);
    }
    if (start_date) {
      sql += ` AND tr.shift_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND tr.shift_date <= $${p++}`;
      params.push(end_date);
    }

    sql += ' ORDER BY tr.shift_date DESC, e.last_name';

    const tips = await db.promisify.all(sql, params);
    res.json(tips);
  })
);

/**
 * POST /tips - Create tip record
 */
router.post(
  '/tips',
  validateBody(createTipRecordSchema),
  asyncHandler(async (req, res) => {
    const {
      employee_id, shift_date, timeclock_entry_id,
      cash_tips, credit_tips, tip_out_given, hours_worked, notes
    } = req.body;

    const total_tips = parseFloat(cash_tips) + parseFloat(credit_tips) - parseFloat(tip_out_given);

    const result = await db.promisify.run(
      `INSERT INTO tip_records (
         employee_id, shift_date, timeclock_entry_id,
         cash_tips, credit_tips, tip_out_given, total_tips, hours_worked, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [employee_id, shift_date, timeclock_entry_id, cash_tips, credit_tips, tip_out_given, total_tips, hours_worked, notes]
    );

    const tip = await db.promisify.get('SELECT * FROM tip_records WHERE id = $1', [result.id]);
    res.status(201).json(tip);
  })
);

/**
 * GET /tips/summary - Get tip summary by period
 */
router.get(
  '/tips/summary',
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    if (start_date && end_date) {
      dateFilter = 'WHERE shift_date BETWEEN $1 AND $2';
      params.push(start_date, end_date);
    }

    const summary = await db.promisify.all(`
      SELECT e.id as employee_id, e.first_name, e.last_name, e.department,
        COUNT(tr.id) as shift_count,
        SUM(tr.hours_worked) as total_hours,
        SUM(tr.cash_tips) as total_cash_tips,
        SUM(tr.credit_tips) as total_credit_tips,
        SUM(tr.tip_out_given) as total_tip_out,
        SUM(COALESCE(tr.tip_pool_received, 0)) as total_pool_received,
        SUM(tr.total_tips) as total_tips,
        CASE WHEN SUM(tr.hours_worked) > 0 
          THEN SUM(tr.total_tips) / SUM(tr.hours_worked)
          ELSE 0 
        END as tips_per_hour
      FROM employees e
      LEFT JOIN tip_records tr ON e.id = tr.employee_id ${dateFilter ? 'AND ' + dateFilter.replace('WHERE ', '') : ''}
      WHERE e.is_active = true
      GROUP BY e.id, e.first_name, e.last_name, e.department
      HAVING SUM(tr.total_tips) > 0
      ORDER BY total_tips DESC
    `, params);

    res.json(summary);
  })
);

// ============================================
// TIP POOLS
// ============================================

/**
 * GET /tip-pools - List tip pool sessions
 */
router.get(
  '/tip-pools',
  asyncHandler(async (req, res) => {
    const pools = await db.promisify.all(`
      SELECT tps.*,
        (SELECT COUNT(*) FROM tip_pool_distributions WHERE pool_session_id = tps.id) as distribution_count
      FROM tip_pool_sessions tps
      ORDER BY tps.pool_date DESC
    `);
    res.json(pools);
  })
);

/**
 * POST /tip-pools - Create tip pool session
 */
router.post(
  '/tip-pools',
  validateBody(tipPoolSessionSchema),
  asyncHandler(async (req, res) => {
    const { pool_date, pool_type, total_pool_amount, distribution_method, notes } = req.body;

    const result = await db.promisify.run(
      `INSERT INTO tip_pool_sessions (pool_date, pool_type, total_pool_amount, distribution_method, notes)
       VALUES ($1,$2,$3,$4,$5)`,
      [pool_date, pool_type, total_pool_amount, distribution_method, notes]
    );

    const pool = await db.promisify.get('SELECT * FROM tip_pool_sessions WHERE id = $1', [result.id]);
    res.status(201).json(pool);
  })
);

/**
 * POST /tip-pools/:id/calculate - Calculate distribution
 */
router.post(
  '/tip-pools/:id/calculate',
  validateId,
  asyncHandler(async (req, res) => {
    const result = await laborService.calculateTipPool(req.params.id);
    res.json(result);
  })
);

/**
 * POST /tip-pools/:id/distribute - Distribute approved pool
 */
router.post(
  '/tip-pools/:id/distribute',
  validateId,
  validateBody(distributeTipPoolSchema),
  asyncHandler(async (req, res) => {
    const result = await laborService.distributeTipPool(req.params.id, req.body.approved_by);
    res.json(result);
  })
);

/**
 * GET /tip-pools/:id - Get pool with distributions
 */
router.get(
  '/tip-pools/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const pool = await db.promisify.get('SELECT * FROM tip_pool_sessions WHERE id = $1', [req.params.id]);
    if (!pool) {
      throw new NotFoundError('Tip pool session');
    }

    const distributions = await db.promisify.all(`
      SELECT tpd.*, e.first_name, e.last_name
      FROM tip_pool_distributions tpd
      JOIN employees e ON tpd.employee_id = e.id
      WHERE tpd.pool_session_id = $1
      ORDER BY tpd.amount DESC
    `, [req.params.id]);

    res.json({ ...pool, distributions });
  })
);

// ============================================
// PAYROLL EXPORT
// ============================================

/**
 * GET /payroll-export - Generate payroll-ready data
 */
router.get(
  '/payroll-export',
  validateQuery(payrollExportSchema),
  asyncHandler(async (req, res) => {
    const { start_date, end_date, include_tips, format } = req.query;
    
    const data = await laborService.generatePayrollExport(start_date, end_date, include_tips);
    
    if (format === 'csv') {
      // Generate CSV
      const headers = Object.keys(data.employees[0] || {}).join(',');
      const rows = data.employees.map(e => Object.values(e).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=payroll_${start_date}_${end_date}.csv`);
      res.send(headers + '\n' + rows);
    } else {
      res.json(data);
    }
  })
);

/**
 * GET /labor-analytics - Get labor cost analytics
 */
router.get(
  '/labor-analytics',
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;
    
    // Get labor hours and costs
    const laborData = await db.promisify.all(`
      SELECT 
        DATE(tc.clock_in) as work_date,
        tc.department,
        SUM(EXTRACT(EPOCH FROM (tc.clock_out - tc.clock_in)) / 3600 - COALESCE(tc.total_break_minutes, 0) / 60) as total_hours,
        SUM((EXTRACT(EPOCH FROM (tc.clock_out - tc.clock_in)) / 3600 - COALESCE(tc.total_break_minutes, 0) / 60) * e.pay_rate) as labor_cost
      FROM timeclock_entries tc
      JOIN employees e ON tc.employee_id = e.id
      WHERE tc.clock_out IS NOT NULL
        AND tc.status IN ('completed', 'approved')
        ${start_date ? 'AND DATE(tc.clock_in) >= $1' : ''}
        ${end_date ? `AND DATE(tc.clock_in) <= $${start_date ? 2 : 1}` : ''}
      GROUP BY DATE(tc.clock_in), tc.department
      ORDER BY work_date, tc.department
    `, [start_date, end_date].filter(Boolean));

    // Get revenue for the same period
    const revenueData = await db.promisify.all(`
      SELECT date, total_net_sales
      FROM daily_revenue
      WHERE 1=1
        ${start_date ? 'AND date >= $1' : ''}
        ${end_date ? `AND date <= $${start_date ? 2 : 1}` : ''}
      ORDER BY date
    `, [start_date, end_date].filter(Boolean));

    // Calculate labor percentage
    const totalLabor = laborData.reduce((sum, d) => sum + parseFloat(d.labor_cost || 0), 0);
    const totalRevenue = revenueData.reduce((sum, d) => sum + parseFloat(d.total_net_sales || 0), 0);
    const laborPercentage = totalRevenue > 0 ? (totalLabor / totalRevenue * 100) : 0;

    res.json({
      period: { start_date, end_date },
      by_date_department: laborData,
      revenue: revenueData,
      totals: {
        total_labor_cost: totalLabor.toFixed(2),
        total_revenue: totalRevenue.toFixed(2),
        labor_percentage: laborPercentage.toFixed(2),
      },
    });
  })
);

// Export router and service
module.exports = router;
module.exports.laborService = laborService;

