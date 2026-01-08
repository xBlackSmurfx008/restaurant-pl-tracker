/**
 * Menu Item Service - Business logic for menu items and recipes
 */
const { serviceLogger } = require('../utils/logger');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { calculateProfitability, calculateLaborCost } = require('../utils/calculations');

class MenuItemService {
  /**
   * @param {import('../repositories/MenuItemRepository')} menuItemRepo
   * @param {import('../repositories/IngredientRepository')} ingredientRepo
   */
  constructor(menuItemRepo, ingredientRepo) {
    this.menuItemRepo = menuItemRepo;
    this.ingredientRepo = ingredientRepo;
    this.logger = serviceLogger.child({ service: 'menuItem' });
  }

  /**
   * Get all menu items with costs
   */
  async getAll() {
    const items = await this.menuItemRepo.findAllWithCosts();
    return items.map((item) => this.enrichWithProfitability(item));
  }

  /**
   * Get menu item by ID with full recipe
   * @param {number} id
   */
  async getById(id) {
    const item = await this.menuItemRepo.findByIdWithRecipe(id);
    if (!item) {
      throw new NotFoundError('Menu Item');
    }
    return this.enrichWithProfitability(item);
  }

  /**
   * Create a new menu item
   * @param {Object} data
   */
  async create(data) {
    const existing = await this.menuItemRepo.findOneBy({ name: data.name });
    if (existing) {
      throw new ConflictError(`Menu item "${data.name}" already exists`);
    }

    const item = await this.menuItemRepo.create(data);
    this.logger.info({ menuItemId: item.id, name: item.name }, 'Menu item created');
    return item;
  }

  /**
   * Update a menu item
   * @param {number} id
   * @param {Object} data
   */
  async update(id, data) {
    const existing = await this.menuItemRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Menu Item');
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await this.menuItemRepo.findOneBy({ name: data.name });
      if (duplicate) {
        throw new ConflictError(`Menu item "${data.name}" already exists`);
      }
    }

    const item = await this.menuItemRepo.update(id, data);
    this.logger.info({ menuItemId: id }, 'Menu item updated');
    return item;
  }

  /**
   * Delete a menu item
   * @param {number} id
   */
  async delete(id) {
    await this.menuItemRepo.deleteOrFail(id, 'Menu Item');
    this.logger.info({ menuItemId: id }, 'Menu item deleted');
  }

  /**
   * Add ingredient to recipe
   * @param {number} menuItemId
   * @param {number} ingredientId
   * @param {number} quantityUsed
   */
  async addRecipeIngredient(menuItemId, ingredientId, quantityUsed) {
    // Verify menu item exists
    const menuItem = await this.menuItemRepo.findById(menuItemId);
    if (!menuItem) {
      throw new NotFoundError('Menu Item');
    }

    // Verify ingredient exists
    const ingredient = await this.ingredientRepo.findById(ingredientId);
    if (!ingredient) {
      throw new NotFoundError('Ingredient');
    }

    await this.menuItemRepo.addRecipeIngredient(menuItemId, ingredientId, quantityUsed);
    this.logger.info({ menuItemId, ingredientId }, 'Recipe ingredient added');

    // Return updated menu item with recipe
    return this.getById(menuItemId);
  }

  /**
   * Remove ingredient from recipe
   * @param {number} menuItemId
   * @param {number} recipeId
   */
  async removeRecipeIngredient(menuItemId, recipeId) {
    const removed = await this.menuItemRepo.removeRecipeIngredient(menuItemId, recipeId);
    if (!removed) {
      throw new NotFoundError('Recipe ingredient');
    }
    this.logger.info({ menuItemId, recipeId }, 'Recipe ingredient removed');
    return this.getById(menuItemId);
  }

  /**
   * Enrich menu item with profitability calculations
   * @param {Object} item
   */
  enrichWithProfitability(item) {
    const plateCost = parseFloat(item.plate_cost || item.ingredient_cost || 0) + parseFloat(item.q_factor || 0);
    const laborCost = calculateLaborCost(item.estimated_prep_time_minutes || 0);
    const profitability = calculateProfitability(item.selling_price, plateCost, laborCost);

    return {
      ...item,
      plate_cost: plateCost,
      labor_cost: laborCost,
      ...profitability,
    };
  }
}

module.exports = MenuItemService;

