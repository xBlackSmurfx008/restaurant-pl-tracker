/**
 * PostingService
 * Centralizes creation of balanced journal entries and fiscal period rules.
 */
const { ValidationError, NotFoundError } = require('../utils/errors');
const { serviceLogger } = require('../utils/logger');

class PostingService {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
    this.logger = serviceLogger.child({ service: 'posting' });
  }

  /**
   * Find fiscal period for a given entry_date.
   * @param {string} entryDate - YYYY-MM-DD
   * @returns {Promise<object|null>}
   */
  async findFiscalPeriodForDate(entryDate) {
    const result = await this.pool.query(
      `
      SELECT *
      FROM fiscal_periods
      WHERE start_date <= $1 AND end_date >= $1
      ORDER BY start_date DESC
      LIMIT 1
      `,
      [entryDate]
    );
    return result.rows[0] || null;
  }

  /**
   * Resolve account id by account number (e.g., '1200').
   * @param {string} accountNumber
   */
  async getAccountIdByNumber(accountNumber) {
    const result = await this.pool.query('SELECT id FROM accounts WHERE account_number = $1', [accountNumber]);
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError(`Account ${accountNumber}`);
    }
    return row.id;
  }

  /**
   * Create a balanced journal entry.
   *
   * @param {object} input
   * @param {string} input.entry_date - YYYY-MM-DD
   * @param {string} input.description
   * @param {string|null} [input.reference_type]
   * @param {number|null} [input.reference_id]
   * @param {boolean} [input.is_adjusting]
   * @param {boolean} [input.is_closing]
   * @param {number|null} [input.fiscal_period_id]
   * @param {string|null} [input.created_by]
   * @param {Array<{account_id:number,debit:number,credit:number,description?:string|null}>} input.lines
   */
  async createJournalEntry(input) {
    const {
      entry_date,
      description,
      reference_type = null,
      reference_id = null,
      is_adjusting = false,
      is_closing = false,
      fiscal_period_id = null,
      created_by = null,
      lines,
    } = input;

    if (!Array.isArray(lines) || lines.length < 2) {
      throw new ValidationError('Journal entry must have at least 2 lines');
    }

    const sum = lines.reduce(
      (acc, l) => {
        const d = parseFloat(l.debit || 0);
        const c = parseFloat(l.credit || 0);
        if (d < 0 || c < 0) {
          throw new ValidationError('Debit/credit cannot be negative');
        }
        if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
          throw new ValidationError('Each line must have either debit or credit (but not both)');
        }
        acc.debit += d;
        acc.credit += c;
        return acc;
      },
      { debit: 0, credit: 0 }
    );

    // Use cents tolerance for float issues
    const diff = Math.round((sum.debit - sum.credit) * 100) / 100;
    if (diff !== 0) {
      throw new ValidationError(`Journal entry is not balanced (diff=${diff})`);
    }

    const inferredPeriod = await this.findFiscalPeriodForDate(entry_date);
    if (inferredPeriod?.is_closed) {
      // Admin override will be added in auth/roles phase
      throw new ValidationError('Fiscal period is closed; cannot post entries to this date');
    }

    const periodIdToUse = fiscal_period_id || inferredPeriod?.id || null;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const entryResult = await client.query(
        `
        INSERT INTO journal_entries (
          entry_date, description, reference_type, reference_id,
          is_adjusting, is_closing, fiscal_period_id, created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [entry_date, description, reference_type, reference_id, is_adjusting, is_closing, periodIdToUse, created_by]
      );

      const entry = entryResult.rows[0];

      const insertedLines = [];
      for (const l of lines) {
        const lineResult = await client.query(
          `
          INSERT INTO journal_entry_lines (
            journal_entry_id, account_id, debit, credit, description
          )
          VALUES ($1,$2,$3,$4,$5)
          RETURNING *
          `,
          [entry.id, l.account_id, l.debit || 0, l.credit || 0, l.description || null]
        );
        insertedLines.push(lineResult.rows[0]);
      }

      await client.query('COMMIT');

      this.logger.info(
        { journalEntryId: entry.id, entry_date, reference_type, reference_id },
        'Journal entry posted'
      );

      return { ...entry, lines: insertedLines };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = PostingService;


