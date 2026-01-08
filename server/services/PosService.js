/**
 * POS Integration Service
 * Vendor-agnostic POS integration for importing transactions, settlements, and syncing data
 */
const { query, pool } = require('../db');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');
const PostingService = require('./PostingService');

// Create posting service instance
const postingService = new PostingService(pool);

/**
 * Encrypt API key for storage (simplified - in production use proper encryption)
 */
function encryptApiKey(key) {
  if (!key) return null;
  // In production, use proper encryption with a secure key
  return Buffer.from(key).toString('base64');
}

/**
 * Decrypt API key for use
 */
function decryptApiKey(encrypted) {
  if (!encrypted) return null;
  return Buffer.from(encrypted, 'base64').toString('utf8');
}

/**
 * Create a POS configuration
 */
async function createPosConfig({ provider, name, api_key, location_id, webhook_secret, settings }) {
  const encryptedKey = encryptApiKey(api_key);
  const encryptedWebhook = encryptApiKey(webhook_secret);
  
  const result = await query(
    `INSERT INTO pos_configurations (provider, name, api_key_encrypted, location_id, webhook_secret, settings, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id, provider, name, location_id, is_active, settings, created_at, updated_at`,
    [provider, name, encryptedKey, location_id, encryptedWebhook, JSON.stringify(settings || {})]
  );
  return result.rows[0];
}

/**
 * Get all POS configurations
 */
async function getPosConfigs() {
  const result = await query(
    `SELECT id, provider, name, location_id, is_active, settings, created_at, updated_at
     FROM pos_configurations
     ORDER BY name`
  );
  return result.rows;
}

/**
 * Get POS configuration by ID
 */
async function getPosConfigById(id) {
  const result = await query(
    `SELECT id, provider, name, location_id, is_active, settings, created_at, updated_at
     FROM pos_configurations WHERE id = $1`,
    [id]
  );
  if (!result.rows.length) {
    throw new NotFoundError('POS configuration not found');
  }
  return result.rows[0];
}

/**
 * Update POS configuration
 */
async function updatePosConfig(id, updates) {
  const config = await getPosConfigById(id);
  
  const fields = [];
  const values = [];
  let idx = 1;
  
  if (updates.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(updates.name);
  }
  if (updates.api_key !== undefined) {
    fields.push(`api_key_encrypted = $${idx++}`);
    values.push(encryptApiKey(updates.api_key));
  }
  if (updates.location_id !== undefined) {
    fields.push(`location_id = $${idx++}`);
    values.push(updates.location_id);
  }
  if (updates.webhook_secret !== undefined) {
    fields.push(`webhook_secret = $${idx++}`);
    values.push(encryptApiKey(updates.webhook_secret));
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(updates.is_active);
  }
  if (updates.settings !== undefined) {
    fields.push(`settings = $${idx++}`);
    values.push(JSON.stringify(updates.settings));
  }
  
  if (!fields.length) {
    return config;
  }
  
  fields.push(`updated_at = NOW()`);
  values.push(id);
  
  const result = await query(
    `UPDATE pos_configurations SET ${fields.join(', ')} WHERE id = $${idx}
     RETURNING id, provider, name, location_id, is_active, settings, created_at, updated_at`,
    values
  );
  return result.rows[0];
}

/**
 * Delete POS configuration
 */
async function deletePosConfig(id) {
  await getPosConfigById(id);
  await query('DELETE FROM pos_configurations WHERE id = $1', [id]);
  return { deleted: true };
}

/**
 * Import a single transaction
 */
async function importTransaction(posConfigId, txn) {
  // Check for duplicate
  const existing = await query(
    'SELECT id FROM pos_transactions WHERE pos_config_id = $1 AND external_id = $2',
    [posConfigId, txn.external_id]
  );
  
  if (existing.rows.length) {
    throw new ConflictError(`Transaction ${txn.external_id} already imported`);
  }
  
  // Insert transaction
  const result = await query(
    `INSERT INTO pos_transactions (
      pos_config_id, external_id, transaction_date, transaction_type,
      subtotal, tax_amount, tip_amount, discount_amount, total_amount,
      payment_method, card_brand, card_last_four, customer_name, customer_email,
      employee_external_id, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      posConfigId, txn.external_id, txn.transaction_date, txn.transaction_type || 'sale',
      txn.subtotal, txn.tax_amount || 0, txn.tip_amount || 0, txn.discount_amount || 0, txn.total_amount,
      txn.payment_method, txn.card_brand, txn.card_last_four, txn.customer_name, txn.customer_email,
      txn.employee_external_id, JSON.stringify(txn.raw_data || {})
    ]
  );
  
  const transaction = result.rows[0];
  
  // Insert line items if present
  if (txn.items && txn.items.length) {
    for (const item of txn.items) {
      await query(
        `INSERT INTO pos_transaction_items (
          pos_transaction_id, external_item_id, name, quantity, unit_price,
          total_price, category, menu_item_id, modifiers
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          transaction.id, item.external_item_id, item.name, item.quantity, item.unit_price,
          item.total_price, item.category, item.menu_item_id, JSON.stringify(item.modifiers || {})
        ]
      );
    }
  }
  
  return transaction;
}

