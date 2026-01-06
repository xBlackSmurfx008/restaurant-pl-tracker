const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Neon connection string
const DATABASE_URL = 'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('📦 Connecting to Neon database...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, 'neon-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📝 Executing database schema...');
    
    // Execute the schema
    await client.query(schema);
    
    console.log('✅ Database schema initialized successfully!');
    console.log('✅ Tables created: vendors, ingredients, menu_items, recipe_map, sales_log');
    console.log('✅ Indexes created for optimal performance');
    
    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Some tables may already exist. This is okay.');
    } else {
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase()
  .then(() => {
    console.log('\n🎉 Database initialization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to initialize database:', error);
    process.exit(1);
  });

