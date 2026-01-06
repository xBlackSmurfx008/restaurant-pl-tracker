const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyData() {
  try {
    console.log('🔍 Verifying Neon database data...\n');
    
    const vendors = await pool.query('SELECT COUNT(*) as count FROM vendors');
    const ingredients = await pool.query('SELECT COUNT(*) as count FROM ingredients');
    const menuItems = await pool.query('SELECT COUNT(*) as count FROM menu_items');
    const recipes = await pool.query('SELECT COUNT(*) as count FROM recipe_map');
    const sales = await pool.query('SELECT COUNT(*) as count FROM sales_log');
    
    console.log('📊 Data Summary:');
    console.log(`   ✅ Vendors: ${vendors.rows[0].count}`);
    console.log(`   ✅ Ingredients: ${ingredients.rows[0].count}`);
    console.log(`   ✅ Menu Items: ${menuItems.rows[0].count}`);
    console.log(`   ✅ Recipe Mappings: ${recipes.rows[0].count}`);
    console.log(`   ✅ Sales Records: ${sales.rows[0].count}`);
    
    // Sample data
    console.log('\n📋 Sample Data:');
    const sampleVendor = await pool.query('SELECT name FROM vendors LIMIT 1');
    const sampleIngredient = await pool.query('SELECT name FROM ingredients LIMIT 1');
    const sampleMenuItem = await pool.query('SELECT name FROM menu_items LIMIT 1');
    
    console.log(`   Sample Vendor: ${sampleVendor.rows[0]?.name || 'None'}`);
    console.log(`   Sample Ingredient: ${sampleIngredient.rows[0]?.name || 'None'}`);
    console.log(`   Sample Menu Item: ${sampleMenuItem.rows[0]?.name || 'None'}`);
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyData();