/**
 * Batch import transactions
 */
async function batchImportTransactions(posConfigId, transactions) {
  const results = { imported: 0, skipped: 0, errors: [] };
  
  for (const txn of transactions) {
    try {
      await importTransaction(posConfigId, txn);
      results.imported++;
    } catch (err) {
      if (err instanceof ConflictError) {
        results.skipped++;
      } else {
        results.errors.push({ external_id: txn.external_id, error: err.message });
      }
    }
  }
  
  return results;
}

/**
 * Get transactions with filters
 */
async function getTransactions({ pos_config_id, start_date, end_date, transaction_type, payment_method, limit = 100, offset = 0 }) {
  let sql = `
    SELECT t.*, c.provider, c.name as pos_name,
           (SELECT json_agg(row_to_json(i)) FROM pos_transaction_items i WHERE i.pos_transaction_id = t.id) as items
    FROM pos_transactions t
    JOIN pos_configurations c ON c.id = t.pos_config_id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  
  if (pos_config_id) {
    sql += ` AND t.pos_config_id = $${idx++}`;
    params.push(pos_config_id);
  }
  if (start_date) {
    sql += ` AND DATE(t.transaction_date) >= $${idx++}`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND DATE(t.transaction_date) <= $${idx++}`;
    params.push(end_date);
  }
  if (transaction_type) {
    sql += ` AND t.transaction_type = $${idx++}`;
    params.push(transaction_type);
  }
  if (payment_method) {
    sql += ` AND t.payment_method = $${idx++}`;
    params.push(payment_method);
  }
  
  sql += ` ORDER BY t.transaction_date DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);
  
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Get transaction by ID
 */
async function getTransactionById(id) {
  const result = await query(
    `SELECT t.*, c.provider, c.name as pos_name,
            (SELECT json_agg(row_to_json(i)) FROM pos_transaction_items i WHERE i.pos_transaction_id = t.id) as items
     FROM pos_transactions t
     JOIN pos_configurations c ON c.id = t.pos_config_id
     WHERE t.id = $1`,
    [id]
  );
  if (!result.rows.length) {
    throw new NotFoundError('Transaction not found');
  }
  return result.rows[0];
}

/**
 * Import a settlement record (daily rollup)
 */
async function importSettlement({
  pos_config_id, external_id, settlement_date,
  cash_sales, card_sales, gift_card_sales, other_sales,
  total_sales, total_refunds, total_discounts, total_tips, total_tax,
  net_sales, transaction_count, raw_data
}) {
  // Check for duplicate
  if (external_id) {
    const existing = await query(
      'SELECT id FROM pos_settlements WHERE pos_config_id = $1 AND external_id = $2',
      [pos_config_id, external_id]
    );
    if (existing.rows.length) {
      throw new ConflictError(`Settlement ${external_id} already imported`);
    }
  }
  
  const result = await query(
    `INSERT INTO pos_settlements (
      pos_config_id, external_id, settlement_date,
      cash_sales, card_sales, gift_card_sales, other_sales,
      total_sales, total_refunds, total_discounts, total_tips, total_tax,
      net_sales, transaction_count, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      pos_config_id, external_id, settlement_date,
      cash_sales || 0, card_sales || 0, gift_card_sales || 0, other_sales || 0,
      total_sales, total_refunds || 0, total_discounts || 0, total_tips || 0, total_tax || 0,
      net_sales, transaction_count || 0, JSON.stringify(raw_data || {})
    ]
  );
  
  return result.rows[0];
}

/**
 * Get settlements with filters
 */
async function getSettlements({ pos_config_id, start_date, end_date }) {
  let sql = `
    SELECT s.*, c.provider, c.name as pos_name
    FROM pos_settlements s
    JOIN pos_configurations c ON c.id = s.pos_config_id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  
  if (pos_config_id) {
    sql += ` AND s.pos_config_id = $${idx++}`;
    params.push(pos_config_id);
  }
  if (start_date) {
    sql += ` AND s.settlement_date >= $${idx++}`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND s.settlement_date <= $${idx++}`;
    params.push(end_date);
  }
  
  sql += ' ORDER BY s.settlement_date DESC';
  
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Post settlement to GL (creates sales journal entry)
 */
