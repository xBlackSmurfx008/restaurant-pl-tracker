/**
 * Expense Repository
 */
const BaseRepository = require('./BaseRepository');

class ExpenseRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'expenses');
  }

  /**
   * Find expenses with related data
   * @param {Object} filters
   */
  async findWithRelations(filters = {}) {
    const { start, end, vendorId, categoryId, paymentMethod } = filters;
    const conditions = ['1=1'];
    const params = [];
    let paramIndex = 1;

    if (start) {
      conditions.push(`e.expense_date >= $${paramIndex++}`);
      params.push(start);
    }
    if (end) {
      conditions.push(`e.expense_date <= $${paramIndex++}`);
      params.push(end);
    }
    if (vendorId) {
      conditions.push(`e.vendor_id = $${paramIndex++}`);
      params.push(vendorId);
    }
    if (categoryId) {
      conditions.push(`e.category_id = $${paramIndex++}`);
      params.push(categoryId);
    }
    if (paymentMethod) {
      conditions.push(`e.payment_method = $${paramIndex++}`);
      params.push(paymentMethod);
    }

    const result = await this.query(`
      SELECT 
        e.*,
        v.name as vendor_name,
        ec.name as category_name,
        ec.expense_type,
        (SELECT COUNT(*) FROM expense_documents ed WHERE ed.expense_id = e.id) as document_count,
        (SELECT COUNT(*) FROM expense_line_items eli WHERE eli.expense_id = e.id) as line_item_count
      FROM expenses e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.expense_date DESC, e.id DESC
    `, params);
    return result.rows;
  }

  /**
   * Find expense by ID with full details
   * @param {number} id
   */
  async findByIdWithDetails(id) {
    const expense = await this.query(`
      SELECT 
        e.*,
        v.name as vendor_name,
        ec.name as category_name,
        ec.expense_type
      FROM expenses e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.id = $1
    `, [id]);

    if (!expense.rows[0]) return null;

    const lineItems = await this.query(`
      SELECT 
        eli.*,
        i.name as ingredient_name,
        ec.name as mapped_category_name
      FROM expense_line_items eli
      LEFT JOIN ingredients i ON eli.mapped_ingredient_id = i.id
      LEFT JOIN expense_categories ec ON eli.mapped_category_id = ec.id
      WHERE eli.expense_id = $1
      ORDER BY eli.line_number, eli.id
    `, [id]);

    const documents = await this.query(`
      SELECT d.*
      FROM documents d
      JOIN expense_documents ed ON d.id = ed.document_id
      WHERE ed.expense_id = $1
      ORDER BY d.created_at DESC
    `, [id]);

    return {
      ...expense.rows[0],
      line_items: lineItems.rows,
      documents: documents.rows,
    };
  }

  /**
   * Get expense summary by grouping
   * @param {Object} options
   */
  async getSummary(options = {}) {
    const { startDate, endDate, groupBy = 'category' } = options;
    const conditions = ['1=1'];
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`e.expense_date >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`e.expense_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    let groupQuery;
    switch (groupBy) {
      case 'type':
        groupQuery = `
          SELECT 
            ec.expense_type as group_key,
            COUNT(e.id) as expense_count,
            SUM(e.amount) as total_amount
          FROM expenses e
          JOIN expense_categories ec ON e.category_id = ec.id
          WHERE ${conditions.join(' AND ')}
          GROUP BY ec.expense_type
          ORDER BY total_amount DESC
        `;
        break;
      case 'vendor':
        groupQuery = `
          SELECT 
            COALESCE(v.name, 'No Vendor') as group_key,
            COUNT(e.id) as expense_count,
            SUM(e.amount) as total_amount
          FROM expenses e
          LEFT JOIN vendors v ON e.vendor_id = v.id
          WHERE ${conditions.join(' AND ')}
          GROUP BY v.name
          ORDER BY total_amount DESC
        `;
        break;
      case 'month':
        groupQuery = `
          SELECT 
            TO_CHAR(e.expense_date, 'YYYY-MM') as group_key,
            COUNT(e.id) as expense_count,
            SUM(e.amount) as total_amount
          FROM expenses e
          WHERE ${conditions.join(' AND ')}
          GROUP BY TO_CHAR(e.expense_date, 'YYYY-MM')
          ORDER BY group_key DESC
        `;
        break;
      default:
        groupQuery = `
          SELECT 
            ec.name as group_key,
            ec.expense_type,
            COUNT(e.id) as expense_count,
            SUM(e.amount) as total_amount
          FROM expenses e
          JOIN expense_categories ec ON e.category_id = ec.id
          WHERE ${conditions.join(' AND ')}
          GROUP BY ec.name, ec.expense_type
          ORDER BY ec.expense_type, total_amount DESC
        `;
    }

    const result = await this.query(groupQuery, params);
    return result.rows;
  }

  /**
   * Get expenses by tax category for a year
   * @param {number} year
   */
  async findByTaxCategory(year) {
    const result = await this.query(`
      SELECT 
        ec.tax_category,
        ec.name as category_name,
        ec.is_tax_deductible,
        SUM(e.amount) as total_amount,
        COUNT(*) as transaction_count,
        MIN(e.expense_date) as first_expense,
        MAX(e.expense_date) as last_expense
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE EXTRACT(YEAR FROM e.expense_date) = $1 
        AND ec.is_tax_deductible = true
      GROUP BY ec.tax_category, ec.name, ec.is_tax_deductible
      ORDER BY ec.tax_category, total_amount DESC
    `, [year]);
    return result.rows;
  }
}

module.exports = ExpenseRepository;

