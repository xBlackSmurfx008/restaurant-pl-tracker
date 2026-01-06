const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
// Use DATABASE_URL from Neon if available, otherwise use individual env vars
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Neon
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'restaurant_pl',
      user: process.env.DB_USER || process.env.USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit - let the app handle it gracefully
});

// Test database connection on startup (non-blocking)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('⚠️  The server will start but API calls may fail until database is configured.');
    console.error('📝 To fix:');
    console.error('   1. Ensure PostgreSQL is running');
    console.error('   2. Create database: CREATE DATABASE restaurant_pl;');
    console.error('   3. Update .env file with correct credentials');
    console.error('   4. Or set DB_USER and DB_PASSWORD environment variables');
  } else {
    console.log('✅ Database connection successful');
  }
});

// Initialize all tables
async function initializeTables() {
  let client;
  try {
    client = await pool.connect();
    // Vendors table
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

    // Add new columns if they don't exist (for existing databases)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendors' AND column_name='account_number') THEN
          ALTER TABLE vendors ADD COLUMN account_number VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendors' AND column_name='delivery_days') THEN
          ALTER TABLE vendors ADD COLUMN delivery_days VARCHAR(255);
        END IF;
      END $$;
    `);

    // Ingredients table
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

    // Menu Items table
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

    // Add estimated_prep_time_minutes column if it doesn't exist (for existing databases)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='estimated_prep_time_minutes') THEN
          ALTER TABLE menu_items ADD COLUMN estimated_prep_time_minutes DECIMAL(10, 2) DEFAULT 0.0;
        END IF;
      END $$;
    `);

    // Recipe Map table (bridge between menu items and ingredients)
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

    // Sales Log table
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

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_log_date ON sales_log(date);
      CREATE INDEX IF NOT EXISTS idx_sales_log_menu_item ON sales_log(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_ingredients_vendor ON ingredients(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_map_menu_item ON recipe_map(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_map_ingredient ON recipe_map(ingredient_id);
    `);

    console.log('Database tables initialized');
  } catch (error) {
    console.error('Error initializing tables:', error.message);
    console.error('⚠️  Tables will be created when database connection is available');
    // Don't throw - allow server to start even if DB is not ready
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Initialize tables on startup
initializeTables().catch(console.error);

// Database helper methods (promisified interface for compatibility)
const db = {
  promisify: {
    get: async (sql, params = []) => {
      const client = await pool.connect();
      try {
        // Convert SQLite placeholders (?) to PostgreSQL ($1, $2, etc.)
        const pgSql = convertToPostgresSQL(sql, params);
        const result = await client.query(pgSql, params);
        return result.rows[0] || null;
      } finally {
        client.release();
      }
    },
    all: async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const pgSql = convertToPostgresSQL(sql, params);
        const result = await client.query(pgSql, params);
        return result.rows;
      } finally {
        client.release();
      }
    },
    run: async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const pgSql = convertToPostgresSQL(sql, params);
        const result = await client.query(pgSql, params);
        // For INSERT, return the inserted row ID
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
          const idResult = await client.query('SELECT LASTVAL() as id');
          return {
            id: parseInt(idResult.rows[0].id),
            changes: result.rowCount || 0,
          };
        }
        // For UPDATE/DELETE, return row count
        return {
          id: null,
          changes: result.rowCount || 0,
        };
      } finally {
        client.release();
      }
    },
  },
  // Direct query method for complex queries
  query: async (sql, params = []) => {
    const client = await pool.connect();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  },
  // Transaction support
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      try {
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } finally {
      client.release();
    }
  },
};

// Convert SQLite SQL to PostgreSQL SQL
function convertToPostgresSQL(sql, params) {
  let pgSql = sql;
  
  // Count number of ? placeholders
  const placeholderCount = (sql.match(/\?/g) || []).length;
  
  if (placeholderCount === 0) {
    // No placeholders, just convert date functions
    pgSql = convertDateFunctions(pgSql);
    return pgSql;
  }
  
  // Replace SQLite placeholders with PostgreSQL placeholders
  let paramIndex = 1;
  pgSql = pgSql.replace(/\?/g, () => {
    const result = `$${paramIndex}`;
    paramIndex++;
    return result;
  });
  
  // Replace SQLite-specific functions
  pgSql = convertDateFunctions(pgSql);
  
  // Replace INSERT OR REPLACE with PostgreSQL UPSERT
  pgSql = pgSql.replace(
    /INSERT OR REPLACE INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi,
    (match, table, columns, values) => {
      // Need to handle placeholders in values too
      let valIndex = 1;
      const convertedValues = values.replace(/\?/g, () => `$${valIndex++}`);
      const cols = columns.split(',').map(c => c.trim());
      const updateCols = cols.map(col => `${col} = EXCLUDED.${col}`).join(', ');
      return `INSERT INTO ${table} (${columns}) VALUES (${convertedValues}) ON CONFLICT DO UPDATE SET ${updateCols}`;
    }
  );
  
  return pgSql;
}

// Helper function to convert SQLite date functions to PostgreSQL
function convertDateFunctions(sql) {
  let converted = sql;
  
  converted = converted.replace(/julianday\('now'\)/gi, "EXTRACT(EPOCH FROM CURRENT_DATE) / 86400");
  converted = converted.replace(/julianday\(([^)]+)\)/gi, (match, dateCol) => {
    return `EXTRACT(EPOCH FROM ${dateCol}) / 86400`;
  });
  converted = converted.replace(/date\('now'\)/gi, 'CURRENT_DATE');
  converted = converted.replace(/date\('now',\s*'([^']+)'\)/gi, (match, modifier) => {
    if (modifier === 'start of month') return "DATE_TRUNC('month', CURRENT_DATE)::DATE";
    if (modifier === 'start of year') return "DATE_TRUNC('year', CURRENT_DATE)::DATE";
    if (modifier.startsWith('-')) {
      const days = modifier.replace('-', '').replace(' days', '');
      return `CURRENT_DATE - INTERVAL '${days} days'`;
    }
    return 'CURRENT_DATE';
  });
  
  return converted;
}

// Export pool for graceful shutdown
db.pool = pool;

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await pool.end();
  console.log('Database connections closed');
  process.exit(0);
});

module.exports = db;