async function postSettlementToGL(settlementId, userId) {
  const settlement = await query('SELECT * FROM pos_settlements WHERE id = $1', [settlementId]);
  if (!settlement.rows.length) {
    throw new NotFoundError('Settlement not found');
  }
  
  const s = settlement.rows[0];
  
  if (s.is_posted) {
    throw new BadRequestError('Settlement already posted to GL');
  }
  
  // Create journal entry for daily sales
  // Standard chart of accounts:
  // 1000 - Cash/Checking (Debit for cash sales)
  // 1100 - Accounts Receivable (Debit for card sales until settlement)
  // 2200 - Sales Tax Payable (Credit)
  // 2400 - Gift Cards Outstanding (Debit to reduce liability when redeemed)
  // 4000 - Food Sales (Credit)
  // 4300 - Other Income (Credit for tips, or Liability for tips payable)
  
  const lines = [];
  
  // Calculate total cash/card received (gross receipts)
  const totalReceipts = parseFloat(s.cash_sales || 0) + parseFloat(s.card_sales || 0) + 
                        parseFloat(s.gift_card_sales || 0) + parseFloat(s.other_sales || 0);
  
  // Debits: Cash and receivables
  if (parseFloat(s.cash_sales) > 0) {
    lines.push({ account_number: '1000', description: 'Cash sales', debit: parseFloat(s.cash_sales), credit: 0 });
  }
  if (parseFloat(s.card_sales) > 0) {
    lines.push({ account_number: '1100', description: 'Card sales receivable', debit: parseFloat(s.card_sales), credit: 0 });
  }
  if (parseFloat(s.gift_card_sales) > 0) {
    // Redeeming gift cards reduces the liability
    lines.push({ account_number: '2400', description: 'Gift card redemption', debit: parseFloat(s.gift_card_sales), credit: 0 });
  }
  if (parseFloat(s.other_sales) > 0) {
    lines.push({ account_number: '1000', description: 'Other payment received', debit: parseFloat(s.other_sales), credit: 0 });
  }
  
  // Credit: Sales revenue (net of discounts and refunds)
  const netRevenue = parseFloat(s.net_sales || 0);
  if (netRevenue > 0) {
    lines.push({ account_number: '4000', description: 'Food/Beverage sales', debit: 0, credit: netRevenue });
  }
  
  // Credit: Sales tax payable
  if (parseFloat(s.total_tax) > 0) {
    lines.push({ account_number: '2200', description: 'Sales tax collected', debit: 0, credit: parseFloat(s.total_tax) });
  }
  
  // Credit: Tips to Other Income (simplified - in full system would go to Tips Payable)
  if (parseFloat(s.total_tips) > 0) {
    lines.push({ account_number: '4300', description: 'Tips received', debit: 0, credit: parseFloat(s.total_tips) });
  }
  
  if (lines.length === 0) {
    throw new BadRequestError('Settlement has no amounts to post');
  }
  
  // Verify the entry will balance
  const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);
  
  // If not balanced, adjust using Other Income account
  const diff = Math.round((totalDebits - totalCredits) * 100) / 100;
  if (diff !== 0) {
    if (diff > 0) {
      // More debits than credits - need to add a credit
      lines.push({ account_number: '4300', description: 'Balancing adjustment', debit: 0, credit: diff });
    } else {
      // More credits than debits - need to add a debit
      lines.push({ account_number: '4300', description: 'Balancing adjustment', debit: Math.abs(diff), credit: 0 });
    }
  }
  
  // Resolve account IDs for journal entry lines
  const resolvedLines = [];
  for (const line of lines) {
    const accountId = await postingService.getAccountIdByNumber(line.account_number);
    resolvedLines.push({
      account_id: accountId,
      debit: line.debit,
      credit: line.credit,
      description: line.description
    });
  }

  // Post to GL
  const entry = await postingService.createJournalEntry({
    entry_date: s.settlement_date,
    description: `POS Settlement - ${s.settlement_date}`,
    reference_type: 'pos_settlement',
    reference_id: s.id,
    created_by: userId,
    lines: resolvedLines
  });
  
  // Mark settlement as posted
  await query(
    'UPDATE pos_settlements SET is_posted = true, posted_at = NOW() WHERE id = $1',
    [settlementId]
  );
  
  return { settlement: s, journal_entry_id: entry.id };
}

