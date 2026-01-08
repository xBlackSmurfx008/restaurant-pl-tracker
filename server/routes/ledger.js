/**
 * Ledger Routes
 * Journal entry creation + GL reporting + fiscal periods management.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const PostingService = require('../services/PostingService');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const { validateQuery, validateId, validateBody } = require('../middleware');
const {
  createJournalEntrySchema,
  ledgerQuerySchema,
  trialBalanceQuerySchema,
  incomeStatementQuerySchema,
  balanceSheetQuerySchema,
  createFiscalPeriodSchema,
} = require('../schemas/journal.schema');

// Instantiate posting service
const postingService = new PostingService(db.pool);

// ============================================
// JOURNAL ENTRIES (create / list / get)
// ============================================

/**
 * POST /journal-entries - create a balanced journal entry
 */
router.post(
  '/journal-entries',
  validateBody(createJournalEntrySchema),
  asyncHandler(async (req, res) => {
    const entry = await postingService.createJournalEntry(req.body);
    res.status(201).json(entry);
  })
);

/**
 * GET /journal-entries - list journal entries
 */
router.get(
  '/journal-entries',
  validateQuery(ledgerQuerySchema),
  asyncHandler(async (req, res) => {
    const { start_date, end_date, limit, offset } = req.query;
    const params = [];
    let p = 1;
    let where = '1=1';

    if (start_date) {
      where += ` AND je.entry_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      where += ` AND je.entry_date <= $${p++}`;
      params.push(end_date);
    }

    params.push(limit, offset);

    const entries = await db.promisify.all(
      `
      SELECT
        je.*,
        (SELECT json_agg(row_to_json(jel.*)) FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) as lines
      FROM journal_entries je
      WHERE ${where}
      ORDER BY je.entry_date DESC, je.id DESC
      LIMIT $${p++} OFFSET $${p++}
      `,
      params
    );

    const countResult = await db.promisify.get(
      `SELECT COUNT(*) as total FROM journal_entries je WHERE ${where}`,
      params.slice(0, -2)
    );

    res.json({
      entries,
      pagination: {
        limit,
        offset,
        total: parseInt(countResult.total, 10),
      },
    });
  })
);

/**
 * GET /journal-entries/:id - get single journal entry with lines
 */
router.get(
  '/journal-entries/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const entry = await db.promisify.get(
      `
      SELECT
        je.*,
        (SELECT json_agg(
          json_build_object(
            'id', jel.id,
            'account_id', jel.account_id,
            'account_number', a.account_number,
            'account_name', a.name,
            'debit', jel.debit,
            'credit', jel.credit,
            'description', jel.description
          )
        ) FROM journal_entry_lines jel
        JOIN accounts a ON a.id = jel.account_id
        WHERE jel.journal_entry_id = je.id) as lines
      FROM journal_entries je
      WHERE je.id = $1
      `,
      [req.params.id]
    );

    if (!entry) {
      throw new NotFoundError('Journal entry');
    }

    res.json(entry);
  })
);

// ============================================
// GENERAL LEDGER (by account)
// ============================================
router.get(
  '/accounts/:id',
  validateId,
  validateQuery(ledgerQuerySchema),
  asyncHandler(async (req, res) => {
    const account = await db.promisify.get('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (!account) {
      throw new NotFoundError('Account');
    }

    const { start_date, end_date, limit, offset } = req.query;
    const params = [req.params.id];
    let p = 2;

    let where = 'jel.account_id = $1';
    if (start_date) {
      where += ` AND je.entry_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      where += ` AND je.entry_date <= $${p++}`;
      params.push(end_date);
    }

    params.push(limit, offset);

    const lines = await db.promisify.all(
      `
      SELECT
        je.id as journal_entry_id,
        je.entry_date,
        je.description as entry_description,
        je.reference_type,
        je.reference_id,
        jel.id as line_id,
        jel.debit,
        jel.credit,
        jel.description as line_description
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.journal_entry_id = je.id
      WHERE ${where}
      ORDER BY je.entry_date DESC, jel.id DESC
      LIMIT $${p++} OFFSET $${p++}
      `,
      params
    );

    // Running balance (within returned window) - informational
    let running = 0;
    const enriched = lines
      .slice()
      .reverse()
      .map((l) => {
        running += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
        return { ...l, running_balance: parseFloat(running.toFixed(2)) };
      })
      .reverse();

    res.json({
      account,
      query: { start_date: start_date || null, end_date: end_date || null, limit, offset },
      lines: enriched,
    });
  })
);

