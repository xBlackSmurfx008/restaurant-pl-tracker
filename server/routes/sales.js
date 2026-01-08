/**
 * Sales Routes - Thin controller layer
 */
const express = require('express');
const router = express.Router();

const { pool } = require('../db');
const { SalesRepository, MenuItemRepository } = require('../repositories');
const { SalesService } = require('../services');
const { asyncHandler } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  createSalesRecordSchema,
  updateSalesRecordSchema,
  dailySalesSchema,
  addSalesSchema,
  salesQuerySchema,
} = require('../schemas/sales.schema');

// Initialize service
const salesRepo = new SalesRepository(pool);
const menuItemRepo = new MenuItemRepository(pool);
const salesService = new SalesService(salesRepo, menuItemRepo);

/**
 * GET /api/sales
 * Get sales with optional date filters
 */
router.get(
  '/',
  validateQuery(salesQuerySchema),
  asyncHandler(async (req, res) => {
    const filters = {
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    };
    const sales = await salesService.getAll(filters);
    res.json(sales);
  })
);

/**
 * GET /api/sales/analytics
 * Get dashboard analytics for a period
 */
router.get(
  '/analytics',
  validateQuery(salesQuerySchema),
  asyncHandler(async (req, res) => {
    const analytics = await salesService.getAnalytics(req.query.period);
    res.json(analytics);
  })
);

/**
 * GET /api/sales/date/:date
 * Get sales for a specific date
 */
router.get(
  '/date/:date',
  asyncHandler(async (req, res) => {
    const sales = await salesService.getByDate(req.params.date);
    res.json(sales);
  })
);

/**
 * POST /api/sales/daily
 * Save daily sales (bulk)
 */
router.post(
  '/daily',
  validateBody(dailySalesSchema),
  asyncHandler(async (req, res) => {
    const result = await salesService.saveDailySales(req.body.date, req.body.sales);
    res.status(201).json({
      message: 'Sales saved successfully',
      ...result,
    });
  })
);

/**
 * POST /api/sales
 * Create or update single sales record
 */
router.post(
  '/',
  validateBody(createSalesRecordSchema),
  asyncHandler(async (req, res) => {
    const sale = await salesService.upsertSale(req.body);
    res.status(201).json(sale);
  })
);

/**
 * POST /api/sales/add
 * Add to existing sales quantity
 */
router.post(
  '/add',
  validateBody(addSalesSchema),
  asyncHandler(async (req, res) => {
    const sale = await salesService.addSale(req.body);
    res.status(201).json(sale);
  })
);

/**
 * PUT /api/sales/:id
 * Update a sales record
 */
router.put(
  '/:id',
  validateId,
  validateBody(updateSalesRecordSchema),
  asyncHandler(async (req, res) => {
    const sale = await salesService.update(req.params.id, req.body.quantity_sold);
    res.json(sale);
  })
);

/**
 * DELETE /api/sales/:id
 * Delete a sales record
 */
router.delete(
  '/:id',
  validateId,
  asyncHandler(async (req, res) => {
    await salesService.delete(req.params.id);
    res.json({ message: 'Sales record deleted successfully' });
  })
);

module.exports = router;