/**
 * Generate a daily summary from imported transactions
 */
async function generateDailySummary(posConfigId, date) {
  const result = await query(
    `SELECT
       COUNT(*) as transaction_count,
       SUM(CASE WHEN transaction_type = 'sale' THEN total_amount ELSE 0 END) as total_sales,
       SUM(CASE WHEN transaction_type = 'refund' THEN total_amount ELSE 0 END) as total_refunds,
       SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END) as cash_sales,
       SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END) as card_sales,
       SUM(CASE WHEN payment_method = 'gift_card' THEN total_amount ELSE 0 END) as gift_card_sales,
       SUM(CASE WHEN payment_method NOT IN ('cash', 'card', 'gift_card') THEN total_amount ELSE 0 END) as other_sales,
       SUM(tax_amount) as total_tax,
       SUM(tip_amount) as total_tips,
       SUM(discount_amount) as total_discounts
     FROM pos_transactions
     WHERE pos_config_id = $1 AND DATE(transaction_date) = $2`,
    [posConfigId, date]
  );
  
  const row = result.rows[0];
  
  return {
    pos_config_id: posConfigId,
    settlement_date: date,
    transaction_count: parseInt(row.transaction_count) || 0,
    total_sales: parseFloat(row.total_sales) || 0,
    total_refunds: parseFloat(row.total_refunds) || 0,
    cash_sales: parseFloat(row.cash_sales) || 0,
    card_sales: parseFloat(row.card_sales) || 0,
    gift_card_sales: parseFloat(row.gift_card_sales) || 0,
    other_sales: parseFloat(row.other_sales) || 0,
    total_tax: parseFloat(row.total_tax) || 0,
    total_tips: parseFloat(row.total_tips) || 0,
    total_discounts: parseFloat(row.total_discounts) || 0,
    net_sales: (parseFloat(row.total_sales) || 0) - (parseFloat(row.total_refunds) || 0) - (parseFloat(row.total_discounts) || 0),
  };
}

/**
 * Sync menu items to POS (for mapping)
 */
async function syncMenuItems(posConfigId) {
  // Get menu items without POS mapping
  const result = await query(
    `SELECT m.id, m.name, m.selling_price
     FROM menu_items m
     LEFT JOIN pos_menu_mappings p ON p.menu_item_id = m.id AND p.pos_config_id = $1
     WHERE p.id IS NULL`,
    [posConfigId]
  );
  
  return {
    unmapped_items: result.rows,
    count: result.rows.length
  };
}

/**
 * Map a menu item to a POS external ID
 */
async function createMenuMapping(posConfigId, menuItemId, externalId, externalName) {
  // Check if menu item exists
  const menuItem = await query('SELECT id FROM menu_items WHERE id = $1', [menuItemId]);
  if (!menuItem.rows.length) {
    throw new NotFoundError('Menu item not found');
  }
  
  // Check for duplicate mapping
  const existing = await query(
    'SELECT id FROM pos_menu_mappings WHERE pos_config_id = $1 AND menu_item_id = $2',
    [posConfigId, menuItemId]
  );
  
  if (existing.rows.length) {
    // Update existing
    const result = await query(
      `UPDATE pos_menu_mappings SET external_id = $1, external_name = $2, updated_at = NOW()
       WHERE pos_config_id = $3 AND menu_item_id = $4
       RETURNING *`,
      [externalId, externalName, posConfigId, menuItemId]
    );
    return result.rows[0];
  }
  
  // Create new mapping
  const result = await query(
    `INSERT INTO pos_menu_mappings (pos_config_id, menu_item_id, external_id, external_name)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [posConfigId, menuItemId, externalId, externalName]
  );
  
  return result.rows[0];
}

/**
 * Get menu mappings for a POS config
 */
async function getMenuMappings(posConfigId) {
  const result = await query(
    `SELECT p.*, m.name as menu_item_name, m.selling_price
     FROM pos_menu_mappings p
     JOIN menu_items m ON m.id = p.menu_item_id
     WHERE p.pos_config_id = $1
     ORDER BY m.name`,
    [posConfigId]
  );
  return result.rows;
}

module.exports = {
  createPosConfig,
  getPosConfigs,
  getPosConfigById,
  updatePosConfig,
  deletePosConfig,
  importTransaction,
  batchImportTransactions,
  getTransactions,
  getTransactionById,
  importSettlement,
  getSettlements,
  postSettlementToGL,
  generateDailySummary,
  syncMenuItems,
  createMenuMapping,
  getMenuMappings,
};

