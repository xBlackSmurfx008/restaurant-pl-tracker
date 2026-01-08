/**
 * Base Repository class with common database operations
 * All repositories extend this class
 */
const { dbLogger } = require('../utils/logger');
const { DatabaseError, NotFoundError } = require('../utils/errors');

class BaseRepository {
  /**
   * @param {import('pg').Pool} pool - PostgreSQL connection pool
   * @param {string} tableName - Name of the database table
   */
  constructor(pool, tableName) {
    this.pool = pool;
    this.tableName = tableName;
    this.logger = dbLogger.child({ repository: tableName });
  }

  /**
   * Execute a query with error handling
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<import('pg').QueryResult>}
   */
  async query(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result;
    } catch (error) {
      this.logger.error({ error: error.message, sql, params }, 'Query failed');
      throw new DatabaseError(error.message, error);
    }
  }

  /**
   * Find all records
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    const { orderBy = 'id', order = 'ASC', limit, offset } = options;
    
    let sql = `SELECT * FROM ${this.tableName} ORDER BY ${orderBy} ${order}`;
    const params = [];
    let paramIndex = 1;
    
    if (limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(limit);
    }
    if (offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(offset);
    }
    
    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * Find record by ID
   * @param {number} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const result = await this.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find record by ID or throw NotFoundError
   * @param {number} id - Record ID
   * @param {string} resourceName - Name for error message
   * @returns {Promise<Object>}
   */
  async findByIdOrFail(id, resourceName = this.tableName) {
    const record = await this.findById(id);
    if (!record) {
      throw new NotFoundError(resourceName);
    }
    return record;
  }

  /**
   * Find records by condition
   * @param {Object} conditions - Key-value pairs for WHERE clause
   * @returns {Promise<Array>}
   */
  async findBy(conditions) {
    const keys = Object.keys(conditions);
    if (keys.length === 0) {
      return this.findAll();
    }
    
    const whereClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = Object.values(conditions);
    
    const result = await this.query(
      `SELECT * FROM ${this.tableName} WHERE ${whereClauses.join(' AND ')}`,
      values
    );
    return result.rows;
  }

  /**
   * Find single record by condition
   * @param {Object} conditions - Key-value pairs for WHERE clause
   * @returns {Promise<Object|null>}
   */
  async findOneBy(conditions) {
    const records = await this.findBy(conditions);
    return records[0] || null;
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record
   */
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    
    const result = await this.query(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) 
       VALUES (${placeholders.join(', ')}) 
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Update a record by ID
   * @param {number} id - Record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object|null>} Updated record or null
   */
  async update(id, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return this.findById(id);
    }
    
    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(data), id];
    
    const result = await this.query(
      `UPDATE ${this.tableName} 
       SET ${setClauses.join(', ')} 
       WHERE id = $${keys.length + 1} 
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Update a record by ID or throw NotFoundError
   * @param {number} id - Record ID
   * @param {Object} data - Updated data
   * @param {string} resourceName - Name for error message
   * @returns {Promise<Object>}
   */
  async updateOrFail(id, data, resourceName = this.tableName) {
    const record = await this.update(id, data);
    if (!record) {
      throw new NotFoundError(resourceName);
    }
    return record;
  }

  /**
   * Delete a record by ID
   * @param {number} id - Record ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const result = await this.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Delete a record by ID or throw NotFoundError
   * @param {number} id - Record ID
   * @param {string} resourceName - Name for error message
   * @returns {Promise<void>}
   */
  async deleteOrFail(id, resourceName = this.tableName) {
    const deleted = await this.delete(id);
    if (!deleted) {
      throw new NotFoundError(resourceName);
    }
  }

  /**
   * Count records
   * @param {Object} conditions - Optional WHERE conditions
   * @returns {Promise<number>}
   */
  async count(conditions = {}) {
    const keys = Object.keys(conditions);
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const values = [];
    
    if (keys.length > 0) {
      const whereClauses = keys.map((key, i) => `${key} = $${i + 1}`);
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
      values.push(...Object.values(conditions));
    }
    
    const result = await this.query(sql, values);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check if record exists
   * @param {Object} conditions - WHERE conditions
   * @returns {Promise<boolean>}
   */
  async exists(conditions) {
    const count = await this.count(conditions);
    return count > 0;
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Async function receiving client
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = BaseRepository;