// ============================================
// TRIAL BALANCE
// ============================================
router.get(
  '/trial-balance',
  validateQuery(trialBalanceQuerySchema),
  asyncHandler(async (req, res) => {
    const asOf = req.query.as_of_date || new Date().toISOString().split('T')[0];
    const includeZero = req.query.include_zero;

    const rows = await db.promisify.all(
      `
      SELECT
        a.id as account_id,
        a.account_number,
        a.name,
        a.account_type,
        a.sub_type,
        COALESCE(SUM(jel.debit), 0) as total_debits,
        COALESCE(SUM(jel.credit), 0) as total_credits
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.entry_date <= $1
      GROUP BY a.id, a.account_number, a.name, a.account_type, a.sub_type
      ORDER BY a.account_number
      `,
      [asOf]
    );

    const items = rows
      .map((r) => {
        const debits = parseFloat(r.total_debits) || 0;
        const credits = parseFloat(r.total_credits) || 0;
        const balance = debits - credits;
        return {
          ...r,
          total_debits: debits,
          total_credits: credits,
          balance: parseFloat(balance.toFixed(2)),
        };
      })
      .filter((r) => includeZero || r.balance !== 0);

    const totals = items.reduce(
      (acc, r) => {
        acc.debits += r.total_debits;
        acc.credits += r.total_credits;
        return acc;
      },
      { debits: 0, credits: 0 }
    );

    res.json({
      as_of_date: asOf,
      totals: {
        total_debits: parseFloat(totals.debits.toFixed(2)),
        total_credits: parseFloat(totals.credits.toFixed(2)),
        difference: parseFloat((totals.debits - totals.credits).toFixed(2)),
      },
      accounts: items,
    });
  })
);

// ============================================
// FINANCIALS: INCOME STATEMENT
// ============================================
router.get(
  '/financials/income-statement',
  validateQuery(incomeStatementQuerySchema),
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;

    const rows = await db.promisify.all(
      `
      SELECT
        a.id as account_id,
        a.account_number,
        a.name,
        a.account_type,
        COALESCE(SUM(jel.debit), 0) as debits,
        COALESCE(SUM(jel.credit), 0) as credits
      FROM accounts a
      JOIN journal_entry_lines jel ON jel.account_id = a.id
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_date BETWEEN $1 AND $2
        AND a.account_type IN ('revenue', 'expense')
      GROUP BY a.id, a.account_number, a.name, a.account_type
      ORDER BY a.account_number
      `,
      [start_date, end_date]
    );

    const revenue = [];
    const expenses = [];
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const r of rows) {
      const debits = parseFloat(r.debits) || 0;
      const credits = parseFloat(r.credits) || 0;
      // Revenue accounts normally have credit balances; expenses debit balances.
      const net = r.account_type === 'revenue' ? credits - debits : debits - credits;
      const item = { ...r, net: parseFloat(net.toFixed(2)) };
      if (r.account_type === 'revenue') {
        revenue.push(item);
        totalRevenue += net;
      } else {
        expenses.push(item);
        totalExpenses += net;
      }
    }

    const netIncome = totalRevenue - totalExpenses;

    res.json({
      period: { start_date, end_date },
      revenue,
      expenses,
      totals: {
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        total_expenses: parseFloat(totalExpenses.toFixed(2)),
        net_income: parseFloat(netIncome.toFixed(2)),
      },
    });
  })
);

