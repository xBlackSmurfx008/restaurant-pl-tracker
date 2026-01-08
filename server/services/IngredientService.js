/**
 * Ingredient Service - Business logic for ingredients
 */
const { serviceLogger } = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');
const { suggestConversion, UNIT_CONVERSIONS } = require('../utils/calculations');

class IngredientService {
  /**
   * @param {import('../repositories/IngredientRepository')} ingredientRepo
   */
  constructor(ingredientRepo) {
    this.ingredientRepo = ingredientRepo;
    this.logger = serviceLogger.child({ service: 'ingredient' });
  }

  /**
   * Get all ingredients with vendor info
   */
  async getAll() {
    return this.ingredientRepo.findAllWithVendor();
  }

  /**
   * Get ingredient by ID
   * @param {number} id
   */
  async getById(id) {
    const ingredient = await this.ingredientRepo.findByIdWithVendor(id);
    if (!ingredient) {
      throw new NotFoundError('Ingredient');
    }
    return ingredient;
  }

  /**
   * Create a new ingredient
   * @param {Object} data
   */
  async create(data) {
    const ingredient = await this.ingredientRepo.create(data);
    this.logger.info({ ingredientId: ingredient.id, name: ingredient.name }, 'Ingredient created');
    return this.ingredientRepo.findByIdWithVendor(ingredient.id);
  }

  /**
   * Update an ingredient
   * @param {number} id
   * @param {Object} data
   */
  async update(id, data) {
    await this.getById(id);

    // If price is being updated, reset last_price_update
    if (data.purchase_price !== undefined) {
      data.last_price_update = new Date().toISOString().split('T')[0];
    }

    await this.ingredientRepo.update(id, data);
    this.logger.info({ ingredientId: id }, 'Ingredient updated');
    return this.ingredientRepo.findByIdWithVendor(id);
  }

  /**
   * Delete an ingredient
   * @param {number} id
   */
  async delete(id) {
    await this.ingredientRepo.deleteOrFail(id, 'Ingredient');
    this.logger.info({ ingredientId: id }, 'Ingredient deleted');
  }

  /**
   * Get ingredients with stale prices (price watch alerts)
   * @param {number} days
   */
  async getPriceWatchAlerts(days = 30) {
    const staleIngredients = await this.ingredientRepo.findStaleIngredients(days);
    return {
      count: staleIngredients.length,
      threshold_days: days,
      ingredients: staleIngredients,
    };
  }

  /**
   * Suggest unit conversion factor
   * @param {string} purchaseUnit
   * @param {string} usageUnit
   */
  suggestConversion(purchaseUnit, usageUnit) {
    const factor = suggestConversion(purchaseUnit, usageUnit);
    return {
      from_unit: purchaseUnit,
      to_unit: usageUnit,
      suggested_factor: factor,
      found: factor !== null,
    };
  }

  /**
   * Get available unit conversions
   */
  getUnitConversions() {
    return UNIT_CONVERSIONS;
  }
}

module.exports = IngredientService;

