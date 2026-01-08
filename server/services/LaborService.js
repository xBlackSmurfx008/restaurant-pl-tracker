/**
 * LaborService
 * Handles labor operations: scheduling, timeclock, tips, payroll exports
 */
const { ValidationError, NotFoundError } = require('../utils/errors');
const { serviceLogger } = require('../utils/logger');

class LaborService {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
    this.logger = serviceLogger.child({ service: 'labor' });
  }

  // ============================================
  // TIMECLOCK
  // ============================================

  /**
   * Clock in an employee
   */
  async clockIn(input) {
    const {
      employee_id,
      clock_in = new Date().toISOString(),
      department = null,
      position = null,
      schedule_id = null,
      notes = null,
    } = input;

    // Check for existing active clock-in
    const existing = await this.pool.query(
      'SELECT id FROM timeclock_entries WHERE employee_id = $1 AND clock_out IS NULL',
      [employee_id]
    );
    if (existing.rows.length > 0) {
      throw new ValidationError('Employee already clocked in');
    }

    // Verify employee exists
    const emp = await this.pool.query('SELECT * FROM employees WHERE id = $1', [employee_id]);
    if (emp.rows.length === 0) {
      throw new NotFoundError('Employee');
    }

    const result = await this.pool.query(
      `INSERT INTO timeclock_entries (employee_id, clock_in, department, position, schedule_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [employee_id, clock_in, department || emp.rows[0].department, position || emp.rows[0].position, schedule_id, notes]
    );

    this.logger.info({ entryId: result.rows[0].id, employee_id }, 'Employee clocked in');

    return result.rows[0];
  }

  /**
   * Clock out an employee
   */
  async clockOut(entryId, clockOutTime = null, notes = null) {
    const entry = await this.pool.query(
      'SELECT * FROM timeclock_entries WHERE id = $1',
      [entryId]
    );
    if (entry.rows.length === 0) {
      throw new NotFoundError('Timeclock entry');
    }
    if (entry.rows[0].clock_out) {
      throw new ValidationError('Already clocked out');
    }

    const clockOut = clockOutTime || new Date().toISOString();
    const clockIn = new Date(entry.rows[0].clock_in);
    const clockOutDate = new Date(clockOut);
    
    // Calculate total hours (minus breaks)
    const totalMinutes = Math.round((clockOutDate - clockIn) / 60000);
    const breakMinutes = entry.rows[0].total_break_minutes || 0;
    const workedMinutes = Math.max(0, totalMinutes - breakMinutes);

    const result = await this.pool.query(
      `UPDATE timeclock_entries SET
         clock_out = $1,
         status = 'completed',
         notes = COALESCE($2, notes)
       WHERE id = $3
       RETURNING *`,
      [clockOut, notes, entryId]
    );

    this.logger.info(
      { entryId, workedMinutes, breakMinutes },
      'Employee clocked out'
    );

    return { ...result.rows[0], worked_minutes: workedMinutes };
  }

  /**
   * Start or end a break
   */
  async handleBreak(entryId, action) {
    const entry = await this.pool.query(
      'SELECT * FROM timeclock_entries WHERE id = $1',
      [entryId]
    );
    if (entry.rows.length === 0) {
      throw new NotFoundError('Timeclock entry');
    }
    if (entry.rows[0].clock_out) {
      throw new ValidationError('Cannot modify break for completed entry');
    }

    const now = new Date().toISOString();

    if (action === 'start') {
      if (entry.rows[0].break_start && !entry.rows[0].break_end) {
        throw new ValidationError('Break already in progress');
      }
      await this.pool.query(
        'UPDATE timeclock_entries SET break_start = $1, break_end = NULL WHERE id = $2',
        [now, entryId]
      );
    } else {
      if (!entry.rows[0].break_start) {
        throw new ValidationError('No break in progress');
      }
      const breakStart = new Date(entry.rows[0].break_start);
      const breakMinutes = Math.round((new Date(now) - breakStart) / 60000);
      const totalBreakMinutes = (entry.rows[0].total_break_minutes || 0) + breakMinutes;

      await this.pool.query(
        'UPDATE timeclock_entries SET break_end = $1, total_break_minutes = $2 WHERE id = $3',
        [now, totalBreakMinutes, entryId]
      );
    }

    const updated = await this.pool.query('SELECT * FROM timeclock_entries WHERE id = $1', [entryId]);
    return updated.rows[0];
  }

  /**
   * Get current active entry for employee
   */
  async getActiveEntry(employeeId) {
    const result = await this.pool.query(
      'SELECT * FROM timeclock_entries WHERE employee_id = $1 AND clock_out IS NULL',
      [employeeId]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // TIP POOLING
  // ============================================

  /**
   * Calculate tip pool distribution
   */
  async calculateTipPool(sessionId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const session = await client.query(
        'SELECT * FROM tip_pool_sessions WHERE id = $1 FOR UPDATE',
        [sessionId]
      );
      if (session.rows.length === 0) {
        throw new NotFoundError('Tip pool session');
      }
      const pool = session.rows[0];

      // Get all eligible employees based on pool type and their hours
      let employeeQuery = `
        SELECT e.id as employee_id, e.department, e.position,
          COALESCE(SUM(
            EXTRACT(EPOCH FROM (COALESCE(tc.clock_out, CURRENT_TIMESTAMP) - tc.clock_in)) / 3600
            - COALESCE(tc.total_break_minutes, 0) / 60
          ), 0) as hours_worked
        FROM employees e
        LEFT JOIN timeclock_entries tc ON e.id = tc.employee_id
          AND DATE(tc.clock_in) = $1
          AND tc.status IN ('completed', 'approved')
        WHERE e.is_active = true
      `;
      const params = [pool.pool_date];

      // Filter by pool type
      if (pool.pool_type === 'front_of_house') {
        employeeQuery += ` AND e.department IN ('front_of_house', 'front')`;
      } else if (pool.pool_type === 'bar') {
        employeeQuery += ` AND e.position ILIKE '%bar%'`;
      } else if (pool.pool_type === 'kitchen') {
        employeeQuery += ` AND e.department = 'kitchen'`;
      }

      employeeQuery += ' GROUP BY e.id, e.department, e.position HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(tc.clock_out, CURRENT_TIMESTAMP) - tc.clock_in)) / 3600), 0) > 0';

      const employees = await client.query(employeeQuery, params);

      if (employees.rows.length === 0) {
        throw new ValidationError('No eligible employees found for tip pool');
      }

      // Clear existing distributions
      await client.query('DELETE FROM tip_pool_distributions WHERE pool_session_id = $1', [sessionId]);

      // Calculate distribution based on method
      const totalHours = employees.rows.reduce((sum, e) => sum + parseFloat(e.hours_worked), 0);
      const distributions = [];

      for (const emp of employees.rows) {
        let sharePercentage = 0;
        let amount = 0;

        switch (pool.distribution_method) {
          case 'hours_worked':
            sharePercentage = totalHours > 0 ? parseFloat(emp.hours_worked) / totalHours : 0;
            amount = parseFloat(pool.total_pool_amount) * sharePercentage;
            break;
          case 'equal':
            sharePercentage = 1 / employees.rows.length;
            amount = parseFloat(pool.total_pool_amount) / employees.rows.length;
            break;
          case 'points':
            // Points-based would require additional logic/tables
            sharePercentage = 1 / employees.rows.length;
            amount = parseFloat(pool.total_pool_amount) / employees.rows.length;
            break;
        }

        const distResult = await client.query(
          `INSERT INTO tip_pool_distributions (pool_session_id, employee_id, hours_worked, share_percentage, amount)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [sessionId, emp.employee_id, emp.hours_worked, sharePercentage, Math.round(amount * 100) / 100]
        );
        distributions.push(distResult.rows[0]);
      }

      // Update session status
      await client.query(
        `UPDATE tip_pool_sessions SET status = 'calculated', calculated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [sessionId]
      );

      await client.query('COMMIT');

      this.logger.info(
        { sessionId, employeeCount: distributions.length, totalAmount: pool.total_pool_amount },
        'Tip pool calculated'
      );

      return { session: pool, distributions };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Distribute approved tip pool
   */
  async distributeTipPool(sessionId, approvedBy) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const session = await client.query(
        'SELECT * FROM tip_pool_sessions WHERE id = $1 FOR UPDATE',
        [sessionId]
      );
      if (session.rows.length === 0) {
        throw new NotFoundError('Tip pool session');
      }
      if (session.rows[0].status !== 'calculated') {
        throw new ValidationError('Pool must be calculated before distribution');
      }

      // Get distributions
      const distributions = await client.query(
        'SELECT * FROM tip_pool_distributions WHERE pool_session_id = $1',
        [sessionId]
      );

      // Create or update tip records for each employee
      for (const dist of distributions.rows) {
        // Check for existing tip record
        const existingTip = await client.query(
          'SELECT * FROM tip_records WHERE employee_id = $1 AND shift_date = $2',
          [dist.employee_id, session.rows[0].pool_date]
        );

        if (existingTip.rows.length > 0) {
          // Update existing record
          await client.query(
            `UPDATE tip_records SET
               tip_pool_received = COALESCE(tip_pool_received, 0) + $1,
               total_tips = cash_tips + credit_tips - tip_out_given + COALESCE(tip_pool_received, 0) + $1
             WHERE id = $2`,
            [dist.amount, existingTip.rows[0].id]
          );
          await client.query(
            'UPDATE tip_pool_distributions SET tip_record_id = $1 WHERE id = $2',
            [existingTip.rows[0].id, dist.id]
          );
        } else {
          // Create new tip record
          const tipResult = await client.query(
            `INSERT INTO tip_records (employee_id, shift_date, tip_pool_received, total_tips, hours_worked)
             VALUES ($1, $2, $3, $3, $4)
             RETURNING *`,
            [dist.employee_id, session.rows[0].pool_date, dist.amount, dist.hours_worked]
          );
          await client.query(
            'UPDATE tip_pool_distributions SET tip_record_id = $1 WHERE id = $2',
            [tipResult.rows[0].id, dist.id]
          );
        }
      }

      // Update session status
      await client.query(
        `UPDATE tip_pool_sessions SET
           status = 'distributed',
           approved_by = $1,
           approved_at = CURRENT_TIMESTAMP,
           distributed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [approvedBy, sessionId]
      );

      await client.query('COMMIT');

      this.logger.info(
        { sessionId, distributionCount: distributions.rows.length },
        'Tip pool distributed'
      );

      return { session_id: sessionId, distributions_applied: distributions.rows.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ============================================
  // PAYROLL EXPORT
  // ============================================

  /**
   * Generate payroll-ready export data
   */
  async generatePayrollExport(startDate, endDate, includeTips = true) {
    const employees = await this.pool.query(`
      SELECT e.*,
        COALESCE(tc.total_hours, 0) as total_hours,
        COALESCE(tc.regular_hours, 0) as regular_hours,
        COALESCE(tc.overtime_hours, 0) as overtime_hours,
        COALESCE(tips.total_tips, 0) as total_tips,
        COALESCE(tips.cash_tips, 0) as cash_tips,
        COALESCE(tips.credit_tips, 0) as credit_tips,
        COALESCE(tips.tip_pool_received, 0) as tip_pool_received
      FROM employees e
      LEFT JOIN (
        SELECT employee_id,
          SUM(
            EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
            - COALESCE(total_break_minutes, 0) / 60
          ) as total_hours,
          LEAST(40, SUM(
            EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
            - COALESCE(total_break_minutes, 0) / 60
          )) as regular_hours,
          GREATEST(0, SUM(
            EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
            - COALESCE(total_break_minutes, 0) / 60
          ) - 40) as overtime_hours
        FROM timeclock_entries
        WHERE DATE(clock_in) BETWEEN $1 AND $2
          AND clock_out IS NOT NULL
          AND status IN ('completed', 'approved')
        GROUP BY employee_id
      ) tc ON e.id = tc.employee_id
      LEFT JOIN (
        SELECT employee_id,
          SUM(total_tips) as total_tips,
          SUM(cash_tips) as cash_tips,
          SUM(credit_tips) as credit_tips,
          SUM(COALESCE(tip_pool_received, 0)) as tip_pool_received
        FROM tip_records
        WHERE shift_date BETWEEN $1 AND $2
        GROUP BY employee_id
      ) tips ON e.id = tips.employee_id
      WHERE e.is_active = true
        AND (tc.total_hours > 0 OR tips.total_tips > 0)
      ORDER BY e.last_name, e.first_name
    `, [startDate, endDate]);

    // Calculate pay for each employee
    const payrollData = employees.rows.map(emp => {
      const regularPay = parseFloat(emp.regular_hours) * parseFloat(emp.pay_rate);
      const overtimePay = parseFloat(emp.overtime_hours) * parseFloat(emp.pay_rate) * 1.5;
      const grossPay = emp.pay_type === 'salary' 
        ? parseFloat(emp.pay_rate) / 26 // Biweekly salary
        : regularPay + overtimePay;

      return {
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department,
        position: emp.position,
        pay_type: emp.pay_type,
        pay_rate: parseFloat(emp.pay_rate),
        total_hours: parseFloat(emp.total_hours || 0).toFixed(2),
        regular_hours: parseFloat(emp.regular_hours || 0).toFixed(2),
        overtime_hours: parseFloat(emp.overtime_hours || 0).toFixed(2),
        regular_pay: regularPay.toFixed(2),
        overtime_pay: overtimePay.toFixed(2),
        gross_pay: grossPay.toFixed(2),
        ...(includeTips && {
          cash_tips: parseFloat(emp.cash_tips || 0).toFixed(2),
          credit_tips: parseFloat(emp.credit_tips || 0).toFixed(2),
          tip_pool_received: parseFloat(emp.tip_pool_received || 0).toFixed(2),
          total_tips: parseFloat(emp.total_tips || 0).toFixed(2),
        }),
      };
    });

    const totals = {
      total_regular_hours: payrollData.reduce((sum, e) => sum + parseFloat(e.regular_hours), 0).toFixed(2),
      total_overtime_hours: payrollData.reduce((sum, e) => sum + parseFloat(e.overtime_hours), 0).toFixed(2),
      total_regular_pay: payrollData.reduce((sum, e) => sum + parseFloat(e.regular_pay), 0).toFixed(2),
      total_overtime_pay: payrollData.reduce((sum, e) => sum + parseFloat(e.overtime_pay), 0).toFixed(2),
      total_gross_pay: payrollData.reduce((sum, e) => sum + parseFloat(e.gross_pay), 0).toFixed(2),
      ...(includeTips && {
        total_tips: payrollData.reduce((sum, e) => sum + parseFloat(e.total_tips || 0), 0).toFixed(2),
      }),
    };

    return {
      period: { start_date: startDate, end_date: endDate },
      employees: payrollData,
      totals,
      employee_count: payrollData.length,
    };
  }
}

module.exports = LaborService;