// ============================================
// FINANCIALS: BALANCE SHEET
// ============================================
router.get(
  '/financials/balance-sheet',
  validateQuery(balanceSheetQuerySchema),
  asyncHandler(async (req, res) => {
    const asOf = req.query.as_of_date;

    const rows = await db.promisify.all(
      `
      SELECT
        a.id as account_id,
        a.account_number,
        a.name,
        a.account_type,
        COALESCE(SUM(jel.debit), 0) as debits,
        COALESCE(SUM(jel.credit), 0) as credits
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.entry_date <= $1
      WHERE a.account_type IN ('asset', 'liability', 'equity')
      GROUP BY a.id, a.account_number, a.name, a.account_type
      ORDER BY a.account_number
      `,
      [asOf]
    );

    const assets = [];
    const liabilities = [];
    const equity = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const r of rows) {
      const debits = parseFloat(r.debits) || 0;
      const credits = parseFloat(r.credits) || 0;
      let balance;
      if (r.account_type === 'asset') {
        balance = debits - credits;
      } else {
        // liabilities/equity normally credit balances
        balance = credits - debits;
      }
      const item = { ...r, balance: parseFloat(balance.toFixed(2)) };
      if (r.account_type === 'asset') {
        assets.push(item);
        totalAssets += balance;
      } else if (r.account_type === 'liability') {
        liabilities.push(item);
        totalLiabilities += balance;
      } else {
        equity.push(item);
        totalEquity += balance;
      }
    }

    res.json({
      as_of_date: asOf,
      assets,
      liabilities,
      equity,
      totals: {
        total_assets: parseFloat(totalAssets.toFixed(2)),
        total_liabilities: parseFloat(totalLiabilities.toFixed(2)),
        total_equity: parseFloat(totalEquity.toFixed(2)),
        liabilities_plus_equity: parseFloat((totalLiabilities + totalEquity).toFixed(2)),
        difference: parseFloat((totalAssets - (totalLiabilities + totalEquity)).toFixed(2)),
      },
    });
  })
);

// ============================================
// FISCAL PERIODS
// ============================================
router.post(
  '/periods',
  validateBody(createFiscalPeriodSchema),
  asyncHandler(async (req, res) => {
    const { period_type, start_date, end_date, period_name, notes } = req.body;
    const name = period_name || `${period_type.toUpperCase()} ${start_date} to ${end_date}`;

    const result = await db.promisify.run(
      `
      INSERT INTO fiscal_periods (period_name, period_type, start_date, end_date, notes)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [name, period_type, start_date, end_date, notes || null]
    );

    const period = await db.promisify.get('SELECT * FROM fiscal_periods WHERE id = $1', [result.id]);
    res.status(201).json(period);
  })
);

router.get(
  '/periods',
  asyncHandler(async (req, res) => {
    const periods = await db.promisify.all(
      `SELECT * FROM fiscal_periods ORDER BY start_date DESC`
    );
    res.json(periods);
  })
);

router.get(
  '/periods/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const period = await db.promisify.get('SELECT * FROM fiscal_periods WHERE id = $1', [req.params.id]);
    if (!period) {
      throw new NotFoundError('Fiscal period');
    }
    res.json(period);
  })
);

router.post(
  '/periods/:id/close',
  validateId,
  asyncHandler(async (req, res) => {
    await db.promisify.run(
      `
      UPDATE fiscal_periods
      SET is_closed = true, closed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [req.params.id]
    );

    const period = await db.promisify.get('SELECT * FROM fiscal_periods WHERE id = $1', [req.params.id]);
    if (!period) {
      throw new NotFoundError('Fiscal period');
    }
    res.json(period);
  })
);

router.post(
  '/periods/:id/reopen',
  validateId,
  asyncHandler(async (req, res) => {
    // Re-opening requires future auth/role check
    await db.promisify.run(
      `
      UPDATE fiscal_periods
      SET is_closed = false, closed_at = NULL
      WHERE id = $1
      `,
      [req.params.id]
    );

    const period = await db.promisify.get('SELECT * FROM fiscal_periods WHERE id = $1', [req.params.id]);
    if (!period) {
      throw new NotFoundError('Fiscal period');
    }
    res.json(period);
  })
);

// Export router and postingService for use by other modules
module.exports = router;
module.exports.postingService = postingService;


