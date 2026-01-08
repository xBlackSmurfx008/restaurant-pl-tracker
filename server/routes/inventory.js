/**
 * Inventory Routes
 * Purchase orders, receiving, movements, counts, and stock levels
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const InventoryService = require('../services/InventoryService');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  poQuerySchema,
  createReceiptSchema,
  createMovementSchema,
  movementQuerySchema,
  createCountSchema,
  countQuerySchema,
  updateLevelSchema,
  levelQuerySchema,
} = require('../schemas/inventory.schema');

// Instantiate service
const inventoryService = new InventoryService(db.pool);

// ============================================
// PURCHASE ORDERS
// ============================================

/**
 * GET /purchase-orders - List purchase orders
 */
router.get(
  '/purchase-orders',
  validateQuery(poQuerySchema),
  asyncHandler(async (req, res) => {
    const { vendor_id, status, start_date, end_date, limit, offset } = req.query;

    let sql = `
      SELECT po.*,
        v.name as vendor_name,
        (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = po.id) as item_count,
        (SELECT COALESCE(SUM(received_quantity), 0) FROM purchase_order_items WHERE purchase_order_id = po.id) as total_received
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (vendor_id) {
      sql += ` AND po.vendor_id = $${p++}`;
      params.push(vendor_id);
    }
    if (status) {
      sql += ` AND po.status = $${p++}`;
      params.push(status);
    }
    if (start_date) {
      sql += ` AND po.order_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND po.order_date <= $${p++}`;
      params.push(end_date);
    }

    sql += ` ORDER BY po.order_date DESC, po.id DESC LIMIT $${p++} OFFSET $${p++}`;
    params.push(limit, offset);

    const orders = await db.promisify.all(sql, params);

    const countResult = await db.promisify.get(
      `SELECT COUNT(*) as total FROM purchase_orders po WHERE 1=1
       ${vendor_id ? 'AND po.vendor_id = $1' : ''}
       ${status ? `AND po.status = $${vendor_id ? 2 : 1}` : ''}`,
      [vendor_id, status].filter(Boolean)
    );

    res.json({
      orders,
      pagination: { limit, offset, total: parseInt(countResult.total, 10) },
    });
  })
);

/**
 * GET /purchase-orders/:id - Get single PO with items
 */
router.get(
  '/purchase-orders/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const po = await db.promisify.get(
      `SELECT po.*, v.name as vendor_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE po.id = $1`,
      [req.params.id]
    );
    if (!po) {
      throw new NotFoundError('Purchase order');
    }

    const items = await db.promisify.all(
      `SELECT poi.*, i.name as ingredient_name
       FROM purchase_order_items poi
       LEFT JOIN ingredients i ON poi.ingredient_id = i.id
       WHERE poi.purchase_order_id = $1
       ORDER BY poi.id`,
      [req.params.id]
    );

    const receipts = await db.promisify.all(
      `SELECT ir.*, 
        (SELECT json_agg(irl.*) FROM inventory_receipt_lines irl WHERE irl.receipt_id = ir.id) as lines
       FROM inventory_receipts ir
       WHERE ir.purchase_order_id = $1
       ORDER BY ir.receipt_date DESC`,
      [req.params.id]
    );

    res.json({ ...po, items, receipts });
  })
);

/**
 * POST /purchase-orders - Create PO
 */
router.post(
  '/purchase-orders',
  validateBody(createPurchaseOrderSchema),
  asyncHandler(async (req, res) => {
    const { vendor_id, order_date, expected_delivery, notes, items } = req.body;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

      const poResult = await client.query(
        `INSERT INTO purchase_orders (vendor_id, order_date, expected_delivery, status, subtotal, total, notes)
         VALUES ($1, $2, $3, 'pending', $4, $4, $5)
         RETURNING *`,
        [vendor_id, order_date, expected_delivery, subtotal, notes]
      );
      const po = poResult.rows[0];

      const insertedItems = [];
      for (const item of items) {
        const total_price = item.quantity * item.unit_price;
        const itemResult = await client.query(
          `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, description, quantity, unit, unit_price, total_price, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [po.id, item.ingredient_id, item.description, item.quantity, item.unit, item.unit_price, total_price, item.notes]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      await client.query('COMMIT');

      res.status(201).json({ ...po, items: insertedItems });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/**
 * PUT /purchase-orders/:id - Update PO
 */
router.put(
  '/purchase-orders/:id',
  validateId,
  validateBody(updatePurchaseOrderSchema),
  asyncHandler(async (req, res) => {
    const { order_date, expected_delivery, status, notes } = req.body;

    await db.promisify.run(
      `UPDATE purchase_orders SET
         order_date = COALESCE($1, order_date),
         expected_delivery = $2,
         status = COALESCE($3, status),
         notes = $4,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [order_date, expected_delivery, status, notes, req.params.id]
    );

    const po = await db.promisify.get('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
    if (!po) {
      throw new NotFoundError('Purchase order');
    }

    res.json(po);
  })
);

/**
 * DELETE /purchase-orders/:id - Delete PO (only if pending)
 */
router.delete(
  '/purchase-orders/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const po = await db.promisify.get('SELECT status FROM purchase_orders WHERE id = $1', [req.params.id]);
    if (!po) {
      throw new NotFoundError('Purchase order');
    }
    if (po.status !== 'pending') {
      throw new Error('Can only delete pending purchase orders');
    }

    await db.promisify.run('DELETE FROM purchase_orders WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Purchase order deleted' });
  })
);

// ============================================
// RECEIVING
// ============================================

/**
 * POST /receipts - Receive against a PO
 */
router.post(
  '/receipts',
  validateBody(createReceiptSchema),
  asyncHandler(async (req, res) => {
    const receipt = await inventoryService.receiveAgainstPO(req.body);
    res.status(201).json(receipt);
  })
);

/**
 * GET /receipts - List receipts
 */
router.get(
  '/receipts',
  asyncHandler(async (req, res) => {
    const { purchase_order_id, start_date, end_date, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT ir.*, po.order_date as po_order_date, v.name as vendor_name
      FROM inventory_receipts ir
      JOIN purchase_orders po ON ir.purchase_order_id = po.id
      LEFT JOIN vendors v ON po.vendor_id = v.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (purchase_order_id) {
      sql += ` AND ir.purchase_order_id = $${p++}`;
      params.push(purchase_order_id);
    }
    if (start_date) {
      sql += ` AND ir.receipt_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND ir.receipt_date <= $${p++}`;
      params.push(end_date);
    }

    sql += ` ORDER BY ir.receipt_date DESC, ir.id DESC LIMIT $${p++} OFFSET $${p++}`;
    params.push(limit, offset);

    const receipts = await db.promisify.all(sql, params);
    res.json(receipts);
  })
);

/**
 * GET /receipts/:id - Get single receipt with lines
 */
router.get(
  '/receipts/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const receipt = await db.promisify.get(
      `SELECT ir.*, po.order_date as po_order_date, v.name as vendor_name
       FROM inventory_receipts ir
       JOIN purchase_orders po ON ir.purchase_order_id = po.id
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE ir.id = $1`,
      [req.params.id]
    );
    if (!receipt) {
      throw new NotFoundError('Receipt');
    }

    const lines = await db.promisify.all(
      `SELECT irl.*, i.name as ingredient_name, poi.description as po_description
       FROM inventory_receipt_lines irl
       LEFT JOIN ingredients i ON irl.ingredient_id = i.id
       LEFT JOIN purchase_order_items poi ON irl.po_item_id = poi.id
       WHERE irl.receipt_id = $1
       ORDER BY irl.id`,
      [req.params.id]
    );

    res.json({ ...receipt, lines });
  })
);

// ============================================
// MOVEMENTS
// ============================================

/**
 * GET /movements - List inventory movements
 */
router.get(
  '/movements',
  validateQuery(movementQuerySchema),
  asyncHandler(async (req, res) => {
    const { ingredient_id, movement_type, start_date, end_date, limit, offset } = req.query;

    let sql = `
      SELECT im.*, i.name as ingredient_name
      FROM inventory_movements im
      LEFT JOIN ingredients i ON im.ingredient_id = i.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (ingredient_id) {
      sql += ` AND im.ingredient_id = $${p++}`;
      params.push(ingredient_id);
    }
    if (movement_type) {
      sql += ` AND im.movement_type = $${p++}`;
      params.push(movement_type);
    }
    if (start_date) {
      sql += ` AND im.movement_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND im.movement_date <= $${p++}`;
      params.push(end_date);
    }

    sql += ` ORDER BY im.movement_date DESC, im.id DESC LIMIT $${p++} OFFSET $${p++}`;
    params.push(limit, offset);

    const movements = await db.promisify.all(sql, params);

    res.json({ movements, pagination: { limit, offset } });
  })
);

/**
 * POST /movements - Record a manual movement
 */
router.post(
  '/movements',
  validateBody(createMovementSchema),
  asyncHandler(async (req, res) => {
    const movement = await inventoryService.recordMovement(req.body);
    res.status(201).json(movement);
  })
);

// ============================================
// COUNTS
// ============================================

/**
 * GET /counts - List inventory counts
 */
router.get(
  '/counts',
  validateQuery(countQuerySchema),
  asyncHandler(async (req, res) => {
    const { start_date, end_date, ingredient_id, limit, offset } = req.query;

    let sql = `
      SELECT ic.*, i.name as ingredient_name
      FROM inventory_counts ic
      LEFT JOIN ingredients i ON ic.ingredient_id = i.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (ingredient_id) {
      sql += ` AND ic.ingredient_id = $${p++}`;
      params.push(ingredient_id);
    }
    if (start_date) {
      sql += ` AND ic.count_date >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND ic.count_date <= $${p++}`;
      params.push(end_date);
    }

    sql += ` ORDER BY ic.count_date DESC, ic.id DESC LIMIT $${p++} OFFSET $${p++}`;
    params.push(limit, offset);

    const counts = await db.promisify.all(sql, params);

    res.json({ counts, pagination: { limit, offset } });
  })
);

/**
 * POST /counts - Record physical count
 */
router.post(
  '/counts',
  validateBody(createCountSchema),
  asyncHandler(async (req, res) => {
    const result = await inventoryService.recordCount(req.body);
    res.status(201).json(result);
  })
);

// ============================================
// LEVELS (Current Stock)
// ============================================

/**
 * GET /levels - Get current stock levels
 */
router.get(
  '/levels',
  validateQuery(levelQuerySchema),
  asyncHandler(async (req, res) => {
    const { below_reorder, limit, offset } = req.query;

    let sql = `
      SELECT il.*, i.name as ingredient_name, i.purchase_unit, i.usage_unit
      FROM inventory_levels il
      JOIN ingredients i ON il.ingredient_id = i.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (below_reorder) {
      sql += ` AND il.quantity_on_hand < COALESCE(il.reorder_point, 0)`;
    }

    sql += ` ORDER BY i.name LIMIT $${p++} OFFSET $${p++}`;
    params.push(limit, offset);

    const levels = await db.promisify.all(sql, params);

    const totalValueResult = await db.promisify.get('SELECT SUM(total_value) as total_inventory_value FROM inventory_levels');

    res.json({
      levels,
      summary: {
        total_inventory_value: parseFloat(totalValueResult.total_inventory_value || 0),
      },
      pagination: { limit, offset },
    });
  })
);

/**
 * GET /levels/:id - Get level for specific ingredient
 */
router.get(
  '/levels/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const level = await db.promisify.get(
      `SELECT il.*, i.name as ingredient_name, i.category
       FROM inventory_levels il
       JOIN ingredients i ON il.ingredient_id = i.id
       WHERE il.ingredient_id = $1`,
      [req.params.id]
    );

    if (!level) {
      // Return zero level if not tracked yet
      const ingredient = await db.promisify.get('SELECT * FROM ingredients WHERE id = $1', [req.params.id]);
      if (!ingredient) {
        throw new NotFoundError('Ingredient');
      }
      res.json({
        ingredient_id: ingredient.id,
        ingredient_name: ingredient.name,
        quantity_on_hand: 0,
        unit: ingredient.unit,
        average_cost: 0,
        total_value: 0,
      });
      return;
    }

    res.json(level);
  })
);

/**
 * PUT /levels/:id - Update level settings (reorder point, par level, etc.)
 */
router.put(
  '/levels/:id',
  validateId,
  validateBody(updateLevelSchema),
  asyncHandler(async (req, res) => {
    const { reorder_point, reorder_quantity, par_level } = req.body;

    // Ensure level exists
    const ingredient = await db.promisify.get('SELECT * FROM ingredients WHERE id = $1', [req.params.id]);
    if (!ingredient) {
      throw new NotFoundError('Ingredient');
    }

    await inventoryService.ensureLevelExists(req.params.id, ingredient.unit);

    await db.promisify.run(
      `UPDATE inventory_levels SET
         reorder_point = $1,
         reorder_quantity = $2,
         par_level = $3,
         updated_at = CURRENT_TIMESTAMP
       WHERE ingredient_id = $4`,
      [reorder_point, reorder_quantity, par_level, req.params.id]
    );

    const level = await db.promisify.get(
      `SELECT il.*, i.name as ingredient_name
       FROM inventory_levels il
       JOIN ingredients i ON il.ingredient_id = i.id
       WHERE il.ingredient_id = $1`,
      [req.params.id]
    );

    res.json(level);
  })
);

/**
 * GET /alerts/reorder - Get items below reorder point
 */
router.get(
  '/alerts/reorder',
  asyncHandler(async (req, res) => {
    const alerts = await db.promisify.all(`
      SELECT il.*, i.name as ingredient_name, i.purchase_unit, i.usage_unit,
        (il.reorder_point - il.quantity_on_hand) as shortage_amount
      FROM inventory_levels il
      JOIN ingredients i ON il.ingredient_id = i.id
      WHERE il.reorder_point IS NOT NULL
        AND il.quantity_on_hand < il.reorder_point
      ORDER BY (il.reorder_point - il.quantity_on_hand) DESC
    `);

    res.json(alerts);
  })
);

// Export router and service
module.exports = router;
module.exports.inventoryService = inventoryService;

