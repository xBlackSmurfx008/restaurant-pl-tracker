/**
 * Ingredient Routes - Thin controller layer
 */
const express = require('express');
const router = express.Router();

const { pool } = require('../db');
const { IngredientRepository } = require('../repositories');
const { IngredientService } = require('../services');
const { asyncHandler } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  createIngredientSchema,
  updateIngredientSchema,
  suggestConversionSchema,
} = require('../schemas/ingredient.schema');
const { z } = require('zod');

// Initialize service
const ingredientRepo = new IngredientRepository(pool);
const ingredientService = new IngredientService(ingredientRepo);

// Query schema for price watch alerts
const priceWatchQuerySchema = z.object({
  days: z.coerce.number().int().positive().default(30),
});

/**
 * GET /api/ingredients
 * Get all ingredients
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const ingredients = await ingredientService.getAll();
    res.json(ingredients);
  })
);

/**
 * GET /api/ingredients/alerts/price-watch
 * Get price watch alerts (stale prices)
 */
router.get(
  '/alerts/price-watch',
  validateQuery(priceWatchQuerySchema),
  asyncHandler(async (req, res) => {
    const alerts = await ingredientService.getPriceWatchAlerts(req.query.days);
    res.json(alerts);
  })
);

/**
 * POST /api/ingredients/suggest-conversion
 * Suggest unit conversion factor
 */
router.post(
  '/suggest-conversion',
  validateBody(suggestConversionSchema),
  asyncHandler(async (req, res) => {
    const result = ingredientService.suggestConversion(req.body.purchase_unit, req.body.usage_unit);
    res.json(result);
  })
);

/**
 * GET /api/ingredients/conversions
 * Get available unit conversions
 */
router.get(
  '/conversions',
  asyncHandler(async (req, res) => {
    const conversions = ingredientService.getUnitConversions();
    res.json(conversions);
  })
);

/**
 * GET /api/ingredients/:id
 * Get ingredient by ID
 */
router.get(
  '/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const ingredient = await ingredientService.getById(req.params.id);
    res.json(ingredient);
  })
);

/**
 * POST /api/ingredients
 * Create a new ingredient
 */
router.post(
  '/',
  validateBody(createIngredientSchema),
  asyncHandler(async (req, res) => {
    const ingredient = await ingredientService.create(req.body);
    res.status(201).json(ingredient);
  })
);

/**
 * PUT /api/ingredients/:id
 * Update an ingredient
 */
router.put(
  '/:id',
  validateId,
  validateBody(updateIngredientSchema),
  asyncHandler(async (req, res) => {
    const ingredient = await ingredientService.update(req.params.id, req.body);
    res.json(ingredient);
  })
);

/**
 * DELETE /api/ingredients/:id
 * Delete an ingredient
 */
router.delete(
  '/:id',
  validateId,
  asyncHandler(async (req, res) => {
    await ingredientService.delete(req.params.id);
    res.json({ success: true, message: 'Ingredient deleted successfully' });
  })
);

module.exports = router;
