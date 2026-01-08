const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================
// P&L STATEMENT
// ============================================

/**
 * GET /api/reports/pnl
 * Generate Profit & Loss statement
 * Query: start_date, end_date, compare_period (optional: 'previous_period', 'previous_year')
 */
router.get('/pnl', async (req, res) => {
  try {
    const { start_date, end_date, compare_period } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get revenue from sales
    const revenueData = await db.promisify.all(`
      SELECT 
        COALESCE(SUM(sl.quantity_sold * mi.selling_price), 0) as total_revenue,
        COUNT(DISTINCT sl.date) as days_with_sales
      FROM sales_log sl
      JOIN menu_items mi ON sl.menu_item_id = mi.id
      WHERE sl.date BETWEEN $1 AND $2
    `, [start_date, end_date]);

    // Get daily revenue totals if available
    const dailyRevenue = await db.promisify.get(`
      SELECT 
        COALESCE(SUM(total_net_sales), 0) as recorded_net_sales,
        COALESCE(SUM(food_sales), 0) as food_sales,
        COALESCE(SUM(beverage_sales), 0) as beverage_sales,
        COALESCE(SUM(alcohol_sales), 0) as alcohol_sales,
        COALESCE(SUM(catering_sales), 0) as catering_sales,
        COALESCE(SUM(other_sales), 0) as other_sales,
        COALESCE(SUM(discounts), 0) as total_discounts,
        COALESCE(SUM(tips_collected), 0) as tips_collected
      FROM daily_revenue
      WHERE date BETWEEN $1 AND $2
    `, [start_date, end_date]);

    // Get COGS from recipe calculations
    const cogsData = await db.promisify.get(`
      SELECT COALESCE(SUM(
        sl.quantity_sold * (
          SELECT COALESCE(SUM(
            rm.quantity_used * (i.purchase_price / (i.unit_conversion_factor * i.yield_percent))
          ), 0)
          FROM recipe_map rm
          JOIN ingredients i ON rm.ingredient_id = i.id
          WHERE rm.menu_item_id = sl.menu_item_id
        )
      ), 0) as calculated_cogs
      FROM sales_log sl
      WHERE sl.date BETWEEN $1 AND $2
    `, [start_date, end_date]);

    // Get expenses by type
    const expensesByType = await db.promisify.all(`
      SELECT 
        ec.expense_type,
        ec.tax_category,
        SUM(e.amount) as total_amount,
        COUNT(*) as expense_count
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.expense_date BETWEEN $1 AND $2
      GROUP BY ec.expense_type, ec.tax_category
      ORDER BY total_amount DESC
    `, [start_date, end_date]);

    // Get payroll costs
    const payrollData = await db.promisify.get(`
      SELECT 
        COALESCE(SUM(gross_pay), 0) as total_gross_pay,
        COALESCE(SUM(total_employer_cost), 0) as total_employer_cost,
        COALESCE(SUM(employer_social_security + employer_medicare + employer_futa + employer_suta), 0) as payroll_taxes
      FROM payroll_records
      WHERE pay_period_start >= $1 AND pay_period_end <= $2
    `, [start_date, end_date]);

    // Calculate totals
    const revenue = parseFloat(dailyRevenue?.recorded_net_sales) || parseFloat(revenueData[0]?.total_revenue) || 0;
    const cogs = parseFloat(cogsData?.calculated_cogs) || 0;
    const grossProfit = revenue - cogs;

    // Organize expenses
    const operatingExpenses = expensesByType.filter(e => e.expense_type === 'operating');
    const marketingExpenses = expensesByType.filter(e => e.expense_type === 'marketing');
    const payrollExpenses = expensesByType.filter(e => e.expense_type === 'payroll');
    const otherExpenses = expensesByType.filter(e => e.expense_type === 'other');

    const totalOperating = operatingExpenses.reduce((sum, e) => sum + parseFloat(e.total_amount), 0);
    const totalMarketing = marketingExpenses.reduce((sum, e) => sum + parseFloat(e.total_amount), 0);
    const totalPayroll = parseFloat(payrollData?.total_employer_cost) || 
                         payrollExpenses.reduce((sum, e) => sum + parseFloat(e.total_amount), 0);
    const totalOther = otherExpenses.reduce((sum, e) => sum + parseFloat(e.total_amount), 0);

    const totalExpenses = cogs + totalOperating + totalMarketing + totalPayroll + totalOther;
    const netIncome = revenue - totalExpenses;

    // Build P&L structure
    const pnl = {
      period: { start_date, end_date },
      revenue: {
        food_sales: parseFloat(dailyRevenue?.food_sales) || revenue,
        beverage_sales: parseFloat(dailyRevenue?.beverage_sales) || 0,
        alcohol_sales: parseFloat(dailyRevenue?.alcohol_sales) || 0,
        catering_sales: parseFloat(dailyRevenue?.catering_sales) || 0,
        other_sales: parseFloat(dailyRevenue?.other_sales) || 0,
        gross_revenue: revenue + parseFloat(dailyRevenue?.total_discounts || 0),
        discounts: parseFloat(dailyRevenue?.total_discounts) || 0,
        net_revenue: revenue
      },
      cost_of_goods_sold: {
        food_cost: cogs,
        beverage_cost: 0,
        packaging: 0,
        total_cogs: cogs
      },
      gross_profit: grossProfit,
      gross_profit_margin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0,
      operating_expenses: {
        items: operatingExpenses,
        total: totalOperating
      },
      marketing_expenses: {
        items: marketingExpenses,
        total: totalMarketing
      },
      payroll: {
        gross_wages: parseFloat(payrollData?.total_gross_pay) || 0,
        payroll_taxes: parseFloat(payrollData?.payroll_taxes) || 0,
        total: totalPayroll
      },
      other_expenses: {
        items: otherExpenses,
        total: totalOther
      },
      total_expenses: totalExpenses,
      net_income: netIncome,
      net_income_margin: revenue > 0 ? ((netIncome / revenue) * 100).toFixed(1) : 0,
      
      // Key ratios
      ratios: {
        food_cost_percent: revenue > 0 ? ((cogs / revenue) * 100).toFixed(1) : 0,
        labor_cost_percent: revenue > 0 ? ((totalPayroll / revenue) * 100).toFixed(1) : 0,
        prime_cost_percent: revenue > 0 ? (((cogs + totalPayroll) / revenue) * 100).toFixed(1) : 0,
        operating_expense_percent: revenue > 0 ? ((totalOperating / revenue) * 100).toFixed(1) : 0
      }
    };

    // Compare to previous period if requested
    if (compare_period) {
      const startMs = new Date(start_date).getTime();
      const endMs = new Date(end_date).getTime();
      const periodLength = endMs - startMs;

      let compareStart, compareEnd;
      if (compare_period === 'previous_year') {
        compareStart = new Date(startMs - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        compareEnd = new Date(endMs - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else {
        compareStart = new Date(startMs - periodLength - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        compareEnd = new Date(startMs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      // Get comparison revenue
      const compareRevenue = await db.promisify.get(`
        SELECT COALESCE(SUM(total_net_sales), 0) as revenue
        FROM daily_revenue WHERE date BETWEEN $1 AND $2
      `, [compareStart, compareEnd]);

      pnl.comparison = {
        period: { start_date: compareStart, end_date: compareEnd },
        revenue: parseFloat(compareRevenue?.revenue) || 0,
        revenue_change: revenue - (parseFloat(compareRevenue?.revenue) || 0),
        revenue_change_percent: compareRevenue?.revenue > 0 
          ? (((revenue - compareRevenue.revenue) / compareRevenue.revenue) * 100).toFixed(1) 
          : null
      };
    }

    res.json(pnl);
  } catch (error) {
    console.error('P&L error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TAX EXPENSE REPORT
// ============================================

/**
 * GET /api/reports/tax-expenses
 * Get expenses organized by tax category
 */
router.get('/tax-expenses', async (req, res) => {
  try {
    const { tax_year, start_date, end_date } = req.query;

    let dateFilter;
    let params;

    if (tax_year) {
      dateFilter = `EXTRACT(YEAR FROM e.expense_date) = $1`;
      params = [tax_year];
    } else if (start_date && end_date) {
      dateFilter = `e.expense_date BETWEEN $1 AND $2`;
      params = [start_date, end_date];
    } else {
      dateFilter = `EXTRACT(YEAR FROM e.expense_date) = EXTRACT(YEAR FROM CURRENT_DATE)`;
      params = [];
    }

    const expenses = await db.promisify.all(`
      SELECT 
        ec.tax_category,
        ec.name as category_name,
        ec.is_tax_deductible,
        SUM(e.amount) as total_amount,
        COUNT(*) as transaction_count,
        MIN(e.expense_date) as first_expense,
        MAX(e.expense_date) as last_expense
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE ${dateFilter} AND ec.is_tax_deductible = true
      GROUP BY ec.tax_category, ec.name, ec.is_tax_deductible
      ORDER BY ec.tax_category, total_amount DESC
    `, params);

    // Group by tax category (Schedule C lines)
    const grouped = {};
    for (const exp of expenses) {
      const cat = exp.tax_category || 'other_expenses';
      if (!grouped[cat]) {
        grouped[cat] = { items: [], total: 0 };
      }
      grouped[cat].items.push(exp);
      grouped[cat].total += parseFloat(exp.total_amount);
    }

    const grandTotal = Object.values(grouped).reduce((sum, g) => sum + g.total, 0);

    res.json({
      period: tax_year ? { year: tax_year } : { start_date, end_date },
      by_category: grouped,
      grand_total: grandTotal
    });
  } catch (error) {
    console.error('Tax expense report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CASH FLOW REPORT
// ============================================

/**
 * GET /api/reports/cash-flow
 * Cash flow summary by week/month
 */
router.get('/cash-flow', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Cash inflows (revenue)
    const inflows = await db.promisify.all(`
      SELECT 
        DATE_TRUNC('week', date)::date as week_start,
        SUM(cash_payments) as cash_in,
        SUM(card_payments) as card_in,
        SUM(total_net_sales) as total_in
      FROM daily_revenue
      WHERE date BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('week', date)
      ORDER BY week_start
    `, [start_date, end_date]);

    // Cash outflows (expenses + payroll)
    const outflows = await db.promisify.all(`
      SELECT 
        DATE_TRUNC('week', expense_date)::date as week_start,
        SUM(amount) as expenses_out
      FROM expenses
      WHERE expense_date BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('week', expense_date)
    `, [start_date, end_date]);

    const payrollOutflows = await db.promisify.all(`
      SELECT 
        DATE_TRUNC('week', payment_date)::date as week_start,
        SUM(net_pay) as payroll_out
      FROM payroll_records
      WHERE payment_date BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('week', payment_date)
    `, [start_date, end_date]);

    // Merge data by week
    const weeks = new Map();
    for (const row of inflows) {
      weeks.set(row.week_start, {
        week_start: row.week_start,
        cash_in: parseFloat(row.total_in) || 0,
        expenses_out: 0,
        payroll_out: 0
      });
    }
    for (const row of outflows) {
      const w = weeks.get(row.week_start) || { week_start: row.week_start, cash_in: 0, expenses_out: 0, payroll_out: 0 };
      w.expenses_out = parseFloat(row.expenses_out) || 0;
      weeks.set(row.week_start, w);
    }
    for (const row of payrollOutflows) {
      const w = weeks.get(row.week_start) || { week_start: row.week_start, cash_in: 0, expenses_out: 0, payroll_out: 0 };
      w.payroll_out = parseFloat(row.payroll_out) || 0;
      weeks.set(row.week_start, w);
    }

    const cashFlow = Array.from(weeks.values())
      .sort((a, b) => new Date(a.week_start) - new Date(b.week_start))
      .map(w => ({
        ...w,
        total_out: w.expenses_out + w.payroll_out,
        net_cash_flow: w.cash_in - w.expenses_out - w.payroll_out
      }));

    // Running balance
    let runningBalance = 0;
    for (const week of cashFlow) {
      runningBalance += week.net_cash_flow;
      week.running_balance = runningBalance;
    }

    res.json({
      period: { start_date, end_date },
      weekly: cashFlow,
      totals: {
        total_in: cashFlow.reduce((s, w) => s + w.cash_in, 0),
        total_out: cashFlow.reduce((s, w) => s + w.total_out, 0),
        net_change: runningBalance
      }
    });
  } catch (error) {
    console.error('Cash flow error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// VENDOR ANALYSIS
// ============================================

/**
 * GET /api/reports/vendor-analysis
 * Spending analysis by vendor
 */
router.get('/vendor-analysis', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    let params = [];

    if (start_date && end_date) {
      dateFilter = 'WHERE e.expense_date BETWEEN $1 AND $2';
      params = [start_date, end_date];
    }

    const vendors = await db.promisify.all(`
      SELECT 
        v.id,
        v.name,
        COUNT(e.id) as transaction_count,
        SUM(e.amount) as total_spent,
        AVG(e.amount) as avg_transaction,
        MIN(e.expense_date) as first_purchase,
        MAX(e.expense_date) as last_purchase,
        STRING_AGG(DISTINCT ec.expense_type, ', ') as expense_types
      FROM vendors v
      LEFT JOIN expenses e ON v.id = e.vendor_id ${dateFilter ? 'AND e.expense_date BETWEEN $1 AND $2' : ''}
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      GROUP BY v.id, v.name
      HAVING SUM(e.amount) > 0
      ORDER BY total_spent DESC
    `, params);

    const totalSpend = vendors.reduce((sum, v) => sum + parseFloat(v.total_spent || 0), 0);

    res.json({
      period: start_date && end_date ? { start_date, end_date } : { all_time: true },
      vendors: vendors.map(v => ({
        ...v,
        total_spent: parseFloat(v.total_spent) || 0,
        avg_transaction: parseFloat(v.avg_transaction) || 0,
        percent_of_total: totalSpend > 0 ? ((parseFloat(v.total_spent) / totalSpend) * 100).toFixed(1) : 0
      })),
      total_spend: totalSpend
    });
  } catch (error) {
    console.error('Vendor analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BUDGET VS ACTUAL
// ============================================

/**
 * GET /api/reports/budget-vs-actual
 * Compare actual expenses to category budgets
 */
router.get('/budget-vs-actual', async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const comparison = await db.promisify.all(`
      SELECT 
        ec.id,
        ec.name,
        ec.expense_type,
        ec.budget_monthly,
        COALESCE(SUM(e.amount), 0) as actual_spent
      FROM expense_categories ec
      LEFT JOIN expenses e ON ec.id = e.category_id 
        AND EXTRACT(MONTH FROM e.expense_date) = $1
        AND EXTRACT(YEAR FROM e.expense_date) = $2
      WHERE ec.is_active = true
      GROUP BY ec.id, ec.name, ec.expense_type, ec.budget_monthly
      ORDER BY ec.expense_type, ec.name
    `, [targetMonth, targetYear]);

    res.json({
      period: { month: targetMonth, year: targetYear },
      categories: comparison.map(c => ({
        ...c,
        budget_monthly: parseFloat(c.budget_monthly) || 0,
        actual_spent: parseFloat(c.actual_spent),
        variance: (parseFloat(c.budget_monthly) || 0) - parseFloat(c.actual_spent),
        variance_percent: c.budget_monthly > 0 
          ? ((parseFloat(c.actual_spent) / parseFloat(c.budget_monthly)) * 100).toFixed(1)
          : null,
        over_budget: parseFloat(c.actual_spent) > (parseFloat(c.budget_monthly) || 0)
      })),
      totals: {
        total_budget: comparison.reduce((s, c) => s + (parseFloat(c.budget_monthly) || 0), 0),
        total_actual: comparison.reduce((s, c) => s + parseFloat(c.actual_spent), 0)
      }
    });
  } catch (error) {
    console.error('Budget vs actual error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DAILY SUMMARY
// ============================================

/**
 * GET /api/reports/daily-summary
 * Day-by-day revenue and expense summary
 */
router.get('/daily-summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Default to last 30 days
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get daily revenue
    const revenue = await db.promisify.all(`
      SELECT 
        date,
        total_net_sales as revenue,
        food_sales,
        transaction_count,
        customer_count
      FROM daily_revenue
      WHERE date BETWEEN $1 AND $2
      ORDER BY date
    `, [startDate, endDate]);

    // Get daily expenses
    const expenses = await db.promisify.all(`
      SELECT 
        expense_date as date,
        SUM(amount) as expenses
      FROM expenses
      WHERE expense_date BETWEEN $1 AND $2
      GROUP BY expense_date
      ORDER BY expense_date
    `, [startDate, endDate]);

    // Merge
    const expenseMap = new Map(expenses.map(e => [e.date, parseFloat(e.expenses)]));
    
    const daily = revenue.map(r => ({
      date: r.date,
      revenue: parseFloat(r.revenue) || 0,
      food_sales: parseFloat(r.food_sales) || 0,
      expenses: expenseMap.get(r.date) || 0,
      net: (parseFloat(r.revenue) || 0) - (expenseMap.get(r.date) || 0),
      transaction_count: r.transaction_count || 0,
      customer_count: r.customer_count || 0
    }));

    res.json({
      period: { start_date: startDate, end_date: endDate },
      daily,
      totals: {
        revenue: daily.reduce((s, d) => s + d.revenue, 0),
        expenses: daily.reduce((s, d) => s + d.expenses, 0),
        net: daily.reduce((s, d) => s + d.net, 0),
        avg_daily_revenue: daily.length > 0 ? daily.reduce((s, d) => s + d.revenue, 0) / daily.length : 0
      }
    });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
