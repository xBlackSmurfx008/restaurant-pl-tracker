const { Pool } = require('pg');
require('dotenv').config();

const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to default postgres database
  user: process.env.DB_USER || process.env.USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function setupDatabase() {
  const client = await adminPool.connect();
  try {
    // Check if database exists
    const dbCheck = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      ['restaurant_pl']
    );

    if (dbCheck.rows.length === 0) {
      console.log('📦 Creating database "restaurant_pl"...');
      await client.query('CREATE DATABASE restaurant_pl');
      console.log('✅ Database created successfully');
    } else {
      console.log('✅ Database "restaurant_pl" already exists');
    }
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    if (error.message.includes('does not exist')) {
      console.error('💡 Tip: Make sure PostgreSQL is running and the user has CREATE DATABASE privileges');
    }
    process.exit(1);
  } finally {
    client.release();
    await adminPool.end();
  }
}

setupDatabase();

