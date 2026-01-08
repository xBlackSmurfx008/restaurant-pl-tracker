/**
 * Ingredient Repository
 */
const BaseRepository = require('./BaseRepository');

class IngredientRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'ingredients');
  }

  /**
   * Find all ingredients with vendor info
   */
  async findAllWithVendor() {
    const result = await this.query(`
      SELECT 
        i.*,
        v.name as vendor_name,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_usage_unit
      FROM ingredients i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      ORDER BY i.name
    `);
    return result.rows;
  }

  /**
   * Find ingredient by ID with vendor info
   * @param {number} id
   */
  async findByIdWithVendor(id) {
    const result = await this.query(`
      SELECT 
        i.*,
        v.name as vendor_name,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_usage_unit
      FROM ingredients i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.id = $1
    `, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get ingredients with stale prices
   * @param {number} days - Days since last update
   */
  async findStaleIngredients(days = 30) {
    const result = await this.query(`
      SELECT 
        i.*,
        v.name as vendor_name,
        (CURRENT_DATE - i.last_price_update) as days_since_update
      FROM ingredients i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.last_price_update < CURRENT_DATE - ($1::integer * INTERVAL '1 day')
      ORDER BY days_since_update DESC
    `, [days]);
    return result.rows;
  }

  /**
   * Update price and reset last_price_update
   * @param {number} id
   * @param {number} newPrice
   */
  async updatePrice(id, newPrice) {
    const result = await this.query(`
      UPDATE ingredients 
      SET purchase_price = $1, last_price_update = CURRENT_DATE
      WHERE id = $2
      RETURNING *
    `, [newPrice, id]);
    return result.rows[0] || null;
  }

  /**
   * Find ingredients by vendor
   * @param {number} vendorId
   */
  async findByVendor(vendorId) {
    const result = await this.query(`
      SELECT 
        i.*,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_usage_unit
      FROM ingredients i
      WHERE i.vendor_id = $1
      ORDER BY i.name
    `, [vendorId]);
    return result.rows;
  }
}

module.exports = IngredientRepository;

