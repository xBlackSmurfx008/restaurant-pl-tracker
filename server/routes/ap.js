/**
 * AP Automation Routes
 * Invoice inbox, approval workflow, GL posting, payment batching
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const APService = require('../services/APService');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  createApInvoiceSchema,
  updateApInvoiceSchema,
  apInvoiceQuerySchema,
  approveInvoiceSchema,
  rejectInvoiceSchema,
  createPaymentBatchSchema,
  updatePaymentBatchSchema,
  paymentBatchQuerySchema,
  approveBatchSchema,
  processBatchSchema,
} = require('../schemas/ap.schema');

// Instantiate service
const apService = new APService(db.pool);

// ============================================
// AP INVOICES (INBOX)
// ============================================

/**
 * GET /invoices - List AP invoices
 */
router.get(
  '/invoices',
  validateQuery(apInvoiceQuerySchema),
  asyncHandler(async (req, res) => {
    const { vendor_id, approval_status, posting_status, start_date, end_date, limit, offset } = req.query;

    let sql = `
      SELECT ai.*, v.name as vendor_name,
        (SELECT COUNT(*) FROM ap_invoice_lines WHERE ap_invoice_id = ai.id) as line_count
      FROM ap_invoices ai
      LEFT JOIN vendors v ON ai.vendor_id = v.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (vendor_id) {
      sql += ` AND ai.vendor_id = $${p++}`;
      params.push(vendor_id);
    }
    if (approval_status) {
      sql += ` AND ai.approval_status = $${p++}`;
      params.push(approval_status);
    }
    if (posting_status) {
      sql += ` AND ai.posting_status = $${p++}`;
      params.push(posting_status);
    }
    if (start_date) {
      sql += ` AND ai.invoice_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND ai.invoice_date <= $${p++}`;
      params.push(end_date);
    }

    sql += ` ORDER BY ai.created_at DESC LIMIT $${p++} OFFSET $${p++}`;
    params.push(limit, offset);

    const invoices = await db.promisify.all(sql, params);

    res.json({ invoices, pagination: { limit, offset } });
  })
);

/**
 * GET /invoices/:id - Get single invoice with lines
 */
router.get(
  '/invoices/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const invoice = await db.promisify.get(
      `SELECT ai.*, v.name as vendor_name, d.original_filename as document_name
       FROM ap_invoices ai
       LEFT JOIN vendors v ON ai.vendor_id = v.id
       LEFT JOIN documents d ON ai.document_id = d.id
       WHERE ai.id = $1`,
      [req.params.id]
    );
    if (!invoice) {
      throw new NotFoundError('AP Invoice');
    }

    const lines = await db.promisify.all(
      `SELECT ail.*, i.name as ingredient_name, ec.name as category_name, a.name as account_name
       FROM ap_invoice_lines ail
       LEFT JOIN ingredients i ON ail.mapped_ingredient_id = i.id
       LEFT JOIN expense_categories ec ON ail.mapped_category_id = ec.id
       LEFT JOIN accounts a ON ail.mapped_account_id = a.id
       WHERE ail.ap_invoice_id = $1
       ORDER BY ail.line_number, ail.id`,
      [req.params.id]
    );

    res.json({ ...invoice, lines });
  })
);

/**
 * POST /invoices - Create AP invoice
 */
router.post(
  '/invoices',
  validateBody(createApInvoiceSchema),
  asyncHandler(async (req, res) => {
    const {
      vendor_id, invoice_number, invoice_date, due_date, terms,
      subtotal, tax, shipping, total, document_id, purchase_order_id, notes, lines
    } = req.body;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const calcTotal = total || (subtotal || 0) + (tax || 0) + (shipping || 0);

      const invoiceResult = await client.query(
        `INSERT INTO ap_invoices (
           vendor_id, invoice_number, invoice_date, due_date, terms,
           subtotal, tax, shipping, total, document_id, purchase_order_id, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [vendor_id, invoice_number, invoice_date, due_date, terms,
         subtotal || 0, tax || 0, shipping || 0, calcTotal, document_id, purchase_order_id, notes]
      );
      const invoice = invoiceResult.rows[0];

      const insertedLines = [];
      if (lines && lines.length > 0) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineResult = await client.query(
            `INSERT INTO ap_invoice_lines (
               ap_invoice_id, line_number, raw_vendor_code, raw_description,
               quantity, unit, unit_price, line_total, mapped_ingredient_id, mapped_category_id, notes
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [
              invoice.id,
              line.line_number || i + 1,
              line.raw_vendor_code,
              line.raw_description,
              line.quantity,
              line.unit,
              line.unit_price,
              line.line_total,
              line.mapped_ingredient_id,
              line.mapped_category_id,
              line.notes,
            ]
          );
          insertedLines.push(lineResult.rows[0]);
        }
      }

      await client.query('COMMIT');

      res.status(201).json({ ...invoice, lines: insertedLines });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/**
 * PUT /invoices/:id - Update AP invoice
 */
router.put(
  '/invoices/:id',
  validateId,
  validateBody(updateApInvoiceSchema),
  asyncHandler(async (req, res) => {
    const invoice = await db.promisify.get('SELECT * FROM ap_invoices WHERE id = $1', [req.params.id]);
    if (!invoice) {
      throw new NotFoundError('AP Invoice');
    }
    if (invoice.posting_status === 'posted') {
      throw new Error('Cannot modify posted invoice');
    }

    const {
      vendor_id, invoice_number, invoice_date, due_date, terms,
      subtotal, tax, shipping, total, notes
    } = req.body;

    await db.promisify.run(
      `UPDATE ap_invoices SET
         vendor_id = COALESCE($1, vendor_id),
         invoice_number = COALESCE($2, invoice_number),
         invoice_date = COALESCE($3, invoice_date),
         due_date = COALESCE($4, due_date),
         terms = COALESCE($5, terms),
         subtotal = COALESCE($6, subtotal),
         tax = COALESCE($7, tax),
         shipping = COALESCE($8, shipping),
         total = COALESCE($9, total),
         notes = $10,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $11`,
      [vendor_id, invoice_number, invoice_date, due_date, terms, subtotal, tax, shipping, total, notes, req.params.id]
    );

    const updated = await db.promisify.get(
      `SELECT ai.*, v.name as vendor_name FROM ap_invoices ai
       LEFT JOIN vendors v ON ai.vendor_id = v.id WHERE ai.id = $1`,
      [req.params.id]
    );

    res.json(updated);
  })
);

/**
 * POST /invoices/:id/lines - Add lines to invoice
 */
router.post(
  '/invoices/:id/lines',
  validateId,
  asyncHandler(async (req, res) => {
    const invoice = await db.promisify.get('SELECT * FROM ap_invoices WHERE id = $1', [req.params.id]);
    if (!invoice) {
      throw new NotFoundError('AP Invoice');
    }

    const { lines } = req.body;
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      throw new Error('Lines array is required');
    }

    const insertedLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const result = await db.promisify.run(
        `INSERT INTO ap_invoice_lines (
           ap_invoice_id, line_number, raw_vendor_code, raw_description,
           quantity, unit, unit_price, line_total, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          req.params.id,
          line.line_number || i + 1,
          line.raw_vendor_code,
          line.raw_description,
          line.quantity,
          line.unit,
          line.unit_price,
          line.line_total,
          line.notes,
        ]
      );
      const inserted = await db.promisify.get('SELECT * FROM ap_invoice_lines WHERE id = $1', [result.id]);
      insertedLines.push(inserted);
    }

    res.status(201).json(insertedLines);
  })
);

