/**
 * InventoryService
 * Manages perpetual inventory: movements, levels, receipts, counts
 */
const { ValidationError, NotFoundError } = require('../utils/errors');
const { serviceLogger } = require('../utils/logger');

class InventoryService {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
    this.logger = serviceLogger.child({ service: 'inventory' });
  }

  // ============================================
  // INVENTORY LEVELS
  // ============================================

  /**
   * Ensure inventory_levels row exists for an ingredient
   */
  async ensureLevelExists(ingredientId, unit, client = this.pool) {
    const existing = await client.query(
      'SELECT id FROM inventory_levels WHERE ingredient_id = $1',
      [ingredientId]
    );
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO inventory_levels (ingredient_id, unit, quantity_on_hand)
         VALUES ($1, $2, 0)
         ON CONFLICT (ingredient_id) DO NOTHING`,
        [ingredientId, unit]
      );
    }
  }

  /**
   * Update inventory level after a movement
   * Uses weighted average cost for receipts
   */
  async updateLevelFromMovement(movement, client = this.pool) {
    const { ingredient_id, movement_type, quantity, unit, unit_cost } = movement;

    await this.ensureLevelExists(ingredient_id, unit, client);

    const currentLevel = await client.query(
      'SELECT * FROM inventory_levels WHERE ingredient_id = $1 FOR UPDATE',
      [ingredient_id]
    );
    const level = currentLevel.rows[0];

    let newQty = parseFloat(level.quantity_on_hand) + parseFloat(quantity);
    let newAvgCost = parseFloat(level.average_cost) || 0;
    let lastReceivedDate = level.last_received_date;
    let lastUsedDate = level.last_used_date;
    let lastCountDate = level.last_count_date;

    // Calculate weighted average cost for receipts
    if (quantity > 0 && unit_cost && unit_cost > 0) {
      const oldValue = parseFloat(level.quantity_on_hand) * newAvgCost;
      const newValue = parseFloat(quantity) * parseFloat(unit_cost);
      if (newQty > 0) {
        newAvgCost = (oldValue + newValue) / newQty;
      }
    }

    // Update tracking dates based on movement type
    const today = new Date().toISOString().split('T')[0];
    if (['receipt', 'transfer_in'].includes(movement_type)) {
      lastReceivedDate = today;
    } else if (['usage', 'waste', 'transfer_out'].includes(movement_type)) {
      lastUsedDate = today;
    } else if (movement_type === 'count_adjustment') {
      lastCountDate = today;
    }

    const totalValue = newQty * newAvgCost;

    await client.query(
      `UPDATE inventory_levels SET
         quantity_on_hand = $1,
         average_cost = $2,
         total_value = $3,
         last_received_date = COALESCE($4, last_received_date),
         last_used_date = COALESCE($5, last_used_date),
         last_count_date = COALESCE($6, last_count_date),
         updated_at = CURRENT_TIMESTAMP
       WHERE ingredient_id = $7`,
      [
        newQty,
        newAvgCost,
        totalValue,
        lastReceivedDate,
        lastUsedDate,
        lastCountDate,
        ingredient_id,
      ]
    );

    this.logger.debug(
      { ingredient_id, movement_type, quantity, newQty, newAvgCost },
      'Inventory level updated'
    );

    return { quantity_on_hand: newQty, average_cost: newAvgCost, total_value: totalValue };
  }

  // ============================================
  // MOVEMENTS
  // ============================================

  /**
   * Record an inventory movement and update levels
   */
  async recordMovement(input) {
    const {
      ingredient_id,
      movement_type,
      quantity,
      unit,
      unit_cost = null,
      reference_type = null,
      reference_id = null,
      reason = null,
      performed_by = null,
      movement_date = new Date().toISOString().split('T')[0],
      notes = null,
    } = input;

    const total_cost = unit_cost ? parseFloat(quantity) * parseFloat(unit_cost) : null;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify ingredient exists
      const ing = await client.query('SELECT id, name FROM ingredients WHERE id = $1', [ingredient_id]);
      if (ing.rows.length === 0) {
        throw new NotFoundError('Ingredient');
      }

      // Insert movement
      const result = await client.query(
        `INSERT INTO inventory_movements (
           ingredient_id, movement_type, quantity, unit, unit_cost, total_cost,
           reference_type, reference_id, reason, performed_by, movement_date, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          ingredient_id,
          movement_type,
          quantity,
          unit,
          unit_cost,
          total_cost,
          reference_type,
          reference_id,
          reason,
          performed_by,
          movement_date,
          notes,
        ]
      );

      const movement = result.rows[0];

      // Update inventory levels
      const levelUpdate = await this.updateLevelFromMovement(movement, client);

      await client.query('COMMIT');

      this.logger.info(
        { movementId: movement.id, ingredient_id, movement_type, quantity },
        'Inventory movement recorded'
      );

      return { ...movement, level: levelUpdate };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ============================================
  // RECEIVING
  // ============================================

  /**
   * Receive items against a purchase order
   */
  async receiveAgainstPO(input) {
    const {
      purchase_order_id,
      receipt_date = new Date().toISOString().split('T')[0],
      received_by = null,
      invoice_number = null,
      invoice_total = null,
      notes = null,
      lines,
    } = input;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify PO exists
      const poResult = await client.query(
        'SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE',
        [purchase_order_id]
      );
      if (poResult.rows.length === 0) {
        throw new NotFoundError('Purchase order');
      }

      // Create receipt header
      const receiptResult = await client.query(
        `INSERT INTO inventory_receipts (
           purchase_order_id, receipt_date, received_by, invoice_number, invoice_total, notes
         ) VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [purchase_order_id, receipt_date, received_by, invoice_number, invoice_total, notes]
      );
      const receipt = receiptResult.rows[0];

      const receiptLines = [];
      const movements = [];

      for (const line of lines) {
        const { po_item_id, ingredient_id, quantity_received, unit, unit_cost, condition, notes: lineNotes } = line;

        // Verify PO item belongs to this PO
        const poItem = await client.query(
          'SELECT * FROM purchase_order_items WHERE id = $1 AND purchase_order_id = $2',
          [po_item_id, purchase_order_id]
        );
        if (poItem.rows.length === 0) {
          throw new ValidationError(`PO item ${po_item_id} not found on this purchase order`);
        }

        const total_cost = parseFloat(quantity_received) * parseFloat(unit_cost);

        // Insert receipt line
        const lineResult = await client.query(
          `INSERT INTO inventory_receipt_lines (
             receipt_id, po_item_id, ingredient_id, quantity_received, unit, unit_cost, total_cost, condition, notes
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING *`,
          [receipt.id, po_item_id, ingredient_id || poItem.rows[0].ingredient_id, quantity_received, unit, unit_cost, total_cost, condition, lineNotes]
        );
        receiptLines.push(lineResult.rows[0]);

        // Update PO item received_quantity
        await client.query(
          `UPDATE purchase_order_items SET received_quantity = received_quantity + $1 WHERE id = $2`,
          [quantity_received, po_item_id]
        );

        // Record inventory movement if good condition and has ingredient
        const effectiveIngredientId = ingredient_id || poItem.rows[0].ingredient_id;
        if (condition === 'good' && effectiveIngredientId) {
          const movementResult = await client.query(
            `INSERT INTO inventory_movements (
               ingredient_id, movement_type, quantity, unit, unit_cost, total_cost,
               reference_type, reference_id, performed_by, movement_date, notes
             ) VALUES ($1,'receipt',$2,$3,$4,$5,'receipt',$6,$7,$8,$9)
             RETURNING *`,
            [
              effectiveIngredientId,
              quantity_received,
              unit,
              unit_cost,
              total_cost,
              receipt.id,
              received_by,
              receipt_date,
              `Received from PO #${purchase_order_id}`,
            ]
          );

          const movement = movementResult.rows[0];
          movements.push(movement);

          // Update inventory levels
          await this.updateLevelFromMovement(movement, client);
        }
      }

      // Update PO status based on received quantities
      const poItems = await client.query(
        'SELECT quantity, received_quantity FROM purchase_order_items WHERE purchase_order_id = $1',
        [purchase_order_id]
      );
      const allReceived = poItems.rows.every(
        (item) => parseFloat(item.received_quantity) >= parseFloat(item.quantity)
      );
      const anyReceived = poItems.rows.some((item) => parseFloat(item.received_quantity) > 0);

      let newStatus = 'ordered';
      if (allReceived) {
        newStatus = 'received';
      } else if (anyReceived) {
        newStatus = 'partial';
      }

      await client.query(
        `UPDATE purchase_orders SET
           status = $1,
           actual_delivery = CASE WHEN $2 = 'received' THEN $3 ELSE actual_delivery END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [newStatus, newStatus, receipt_date, purchase_order_id]
      );

      await client.query('COMMIT');

      this.logger.info(
        { receiptId: receipt.id, purchase_order_id, linesCount: lines.length },
        'PO receipt processed'
      );

      return { ...receipt, lines: receiptLines, movements };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ============================================
  // COUNTS & VARIANCE
  // ============================================

  /**
   * Record a physical inventory count and adjust levels
   */
  async recordCount(input) {
    const {
      count_date = new Date().toISOString().split('T')[0],
      counted_by = null,
      notes = null,
      items,
    } = input;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const countResults = [];
      const adjustments = [];

      for (const item of items) {
        const { ingredient_id, quantity_on_hand, unit, unit_cost, notes: itemNotes } = item;

        // Get current system level
        const levelResult = await client.query(
          'SELECT quantity_on_hand, average_cost FROM inventory_levels WHERE ingredient_id = $1',
          [ingredient_id]
        );

        const systemQty = levelResult.rows.length > 0 ? parseFloat(levelResult.rows[0].quantity_on_hand) : 0;
        const avgCost = levelResult.rows.length > 0 ? parseFloat(levelResult.rows[0].average_cost) : (unit_cost || 0);
        const variance = parseFloat(quantity_on_hand) - systemQty;

        // Insert count record
        const total_value = parseFloat(quantity_on_hand) * (unit_cost || avgCost);
        const countResult = await client.query(
          `INSERT INTO inventory_counts (count_date, ingredient_id, quantity_on_hand, unit, unit_cost, total_value, counted_by, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING *`,
          [count_date, ingredient_id, quantity_on_hand, unit, unit_cost || avgCost, total_value, counted_by, itemNotes]
        );

        const countRecord = {
          ...countResult.rows[0],
          system_quantity: systemQty,
          variance,
        };
        countResults.push(countRecord);

        // If variance, record adjustment movement
        if (Math.abs(variance) > 0.0001) {
          const movementResult = await client.query(
            `INSERT INTO inventory_movements (
               ingredient_id, movement_type, quantity, unit, unit_cost, total_cost,
               reference_type, reference_id, reason, performed_by, movement_date, notes
             ) VALUES ($1,'count_adjustment',$2,$3,$4,$5,'count',$6,$7,$8,$9,$10)
             RETURNING *`,
            [
              ingredient_id,
              variance,
              unit,
              avgCost,
              variance * avgCost,
              countRecord.id,
              variance > 0 ? 'Count overage' : 'Count shortage',
              counted_by,
              count_date,
              `Physical count adjustment: system=${systemQty}, counted=${quantity_on_hand}`,
            ]
          );

          adjustments.push(movementResult.rows[0]);

          // Update inventory level directly to the counted amount
          await this.ensureLevelExists(ingredient_id, unit, client);
          await client.query(
            `UPDATE inventory_levels SET
               quantity_on_hand = $1,
               total_value = $2,
               last_count_date = $3,
               updated_at = CURRENT_TIMESTAMP
             WHERE ingredient_id = $4`,
            [quantity_on_hand, total_value, count_date, ingredient_id]
          );
        }
      }

      await client.query('COMMIT');

      this.logger.info(
        { count_date, itemsCount: items.length, adjustmentsCount: adjustments.length },
        'Inventory count recorded'
      );

      return { count_date, counted_by, notes, items: countResults, adjustments };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ============================================
  // USAGE (for recipe depletion)
  // ============================================

  /**
   * Record usage of an ingredient (typically from recipe/sale)
   */
  async recordUsage(ingredient_id, quantity, unit, options = {}) {
    const {
      reference_type = 'recipe',
      reference_id = null,
      performed_by = null,
      notes = null,
    } = options;

    // Usage is always a negative movement
    return this.recordMovement({
      ingredient_id,
      movement_type: 'usage',
      quantity: -Math.abs(quantity),
      unit,
      reference_type,
      reference_id,
      performed_by,
      notes,
    });
  }

  /**
   * Record waste/spoilage
   */
  async recordWaste(ingredient_id, quantity, unit, reason, options = {}) {
    const { performed_by = null, notes = null } = options;

    return this.recordMovement({
      ingredient_id,
      movement_type: 'waste',
      quantity: -Math.abs(quantity),
      unit,
      reason,
      performed_by,
      notes,
    });
  }
}

module.exports = InventoryService;

