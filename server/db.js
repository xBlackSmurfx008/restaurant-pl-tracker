/**
 * Database connection and pool management
 * Clean PostgreSQL implementation without legacy SQLite compatibility layer
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { database: dbConfig } = require('./config');
const { dbLogger } = require('./utils/logger');

// Create connection pool
const pool = new Pool(dbConfig);

// Connection event handlers
pool.on('connect', () => {
  dbLogger.debug('New client connected to pool');
});

pool.on('error', (err) => {
  dbLogger.error({ error: err.message }, 'Unexpected error on idle client');
});

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as time');
    dbLogger.info({ time: result.rows[0].time }, '✅ Database connection successful');
    return true;
  } catch (err) {
    dbLogger.error({ error: err.message }, '❌ Database connection failed');
    dbLogger.error('⚠️  The server will start but API calls may fail until database is configured.');
    dbLogger.error('📝 To fix:');
    dbLogger.error('   1. Ensure PostgreSQL is running');
    dbLogger.error('   2. Create database: CREATE DATABASE restaurant_pl;');
    dbLogger.error('   3. Set DATABASE_URL or individual DB_* environment variables');
    return false;
  }
}

/**
 * Initialize database tables
 */
async function initializeTables() {
  let client;
  try {
    client = await pool.connect();

    // Read and execute the accounting schema if it exists
    const schemaPath = path.join(__dirname, 'db-accounting-schema.sql');
    if (fs.existsSync(schemaPath)) {
      try {
        const accountingSchema = fs.readFileSync(schemaPath, 'utf8');
        await client.query(accountingSchema);
        dbLogger.info('✅ Accounting schema initialized');
      } catch (schemaError) {
        if (!schemaError.message.includes('already exists')) {
          dbLogger.warn('⚠️  Note: Some accounting tables may already exist');
        }
      }
    }

    // Core tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        account_number VARCHAR(100),
        contact_person VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        delivery_days VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        purchase_price DECIMAL(10, 2) NOT NULL,
        purchase_unit VARCHAR(50) NOT NULL,
        usage_unit VARCHAR(50) NOT NULL,
        unit_conversion_factor DECIMAL(15, 6) NOT NULL,
        yield_percent DECIMAL(5, 4) DEFAULT 1.0,
        last_price_update DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        selling_price DECIMAL(10, 2) NOT NULL,
        q_factor DECIMAL(10, 2) DEFAULT 0.0,
        target_cost_percent DECIMAL(5, 2) DEFAULT 35.0,
        estimated_prep_time_minutes DECIMAL(10, 2) DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_map (
        id SERIAL PRIMARY KEY,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        quantity_used DECIMAL(15, 6) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(menu_item_id, ingredient_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_log (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        quantity_sold INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, menu_item_id)
      )
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_log_date ON sales_log(date);
      CREATE INDEX IF NOT EXISTS idx_sales_log_menu_item ON sales_log(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_ingredients_vendor ON ingredients(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_map_menu_item ON recipe_map(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_map_ingredient ON recipe_map(ingredient_id);
    `);

    dbLogger.info('✅ Database tables initialized');
  } catch (error) {
    dbLogger.error({ error: error.message }, 'Error initializing tables');
    dbLogger.error('⚠️  Tables will be created when database connection is available');
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Execute a transaction
 * @param {Function} callback - Async function that receives the client
 */
async function transaction(callback) {
  const client = await pool.connect();
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

// Legacy compatibility layer for existing routes
// TODO: Remove this once all routes are migrated to use repositories
const promisify = {
  get: async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  },
  all: async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return result.rows;
  },
  run: async (sql, params = []) => {
    const result = await pool.query(sql, params);
    if (sql.trim().toUpperCase().startsWith('INSERT')) {
      // Try to get the inserted ID
      try {
        const idResult = await pool.query('SELECT LASTVAL() as id');
        return {
          id: parseInt(idResult.rows[0].id, 10),
          changes: result.rowCount || 0,
        };
      } catch {
        return { id: null, changes: result.rowCount || 0 };
      }
    }
    return { id: null, changes: result.rowCount || 0 };
  },
};

// Initialize on startup
testConnection();
initializeTables().catch((err) => {
  dbLogger.error({ error: err.message }, 'Failed to initialize tables');
});

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  transaction,
  testConnection,
  initializeTables,
  // Legacy compatibility - to be removed
  promisify,
};