/**
 * POST /invoices/:id/map - Apply auto-mapping to invoice lines
 */
router.post(
  '/invoices/:id/map',
  validateId,
  asyncHandler(async (req, res) => {
    const result = await apService.applyMappingsToInvoice(req.params.id);
    res.json(result);
  })
);

/**
 * POST /invoices/:id/approve - Approve invoice
 */
router.post(
  '/invoices/:id/approve',
  validateId,
  validateBody(approveInvoiceSchema),
  asyncHandler(async (req, res) => {
    const { approved_by, notes } = req.body;
    const invoice = await apService.approveInvoice(req.params.id, approved_by, notes);
    res.json(invoice);
  })
);

/**
 * POST /invoices/:id/reject - Reject invoice
 */
router.post(
  '/invoices/:id/reject',
  validateId,
  validateBody(rejectInvoiceSchema),
  asyncHandler(async (req, res) => {
    await db.promisify.run(
      `UPDATE ap_invoices SET
         approval_status = 'rejected',
         notes = $1,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [req.body.reason, req.params.id]
    );
    const invoice = await apService.getInvoice(req.params.id);
    if (!invoice) {
      throw new NotFoundError('AP Invoice');
    }
    res.json(invoice);
  })
);

/**
 * POST /invoices/:id/post - Post approved invoice to GL
 */
router.post(
  '/invoices/:id/post',
  validateId,
  asyncHandler(async (req, res) => {
    const result = await apService.postInvoice(req.params.id);
    res.json(result);
  })
);

/**
 * DELETE /invoices/:id - Delete draft invoice
 */
router.delete(
  '/invoices/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const invoice = await db.promisify.get('SELECT * FROM ap_invoices WHERE id = $1', [req.params.id]);
    if (!invoice) {
      throw new NotFoundError('AP Invoice');
    }
    if (invoice.posting_status === 'posted') {
      throw new Error('Cannot delete posted invoice');
    }

    await db.promisify.run('DELETE FROM ap_invoices WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Invoice deleted' });
  })
);

// ============================================
// PAYMENT BATCHES
// ============================================

/**
 * GET /payment-batches - List payment batches
 */
router.get(
  '/payment-batches',
  validateQuery(paymentBatchQuerySchema),
  asyncHandler(async (req, res) => {
    const { status, start_date, end_date, limit, offset } = req.query;

    let sql = `
      SELECT pb.*, ba.account_name as bank_account_name,
        (SELECT COUNT(*) FROM payment_batch_items WHERE batch_id = pb.id) as item_count
      FROM payment_batches pb
      LEFT JOIN bank_accounts ba ON pb.bank_account_id = ba.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (status) {
      sql += ` AND pb.status = $${p++}`;
      params.push(status);
    }
    if (start_date) {
      sql += ` AND pb.batch_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND pb.batch_date <= $${p++}`;
      params.push(end_date);
    }

    sql += ` ORDER BY pb.batch_date DESC, pb.id DESC LIMIT $${p++} OFFSET $${p++}`;
    params.push(limit, offset);

    const batches = await db.promisify.all(sql, params);
    res.json({ batches, pagination: { limit, offset } });
  })
);

/**
 * GET /payment-batches/:id - Get single batch with items
 */
router.get(
  '/payment-batches/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const batch = await db.promisify.get(
      `SELECT pb.*, ba.account_name as bank_account_name
       FROM payment_batches pb
       LEFT JOIN bank_accounts ba ON pb.bank_account_id = ba.id
       WHERE pb.id = $1`,
      [req.params.id]
    );
    if (!batch) {
      throw new NotFoundError('Payment batch');
    }

    const items = await db.promisify.all(
      `SELECT pbi.*, ap.invoice_number, ap.amount as invoice_amount, v.name as vendor_name
       FROM payment_batch_items pbi
       JOIN accounts_payable ap ON pbi.accounts_payable_id = ap.id
       JOIN vendors v ON ap.vendor_id = v.id
       WHERE pbi.batch_id = $1
       ORDER BY pbi.id`,
      [req.params.id]
    );

    res.json({ ...batch, items });
  })
);

