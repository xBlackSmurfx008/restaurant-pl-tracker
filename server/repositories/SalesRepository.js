/**
 * Sales Repository
 */
const BaseRepository = require('./BaseRepository');

class SalesRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'sales_log');
  }

  /**
   * Find sales with menu item info
   * @param {Object} filters
   */
  async findWithMenuItems(filters = {}) {
    const { startDate, endDate } = filters;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`s.date >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`s.date <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.query(`
      SELECT 
        s.*,
        m.name as menu_item_name,
        m.selling_price
      FROM sales_log s
      JOIN menu_items m ON s.menu_item_id = m.id
      ${whereClause}
      ORDER BY s.date DESC, m.name
    `, params);
    return result.rows;
  }

  /**
   * Find sales for specific date
   * @param {string} date
   */
  async findByDate(date) {
    const result = await this.query(`
      SELECT 
        s.*,
        m.name as menu_item_name,
        m.selling_price
      FROM sales_log s
      JOIN menu_items m ON s.menu_item_id = m.id
      WHERE s.date = $1
      ORDER BY m.name
    `, [date]);
    return result.rows;
  }

  /**
   * Save or update sales record (upsert)
   * @param {string} date
   * @param {number} menuItemId
   * @param {number} quantitySold
   */
  async upsert(date, menuItemId, quantitySold) {
    if (quantitySold <= 0) {
      await this.query(
        'DELETE FROM sales_log WHERE date = $1 AND menu_item_id = $2',
        [date, menuItemId]
      );
      return null;
    }

    const result = await this.query(`
      INSERT INTO sales_log (date, menu_item_id, quantity_sold)
      VALUES ($1, $2, $3)
      ON CONFLICT (date, menu_item_id)
      DO UPDATE SET quantity_sold = EXCLUDED.quantity_sold
      RETURNING *
    `, [date, menuItemId, quantitySold]);
    return result.rows[0];
  }

  /**
   * Add to existing quantity
   * @param {string} date
   * @param {number} menuItemId
   * @param {number} quantity
   */
  async addQuantity(date, menuItemId, quantity) {
    const result = await this.query(`
      INSERT INTO sales_log (date, menu_item_id, quantity_sold)
      VALUES ($1, $2, $3)
      ON CONFLICT (date, menu_item_id)
      DO UPDATE SET quantity_sold = sales_log.quantity_sold + EXCLUDED.quantity_sold
      RETURNING *
    `, [date, menuItemId, quantity]);
    return result.rows[0];
  }

  /**
   * Get sales with calculated costs for analytics
   * Optimized to avoid N+1 queries
   * @param {string} dateFilter - SQL date filter condition
   * @param {Array} params - Query parameters
   */
  async findSalesWithCosts(dateFilter, params = []) {
    const result = await this.query(`
      SELECT 
        s.id,
        s.date,
        s.quantity_sold,
        m.id as menu_item_id,
        m.name as menu_item_name,
        m.selling_price,
        m.q_factor,
        m.estimated_prep_time_minutes,
        COALESCE(
          (SELECT SUM(rm.quantity_used * (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)))
           FROM recipe_map rm
           JOIN ingredients i ON rm.ingredient_id = i.id
           WHERE rm.menu_item_id = m.id), 0
        ) as ingredient_cost
      FROM sales_log s
      JOIN menu_items m ON s.menu_item_id = m.id
      WHERE ${dateFilter}
      ORDER BY s.date DESC, m.name
    `, params);
    return result.rows;
  }

  /**
   * Get date filter SQL for period
   * @param {string} period
   * @returns {{ sql: string, params: Array }}
   */
  getDateFilter(period) {
    const now = new Date();
    
    switch (period) {
      case 'today':
        return { sql: 's.date = CURRENT_DATE', params: [] };
      case 'week':
        return { sql: "s.date >= CURRENT_DATE - INTERVAL '7 days'", params: [] };
      case 'month':
        return { sql: "s.date >= DATE_TRUNC('month', CURRENT_DATE)::DATE", params: [] };
      case 'quarter': {
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        return { sql: 's.date >= $1', params: [quarterStart.toISOString().split('T')[0]] };
      }
      case 'year':
        return { 
          sql: "s.date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')::DATE AND s.date < DATE_TRUNC('year', CURRENT_DATE)::DATE",
          params: [] 
        };
      case 'ytd':
        return { sql: "s.date >= DATE_TRUNC('year', CURRENT_DATE)::DATE", params: [] };
      default:
        return { sql: "s.date >= CURRENT_DATE - INTERVAL '30 days'", params: [] };
    }
  }
}

module.exports = SalesRepository;

