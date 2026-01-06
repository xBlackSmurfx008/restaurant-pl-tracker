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
    
    // Verify full previous calendar year coverage for the demo
    const dateSpan = await pool.query(`
      SELECT 
        MIN(date) as min_date,
        MAX(date) as max_date
      FROM sales_log
    `);

    const prevYearCoverage = await pool.query(`
      WITH bounds AS (
        SELECT
          DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')::DATE AS start_date,
          DATE_TRUNC('year', CURRENT_DATE)::DATE AS end_date
      )
      SELECT
        TO_CHAR(DATE_TRUNC('month', s.date), 'YYYY-MM') AS month,
        COUNT(*) AS row_count,
        SUM(s.quantity_sold) AS qty_sold
      FROM sales_log s
      CROSS JOIN bounds b
      WHERE s.date >= b.start_date AND s.date < b.end_date
      GROUP BY 1
      ORDER BY 1
    `);

    console.log('\n🗓️  Sales Date Span:');
    console.log(`   Min date: ${dateSpan.rows[0]?.min_date || 'None'}`);
    console.log(`   Max date: ${dateSpan.rows[0]?.max_date || 'None'}`);

    console.log('\n📅 Previous Calendar Year Monthly Coverage:');
    console.log('   Month    Rows   QtySold');
    prevYearCoverage.rows.forEach((r) => {
      console.log(`   ${r.month}  ${String(r.row_count).padStart(4, ' ')}  ${String(r.qty_sold || 0).padStart(7, ' ')}`);
    });

    // Check if all 12 months are present
    const expectedMonths = [];
    const previousYear = new Date().getFullYear() - 1;
    for (let m = 1; m <= 12; m++) {
      expectedMonths.push(`${previousYear}-${String(m).padStart(2, '0')}`);
    }
    const presentMonths = new Set(prevYearCoverage.rows.map(r => r.month));
    const missingMonths = expectedMonths.filter(m => !presentMonths.has(m));

    if (missingMonths.length > 0) {
      console.log('\n❌ Missing months in previous-year demo data:', missingMonths.join(', '));
    } else {
      console.log('\n✅ All 12 months present for previous-year demo data.');
    }

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

