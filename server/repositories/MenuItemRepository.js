/**
 * Menu Item Repository
 */
const BaseRepository = require('./BaseRepository');

class MenuItemRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'menu_items');
  }

  /**
   * Find all menu items with calculated plate costs
   */
  async findAllWithCosts() {
    const result = await this.query(`
      SELECT 
        m.*,
        COALESCE(
          (SELECT SUM(rm.quantity_used * (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)))
           FROM recipe_map rm
           JOIN ingredients i ON rm.ingredient_id = i.id
           WHERE rm.menu_item_id = m.id), 0
        ) as ingredient_cost,
        COALESCE(
          (SELECT SUM(rm.quantity_used * (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)))
           FROM recipe_map rm
           JOIN ingredients i ON rm.ingredient_id = i.id
           WHERE rm.menu_item_id = m.id), 0
        ) + m.q_factor as plate_cost,
        COALESCE(
          (SELECT COUNT(*) FROM recipe_map WHERE menu_item_id = m.id), 0
        ) as ingredient_count
      FROM menu_items m
      ORDER BY m.name
    `);
    return result.rows;
  }

  /**
   * Find menu item by ID with full recipe
   * @param {number} id
   */
  async findByIdWithRecipe(id) {
    const menuItem = await this.findById(id);
    if (!menuItem) {return null;}

    const recipeResult = await this.query(`
      SELECT 
        rm.id as recipe_id,
        rm.quantity_used,
        i.id as ingredient_id,
        i.name as ingredient_name,
        i.purchase_price,
        i.purchase_unit,
        i.usage_unit,
        i.unit_conversion_factor,
        i.yield_percent,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_unit,
        (rm.quantity_used * (i.purchase_price / (i.unit_conversion_factor * i.yield_percent))) as line_cost
      FROM recipe_map rm
      JOIN ingredients i ON rm.ingredient_id = i.id
      WHERE rm.menu_item_id = $1
      ORDER BY i.name
    `, [id]);

    return {
      ...menuItem,
      recipe: recipeResult.rows,
    };
  }

  /**
   * Add ingredient to recipe
   * @param {number} menuItemId
   * @param {number} ingredientId
   * @param {number} quantityUsed
   */
  async addRecipeIngredient(menuItemId, ingredientId, quantityUsed) {
    const result = await this.query(`
      INSERT INTO recipe_map (menu_item_id, ingredient_id, quantity_used)
      VALUES ($1, $2, $3)
      ON CONFLICT (menu_item_id, ingredient_id) 
      DO UPDATE SET quantity_used = EXCLUDED.quantity_used
      RETURNING *
    `, [menuItemId, ingredientId, quantityUsed]);
    return result.rows[0];
  }

  /**
   * Remove ingredient from recipe
   * @param {number} menuItemId
   * @param {number} recipeId
   */
  async removeRecipeIngredient(menuItemId, recipeId) {
    const result = await this.query(`
      DELETE FROM recipe_map 
      WHERE id = $1 AND menu_item_id = $2
    `, [recipeId, menuItemId]);
    return result.rowCount > 0;
  }

  /**
   * Calculate plate cost for a menu item
   * @param {number} id
   */
  async calculatePlateCost(id) {
    const result = await this.query(`
      SELECT 
        COALESCE(SUM(rm.quantity_used * (i.purchase_price / (i.unit_conversion_factor * i.yield_percent))), 0) as ingredient_cost,
        m.q_factor
      FROM menu_items m
      LEFT JOIN recipe_map rm ON m.id = rm.menu_item_id
      LEFT JOIN ingredients i ON rm.ingredient_id = i.id
      WHERE m.id = $1
      GROUP BY m.id, m.q_factor
    `, [id]);
    
    if (!result.rows[0]) {return 0;}
    return parseFloat(result.rows[0].ingredient_cost) + parseFloat(result.rows[0].q_factor || 0);
  }
}

module.exports = MenuItemRepository;

