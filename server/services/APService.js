/**
 * APService
 * Handles AP automation: invoice processing, auto-mapping, approval, GL posting, payment batching
 */
const { ValidationError, NotFoundError } = require('../utils/errors');
const { serviceLogger } = require('../utils/logger');
const PostingService = require('./PostingService');

class APService {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
    this.postingService = new PostingService(pool);
    this.logger = serviceLogger.child({ service: 'ap' });
  }

  // ============================================
  // AUTO-MAPPING
  // ============================================

  /**
   * Apply vendor mappings to invoice line items
   */
  async applyMappingsToInvoice(invoiceId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const invoice = await client.query('SELECT * FROM ap_invoices WHERE id = $1', [invoiceId]);
      if (invoice.rows.length === 0) {
        throw new NotFoundError('AP Invoice');
      }
      const vendorId = invoice.rows[0].vendor_id;

      // Get all mappings for this vendor
      const mappings = await client.query(
        `SELECT * FROM vendor_item_mappings WHERE vendor_id = $1 AND active = true`,
        [vendorId]
      );

      // Get invoice lines
      const lines = await client.query(
        'SELECT * FROM ap_invoice_lines WHERE ap_invoice_id = $1',
        [invoiceId]
      );

      let mappedCount = 0;
      let totalLines = lines.rows.length;

      for (const line of lines.rows) {
        const matchedMapping = this.findBestMapping(line, mappings.rows);
        if (matchedMapping) {
          await client.query(
            `UPDATE ap_invoice_lines SET
               mapped_ingredient_id = $1,
               mapped_category_id = $2,
               mapping_confidence = $3,
               mapping_source = 'auto'
             WHERE id = $4`,
            [
              matchedMapping.ingredient_id,
              matchedMapping.category_id,
              matchedMapping.confidence,
              line.id,
            ]
          );
          mappedCount++;
        }
      }

      // Update invoice mapping status
      const mappingStatus = mappedCount === totalLines ? 'complete' :
                           mappedCount > 0 ? 'partial' : 'pending';

      await client.query(
        `UPDATE ap_invoices SET mapping_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [mappingStatus, invoiceId]
      );

      await client.query('COMMIT');

      this.logger.info(
        { invoiceId, mappedCount, totalLines, mappingStatus },
        'Invoice lines mapped'
      );

      return { mapped: mappedCount, total: totalLines, status: mappingStatus };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Find best mapping match for a line item
   */
  findBestMapping(line, mappings) {
    const rawCode = (line.raw_vendor_code || '').toLowerCase().trim();
    const rawDesc = (line.raw_description || '').toLowerCase().trim();

    for (const mapping of mappings) {
      const value = mapping.match_value.toLowerCase().trim();
      let matched = false;
      let confidence = 0;

      switch (mapping.match_type) {
        case 'exact_code':
          matched = rawCode === value;
          confidence = 1.0;
          break;
        case 'exact_desc':
          matched = rawDesc === value;
          confidence = 0.95;
          break;
        case 'contains':
          matched = rawDesc.includes(value) || rawCode.includes(value);
          confidence = 0.8;
          break;
        case 'regex':
          try {
            const regex = new RegExp(value, 'i');
            matched = regex.test(rawDesc) || regex.test(rawCode);
            confidence = 0.75;
          } catch (e) {
            // Invalid regex, skip
          }
          break;
      }

      if (matched) {
        return { ...mapping, confidence };
      }
    }

    return null;
  }

  // ============================================
  // APPROVAL & POSTING
  // ============================================

  /**
   * Approve an AP invoice
   */
  async approveInvoice(invoiceId, approvedBy, notes = null) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        'SELECT * FROM ap_invoices WHERE id = $1 FOR UPDATE',
        [invoiceId]
      );
      if (result.rows.length === 0) {
        throw new NotFoundError('AP Invoice');
      }
      const invoice = result.rows[0];

      if (invoice.approval_status === 'approved') {
        throw new ValidationError('Invoice is already approved');
      }

      await client.query(
        `UPDATE ap_invoices SET
           approval_status = 'approved',
           approved_by = $1,
           approved_at = CURRENT_TIMESTAMP,
           notes = COALESCE($2, notes),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [approvedBy, notes, invoiceId]
      );

      await client.query('COMMIT');

      this.logger.info({ invoiceId, approvedBy }, 'Invoice approved');

      return this.getInvoice(invoiceId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Post an approved invoice to GL and create AP record
   */
  async postInvoice(invoiceId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        'SELECT ai.*, v.name as vendor_name FROM ap_invoices ai JOIN vendors v ON ai.vendor_id = v.id WHERE ai.id = $1 FOR UPDATE',
        [invoiceId]
      );
      if (result.rows.length === 0) {
        throw new NotFoundError('AP Invoice');
      }
      const invoice = result.rows[0];

      if (invoice.approval_status !== 'approved') {
        throw new ValidationError('Invoice must be approved before posting');
      }
      if (invoice.posting_status === 'posted') {
        throw new ValidationError('Invoice is already posted');
      }

      // Get invoice lines with mappings
      const lines = await client.query(
        `SELECT ail.*, ec.account_id as category_account_id
         FROM ap_invoice_lines ail
         LEFT JOIN expense_categories ec ON ail.mapped_category_id = ec.id
         WHERE ail.ap_invoice_id = $1`,
        [invoiceId]
      );

      // Build journal entry
      // DR various expense/inventory accounts based on line mappings
      // CR Accounts Payable (account 2000)
      const journalLines = [];
      const apAccountId = await this.getAccountIdByNumber('2000', client);
      
      // Group lines by account for cleaner JE
      const accountTotals = new Map();
      for (const line of lines.rows) {
        const accountId = line.mapped_account_id || line.category_account_id || await this.getDefaultExpenseAccountId(client);
        const current = accountTotals.get(accountId) || 0;
        accountTotals.set(accountId, current + parseFloat(line.line_total || 0));
      }

      // Add debit lines
      for (const [accountId, amount] of accountTotals) {
        if (amount > 0) {
          journalLines.push({
            account_id: accountId,
            debit: amount,
            credit: 0,
            description: `Invoice ${invoice.invoice_number || invoiceId}`,
          });
        }
      }

      // Add credit to AP
      journalLines.push({
        account_id: apAccountId,
        debit: 0,
        credit: parseFloat(invoice.total),
        description: `${invoice.vendor_name} - ${invoice.invoice_number || 'Invoice'}`,
      });

      // Create journal entry
      const entryDate = invoice.invoice_date || new Date().toISOString().split('T')[0];
      const jeResult = await client.query(
        `INSERT INTO journal_entries (entry_date, description, reference_type, reference_id)
         VALUES ($1, $2, 'ap_invoice', $3)
         RETURNING *`,
        [entryDate, `AP Invoice: ${invoice.vendor_name} - ${invoice.invoice_number || invoiceId}`, invoiceId]
      );
      const journalEntry = jeResult.rows[0];

      for (const jl of journalLines) {
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [journalEntry.id, jl.account_id, jl.debit, jl.credit, jl.description]
        );
      }

      // Create AP record
      const apResult = await client.query(
        `INSERT INTO accounts_payable (
           vendor_id, invoice_number, invoice_date, due_date, amount, terms, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          invoice.vendor_id,
          invoice.invoice_number,
          invoice.invoice_date,
          invoice.due_date,
          invoice.total,
          invoice.terms,
          `From AP Invoice #${invoiceId}`,
        ]
      );

      // Update invoice status
      await client.query(
        `UPDATE ap_invoices SET
           posting_status = 'posted',
           posted_at = CURRENT_TIMESTAMP,
           journal_entry_id = $1,
           accounts_payable_id = $2,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [journalEntry.id, apResult.rows[0].id, invoiceId]
      );

      await client.query('COMMIT');

      this.logger.info(
        { invoiceId, journalEntryId: journalEntry.id, apId: apResult.rows[0].id },
        'Invoice posted to GL'
      );

      return {
        invoice_id: invoiceId,
        journal_entry_id: journalEntry.id,
        accounts_payable_id: apResult.rows[0].id,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getAccountIdByNumber(accountNumber, client = this.pool) {
    const result = await client.query(
      'SELECT id FROM accounts WHERE account_number = $1',
      [accountNumber]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError(`Account ${accountNumber}`);
    }
    return result.rows[0].id;
  }

  async getDefaultExpenseAccountId(client = this.pool) {
    // Default to Miscellaneous expense (9200)
    return this.getAccountIdByNumber('9200', client);
  }

  async getInvoice(invoiceId) {
    const result = await this.pool.query(
      `SELECT ai.*, v.name as vendor_name
       FROM ap_invoices ai
       LEFT JOIN vendors v ON ai.vendor_id = v.id
       WHERE ai.id = $1`,
      [invoiceId]
    );
    return result.rows[0];
  }

  // ============================================
  // PAYMENT BATCHING
  // ============================================

  /**
   * Create a payment batch from selected payables
   */
  async createPaymentBatch(input) {
    const {
      batch_date = new Date().toISOString().split('T')[0],
      bank_account_id = null,
      payment_method = null,
      notes = null,
      items,
    } = input;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Calculate total
      const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);

      // Generate batch number
      const countResult = await client.query(
        "SELECT COUNT(*) as c FROM payment_batches WHERE batch_date = $1",
        [batch_date]
      );
      const batchNumber = `PAY-${batch_date.replace(/-/g, '')}-${parseInt(countResult.rows[0].c) + 1}`;

      const batchResult = await client.query(
        `INSERT INTO payment_batches (batch_date, batch_number, bank_account_id, payment_method, total_amount, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [batch_date, batchNumber, bank_account_id, payment_method, totalAmount, notes]
      );
      const batch = batchResult.rows[0];

      const batchItems = [];
      for (const item of items) {
        // Verify payable exists and has balance
        const apResult = await client.query(
          'SELECT * FROM accounts_payable WHERE id = $1',
          [item.accounts_payable_id]
        );
        if (apResult.rows.length === 0) {
          throw new NotFoundError(`Payable ${item.accounts_payable_id}`);
        }
        const ap = apResult.rows[0];
        const balance = parseFloat(ap.amount) - parseFloat(ap.amount_paid);
        if (item.amount > balance) {
          throw new ValidationError(`Payment amount exceeds balance for payable ${item.accounts_payable_id}`);
        }

        const itemResult = await client.query(
          `INSERT INTO payment_batch_items (batch_id, accounts_payable_id, amount, notes)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [batch.id, item.accounts_payable_id, item.amount, item.notes]
        );
        batchItems.push(itemResult.rows[0]);
      }

      await client.query('COMMIT');

      this.logger.info(
        { batchId: batch.id, batchNumber, itemCount: items.length, totalAmount },
        'Payment batch created'
      );

      return { ...batch, items: batchItems };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Process a payment batch - mark as paid and post GL entries
   */
  async processBatch(batchId, checkStartNumber = null) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const batchResult = await client.query(
        'SELECT * FROM payment_batches WHERE id = $1 FOR UPDATE',
        [batchId]
      );
      if (batchResult.rows.length === 0) {
        throw new NotFoundError('Payment batch');
      }
      const batch = batchResult.rows[0];

      if (batch.status !== 'approved') {
        throw new ValidationError('Batch must be approved before processing');
      }

      // Get batch items with AP details
      const itemsResult = await client.query(
        `SELECT pbi.*, ap.vendor_id, ap.invoice_number, v.name as vendor_name
         FROM payment_batch_items pbi
         JOIN accounts_payable ap ON pbi.accounts_payable_id = ap.id
         JOIN vendors v ON ap.vendor_id = v.id
         WHERE pbi.batch_id = $1`,
        [batchId]
      );

      const cashAccountId = await this.getAccountIdByNumber('1000', client); // Checking Account
      const apAccountId = await this.getAccountIdByNumber('2000', client);   // Accounts Payable

      let checkNumber = checkStartNumber;
      const processedItems = [];

      for (const item of itemsResult.rows) {
        // Update AP record
        const ap = await client.query(
          'SELECT * FROM accounts_payable WHERE id = $1 FOR UPDATE',
          [item.accounts_payable_id]
        );
        const newAmountPaid = parseFloat(ap.rows[0].amount_paid) + parseFloat(item.amount);
        const newStatus = newAmountPaid >= parseFloat(ap.rows[0].amount) ? 'paid' : 'partial';

        await client.query(
          `UPDATE accounts_payable SET amount_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [newAmountPaid, newStatus, item.accounts_payable_id]
        );

        // Update batch item
        const itemCheckNumber = batch.payment_method === 'check' && checkNumber ? checkNumber++ : null;
        await client.query(
          `UPDATE payment_batch_items SET
             status = 'paid',
             check_number = $1,
             paid_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [itemCheckNumber, item.id]
        );

        // Create journal entry for this payment
        // DR Accounts Payable
        // CR Cash/Bank
        const jeResult = await client.query(
          `INSERT INTO journal_entries (entry_date, description, reference_type, reference_id)
           VALUES ($1, $2, 'payment', $3)
           RETURNING *`,
          [batch.batch_date, `Payment to ${item.vendor_name}`, item.id]
        );

        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
           VALUES ($1, $2, $3, 0, $4), ($1, $5, 0, $3, $4)`,
          [
            jeResult.rows[0].id,
            apAccountId,
            item.amount,
            `${item.vendor_name} - ${item.invoice_number || 'Payment'}`,
            cashAccountId,
          ]
        );

        processedItems.push({ ...item, check_number: itemCheckNumber, journal_entry_id: jeResult.rows[0].id });
      }

      // Update batch status
      await client.query(
        `UPDATE payment_batches SET
           status = 'completed',
           processed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [batchId]
      );

      await client.query('COMMIT');

      this.logger.info(
        { batchId, itemsProcessed: processedItems.length },
        'Payment batch processed'
      );

      return { batch_id: batchId, items_processed: processedItems.length, items: processedItems };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = APService;