/**
 * POST /payment-batches - Create payment batch
 */
router.post(
  '/payment-batches',
  validateBody(createPaymentBatchSchema),
  asyncHandler(async (req, res) => {
    const batch = await apService.createPaymentBatch(req.body);
    res.status(201).json(batch);
  })
);

/**
 * POST /payment-batches/:id/approve - Approve batch
 */
router.post(
  '/payment-batches/:id/approve',
  validateId,
  validateBody(approveBatchSchema),
  asyncHandler(async (req, res) => {
    const batch = await db.promisify.get('SELECT * FROM payment_batches WHERE id = $1', [req.params.id]);
    if (!batch) {
      throw new NotFoundError('Payment batch');
    }
    if (batch.status !== 'draft') {
      throw new Error('Only draft batches can be approved');
    }

    await db.promisify.run(
      `UPDATE payment_batches SET
         status = 'approved',
         approved_by = $1,
         approved_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [req.body.approved_by, req.params.id]
    );

    const updated = await db.promisify.get('SELECT * FROM payment_batches WHERE id = $1', [req.params.id]);
    res.json(updated);
  })
);

/**
 * POST /payment-batches/:id/process - Process approved batch
 */
router.post(
  '/payment-batches/:id/process',
  validateId,
  validateBody(processBatchSchema),
  asyncHandler(async (req, res) => {
    const result = await apService.processBatch(req.params.id, req.body.check_start_number);
    res.json(result);
  })
);

/**
 * DELETE /payment-batches/:id - Delete draft batch
 */
router.delete(
  '/payment-batches/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const batch = await db.promisify.get('SELECT * FROM payment_batches WHERE id = $1', [req.params.id]);
    if (!batch) {
      throw new NotFoundError('Payment batch');
    }
    if (batch.status !== 'draft') {
      throw new Error('Only draft batches can be deleted');
    }

    await db.promisify.run('DELETE FROM payment_batches WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Batch deleted' });
  })
);

/**
 * GET /payables/ready - Get payables ready for payment
 */
router.get(
  '/payables/ready',
  asyncHandler(async (req, res) => {
    const payables = await db.promisify.all(`
      SELECT ap.*, v.name as vendor_name,
        (ap.amount - ap.amount_paid) as balance_due
      FROM accounts_payable ap
      JOIN vendors v ON ap.vendor_id = v.id
      WHERE ap.status IN ('pending', 'partial')
        AND (ap.amount - ap.amount_paid) > 0
      ORDER BY ap.due_date, v.name
    `);
    res.json(payables);
  })
);

// Export router and service
module.exports = router;
module.exports.apService = apService;

