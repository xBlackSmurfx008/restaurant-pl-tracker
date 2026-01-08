/**
 * Vendor Repository
 */
const BaseRepository = require('./BaseRepository');

class VendorRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'vendors');
  }

  /**
   * Find all vendors ordered by name
   */
  async findAll() {
    const result = await this.query(
      'SELECT * FROM vendors ORDER BY name'
    );
    return result.rows;
  }

  /**
   * Find vendor by name
   * @param {string} name
   */
  async findByName(name) {
    return this.findOneBy({ name });
  }

  /**
   * Get vendor with expense totals
   * @param {number} id
   */
  async findWithExpenseTotals(id) {
    const result = await this.query(`
      SELECT 
        v.*,
        COUNT(e.id) as expense_count,
        COALESCE(SUM(e.amount), 0) as total_spent
      FROM vendors v
      LEFT JOIN expenses e ON v.id = e.vendor_id
      WHERE v.id = $1
      GROUP BY v.id
    `, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get vendors needing 1099 (total payments >= threshold)
   * @param {string} startDate
   * @param {string} endDate
   * @param {number} threshold
   */
  async findVendorsFor1099(startDate, endDate, threshold = 600) {
    const result = await this.query(`
      SELECT 
        v.id,
        v.name,
        v.email,
        v.phone,
        SUM(e.amount) as total_paid,
        COUNT(e.id) as payment_count,
        STRING_AGG(DISTINCT e.payment_method, ', ') as payment_methods
      FROM vendors v
      JOIN expenses e ON v.id = e.vendor_id
      WHERE e.expense_date BETWEEN $1 AND $2
      GROUP BY v.id, v.name, v.email, v.phone
      HAVING SUM(e.amount) >= $3
      ORDER BY total_paid DESC
    `, [startDate, endDate, threshold]);
    return result.rows;
  }
}

module.exports = VendorRepository;

