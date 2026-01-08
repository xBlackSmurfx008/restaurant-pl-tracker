/**
 * POS Integration routes
 * Vendor-agnostic endpoints for POS configuration, transaction import, and settlements
 */
const router = require('express').Router();
const { validateBody, validateQuery, validateParams } = require('../middleware/validate');
const { idParamSchema } = require('../schemas/common');
const {
  createPosConfigSchema,
  updatePosConfigSchema,
  batchImportSchema,
  importSettlementSchema,
  transactionQuerySchema,
  settlementQuerySchema,
} = require('../schemas/pos.schema');
const PosService = require('../services/PosService');

// ============================================
// POS CONFIGURATION ROUTES
// ============================================

/**
 * Create a new POS configuration
 */
router.post('/configs', validateBody(createPosConfigSchema), async (req, res, next) => {
  try {
    const config = await PosService.createPosConfig(req.body);
    res.status(201).json(config);
  } catch (err) {
    next(err);
  }
});

/**
 * Get all POS configurations
 */
router.get('/configs', async (req, res, next) => {
  try {
    const configs = await PosService.getPosConfigs();
    res.json(configs);
  } catch (err) {
    next(err);
  }
});

/**
 * Get POS configuration by ID
 */
router.get('/configs/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const config = await PosService.getPosConfigById(req.params.id);
    res.json(config);
  } catch (err) {
    next(err);
  }
});

/**
 * Update POS configuration
 */
router.put('/configs/:id', validateParams(idParamSchema), validateBody(updatePosConfigSchema), async (req, res, next) => {
  try {
    const config = await PosService.updatePosConfig(req.params.id, req.body);
    res.json(config);
  } catch (err) {
    next(err);
  }
});

/**
 * Delete POS configuration
 */
router.delete('/configs/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const result = await PosService.deletePosConfig(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================
// TRANSACTION IMPORT ROUTES
// ============================================

/**
 * Import a batch of transactions from POS
 */
router.post('/transactions/import', validateBody(batchImportSchema), async (req, res, next) => {
  try {
    const { pos_config_id, transactions } = req.body;
    const result = await PosService.batchImportTransactions(pos_config_id, transactions);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Get transactions with filters
 */
router.get('/transactions', validateQuery(transactionQuerySchema), async (req, res, next) => {
  try {
    const transactions = await PosService.getTransactions(req.query);
    res.json(transactions);
  } catch (err) {
    next(err);
  }
});

/**
 * Get transaction by ID
 */
router.get('/transactions/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const transaction = await PosService.getTransactionById(req.params.id);
    res.json(transaction);
  } catch (err) {
    next(err);
  }
});

// ============================================
// SETTLEMENT ROUTES
// ============================================

/**
 * Import a settlement record (daily closeout)
 */
router.post('/settlements', validateBody(importSettlementSchema), async (req, res, next) => {
  try {
    const settlement = await PosService.importSettlement(req.body);
    res.status(201).json(settlement);
  } catch (err) {
    next(err);
  }
});

/**
 * Get settlements with filters
 */
router.get('/settlements', validateQuery(settlementQuerySchema), async (req, res, next) => {
  try {
    const settlements = await PosService.getSettlements(req.query);
    res.json(settlements);
  } catch (err) {
    next(err);
  }
});

/**
 * Post settlement to GL (creates journal entry for daily sales)
 */
router.post('/settlements/:id/post', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const result = await PosService.postSettlementToGL(req.params.id, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Generate a daily summary from imported transactions
 */
router.get('/summary/:pos_config_id/:date', async (req, res, next) => {
  try {
    const { pos_config_id, date } = req.params;
    const summary = await PosService.generateDailySummary(pos_config_id, date);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// ============================================
// MENU MAPPING ROUTES
// ============================================

/**
 * Get unmapped menu items for a POS config
 */
router.get('/configs/:id/unmapped-items', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const result = await PosService.syncMenuItems(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Get menu mappings for a POS config
 */
router.get('/configs/:id/mappings', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const mappings = await PosService.getMenuMappings(req.params.id);
    res.json(mappings);
  } catch (err) {
    next(err);
  }
});

/**
 * Create or update a menu item mapping
 */
router.post('/configs/:id/mappings', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const { menu_item_id, external_id, external_name } = req.body;
    const mapping = await PosService.createMenuMapping(req.params.id, menu_item_id, external_id, external_name);
    res.status(201).json(mapping);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

