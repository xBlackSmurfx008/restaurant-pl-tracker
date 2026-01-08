/**
 * Menu Item Routes - Thin controller layer
 */
const express = require('express');
const router = express.Router();

const { pool } = require('../db');
const { MenuItemRepository, IngredientRepository } = require('../repositories');
const { MenuItemService } = require('../services');
const { asyncHandler } = require('../utils/errors');
const { validateBody, validateId, validateParams } = require('../middleware');
const {
  createMenuItemSchema,
  updateMenuItemSchema,
  addRecipeIngredientSchema,
} = require('../schemas/menuItem.schema');
const { z } = require('zod');

// Initialize service
const menuItemRepo = new MenuItemRepository(pool);
const ingredientRepo = new IngredientRepository(pool);
const menuItemService = new MenuItemService(menuItemRepo, ingredientRepo);

// Recipe route params schema
const recipeParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  recipeId: z.coerce.number().int().positive(),
});

/**
 * GET /api/menu-items
 * Get all menu items with costs
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await menuItemService.getAll();
    res.json(items);
  })
);

/**
 * GET /api/menu-items/:id
 * Get menu item by ID with full recipe
 */
router.get(
  '/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const item = await menuItemService.getById(req.params.id);
    res.json(item);
  })
);

/**
 * POST /api/menu-items
 * Create a new menu item
 */
router.post(
  '/',
  validateBody(createMenuItemSchema),
  asyncHandler(async (req, res) => {
    const item = await menuItemService.create(req.body);
    res.status(201).json(item);
  })
);

/**
 * PUT /api/menu-items/:id
 * Update a menu item
 */
router.put(
  '/:id',
  validateId,
  validateBody(updateMenuItemSchema),
  asyncHandler(async (req, res) => {
    const item = await menuItemService.update(req.params.id, req.body);
    res.json(item);
  })
);

/**
 * DELETE /api/menu-items/:id
 * Delete a menu item
 */
router.delete(
  '/:id',
  validateId,
  asyncHandler(async (req, res) => {
    await menuItemService.delete(req.params.id);
    res.json({ success: true, message: 'Menu item deleted successfully' });
  })
);

/**
 * POST /api/menu-items/:id/recipe
 * Add ingredient to recipe
 */
router.post(
  '/:id/recipe',
  validateId,
  validateBody(addRecipeIngredientSchema),
  asyncHandler(async (req, res) => {
    const item = await menuItemService.addRecipeIngredient(
      req.params.id,
      req.body.ingredient_id,
      req.body.quantity_used
    );
    res.status(201).json(item);
  })
);

/**
 * DELETE /api/menu-items/:id/recipe/:recipeId
 * Remove ingredient from recipe
 */
router.delete(
  '/:id/recipe/:recipeId',
  validateParams(recipeParamsSchema),
  asyncHandler(async (req, res) => {
    const item = await menuItemService.removeRecipeIngredient(req.params.id, req.params.recipeId);
    res.json(item);
  })
);

module.exports = router;
