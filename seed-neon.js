const { Pool } = require('pg');
require('dotenv').config();

// Neon Database Connection String from CREDENTIALS.md
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper functions for database operations
const db = {
  query: async (sql, params = []) => {
    const client = await pool.connect();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  },
  get: async (sql, params = []) => {
    const result = await db.query(sql, params);
    return result.rows[0] || null;
  },
  all: async (sql, params = []) => {
    const result = await db.query(sql, params);
    return result.rows;
  },
  run: async (sql, params = []) => {
    const result = await db.query(sql, params);
    if (sql.trim().toUpperCase().startsWith('INSERT')) {
      const idResult = await db.query('SELECT LASTVAL() as id');
      return {
        id: parseInt(idResult.rows[0].id),
        changes: result.rowCount || 0,
      };
    }
    return {
      id: null,
      changes: result.rowCount || 0,
    };
  },
};

// Import data from seed-data.js
const vendors = [
  { name: 'Fresh Market Produce Co.', account_number: 'FM-2024-001', contact_person: 'Sarah Johnson', phone: '(614) 555-0101', email: 'sarah@freshmarket.com', delivery_days: 'Monday, Wednesday, Friday' },
  { name: 'Premium Meats & Seafood', account_number: 'PMS-2024-002', contact_person: 'Michael Chen', phone: '(614) 555-0102', email: 'mchen@premiummeats.com', delivery_days: 'Tuesday, Thursday' },
  { name: 'Artisan Bakery Supply', account_number: 'ABS-2024-003', contact_person: 'Emma Rodriguez', phone: '(614) 555-0103', email: 'emma@artisanbakery.com', delivery_days: 'Monday, Wednesday' },
  { name: 'Dairy Direct', account_number: 'DD-2024-004', contact_person: 'James Wilson', phone: '(614) 555-0104', email: 'jwilson@dairydirect.com', delivery_days: 'Tuesday, Friday' },
  { name: 'Spice & Seasoning Warehouse', account_number: 'SSW-2024-005', contact_person: 'Lisa Anderson', phone: '(614) 555-0105', email: 'lisa@spicewarehouse.com', delivery_days: 'Monday, Thursday' },
  { name: 'Beverage Distributors Inc.', account_number: 'BDI-2024-006', contact_person: 'Robert Taylor', phone: '(614) 555-0106', email: 'rtaylor@beverage.com', delivery_days: 'Wednesday, Friday' }
];

// Load full data from seed-data.js
const seedDataModule = require('./seed-data.js');

async function seedNeonDatabase() {
  try {
    console.log('🌱 Starting Neon database seeding...\n');
    console.log('📡 Connecting to Neon database...');

    // Test connection
    await db.query('SELECT NOW()');
    console.log('✅ Connected to Neon database\n');

    // Get the data from seed-data.js by reading it
    const fs = require('fs');
    const seedDataContent = fs.readFileSync('./seed-data.js', 'utf8');
    
    // Extract data using eval (since it's a module)
    // Instead, we'll use the same data structure
    const ingredients = [
      // Proteins
      { name: 'Grass-fed Ground Beef (4.5oz)', vendor_id: 2, purchase_price: 8.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Fresh Lamb', vendor_id: 2, purchase_price: 12.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.95 },
      { name: 'Free-range Chicken Breast', vendor_id: 2, purchase_price: 6.75, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.90 },
      { name: 'Wild-caught Sockeye Salmon', vendor_id: 2, purchase_price: 15.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.85 },
      { name: 'Chicken Wings', vendor_id: 2, purchase_price: 4.50, purchase_unit: 'lb', usage_unit: 'piece', unit_conversion_factor: 8, yield_percent: 0.95 },
      // Vegetables & Produce
      { name: 'Jalapeños', vendor_id: 1, purchase_price: 3.50, purchase_unit: 'lb', usage_unit: 'piece', unit_conversion_factor: 20, yield_percent: 0.95 },
      { name: 'Portobello Mushrooms', vendor_id: 1, purchase_price: 5.00, purchase_unit: 'lb', usage_unit: 'piece', unit_conversion_factor: 4, yield_percent: 1.0 },
      { name: 'Spinach', vendor_id: 1, purchase_price: 4.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.90 },
      { name: 'Salad Mix', vendor_id: 1, purchase_price: 3.75, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.95 },
      { name: 'Tomatoes', vendor_id: 1, purchase_price: 2.50, purchase_unit: 'lb', usage_unit: 'piece', unit_conversion_factor: 3, yield_percent: 0.95 },
      { name: 'Red Onions', vendor_id: 1, purchase_price: 2.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.90 },
      { name: 'Avocados', vendor_id: 1, purchase_price: 1.50, purchase_unit: 'piece', usage_unit: 'piece', unit_conversion_factor: 1, yield_percent: 0.80 },
      { name: 'Iceberg Lettuce', vendor_id: 1, purchase_price: 2.25, purchase_unit: 'head', usage_unit: 'oz', unit_conversion_factor: 12, yield_percent: 0.85 },
      { name: 'Green Leaf Lettuce', vendor_id: 1, purchase_price: 2.50, purchase_unit: 'head', usage_unit: 'oz', unit_conversion_factor: 10, yield_percent: 0.90 },
      { name: 'Carrots', vendor_id: 1, purchase_price: 1.75, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.90 },
      { name: 'Apples', vendor_id: 1, purchase_price: 2.00, purchase_unit: 'lb', usage_unit: 'piece', unit_conversion_factor: 3, yield_percent: 0.95 },
      { name: 'Red Bell Peppers', vendor_id: 1, purchase_price: 3.00, purchase_unit: 'lb', usage_unit: 'piece', unit_conversion_factor: 3, yield_percent: 0.95 },
      { name: 'Fire-roasted Red Peppers', vendor_id: 1, purchase_price: 4.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.90 },
      // Dairy & Cheese
      { name: 'Pepper Jack Cheese', vendor_id: 4, purchase_price: 5.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Cheddar Cheese', vendor_id: 4, purchase_price: 4.75, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'American Cheese', vendor_id: 4, purchase_price: 4.25, purchase_unit: 'lb', usage_unit: 'slice', unit_conversion_factor: 20, yield_percent: 1.0 },
      { name: 'Goat Cheese', vendor_id: 4, purchase_price: 8.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Cream Cheese', vendor_id: 4, purchase_price: 3.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      // Breads & Buns
      { name: 'Burger Buns', vendor_id: 3, purchase_price: 2.50, purchase_unit: 'dozen', usage_unit: 'bun', unit_conversion_factor: 12, yield_percent: 1.0 },
      { name: 'Flour Tortillas', vendor_id: 3, purchase_price: 3.00, purchase_unit: 'dozen', usage_unit: 'tortilla', unit_conversion_factor: 12, yield_percent: 1.0 },
      // Condiments & Sauces
      { name: 'Signature Flavor Sauce', vendor_id: 5, purchase_price: 12.00, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'House BBQ Sauce', vendor_id: 5, purchase_price: 10.00, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'Buffalo Sauce', vendor_id: 5, purchase_price: 11.00, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'Chipotle BBQ Sauce', vendor_id: 5, purchase_price: 11.50, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'Ethiopian Dry Rub', vendor_id: 5, purchase_price: 15.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Ethiopian BBQ Sauce', vendor_id: 5, purchase_price: 12.50, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'Axum BBQ Sauce', vendor_id: 5, purchase_price: 13.00, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'Ranch Dressing', vendor_id: 5, purchase_price: 8.50, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'House Vinaigrette', vendor_id: 5, purchase_price: 9.00, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'Honey Mustard', vendor_id: 5, purchase_price: 9.50, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'Avocado Puree', vendor_id: 1, purchase_price: 6.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.95 },
      // Sides & Extras
      { name: 'Hand-cut Fries', vendor_id: 1, purchase_price: 2.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.85 },
      { name: 'Sweet Potato Fries', vendor_id: 1, purchase_price: 2.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.85 },
      { name: 'Tortilla Chips', vendor_id: 3, purchase_price: 4.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      // Special Ingredients
      { name: 'Chickpeas', vendor_id: 1, purchase_price: 2.25, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Candied Pecans', vendor_id: 5, purchase_price: 8.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Candied Jalapeños', vendor_id: 5, purchase_price: 6.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Quinoa', vendor_id: 1, purchase_price: 5.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Black Beans', vendor_id: 1, purchase_price: 1.75, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Lentils', vendor_id: 1, purchase_price: 2.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Pastry Dough', vendor_id: 3, purchase_price: 3.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.95 },
      { name: 'Pickles', vendor_id: 5, purchase_price: 3.00, purchase_unit: 'lb', usage_unit: 'slice', unit_conversion_factor: 30, yield_percent: 1.0 },
      { name: 'Green Olives', vendor_id: 5, purchase_price: 4.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Caramelized Onions', vendor_id: 1, purchase_price: 3.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.80 },
      { name: 'Beef Bacon', vendor_id: 2, purchase_price: 7.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 0.90 },
      { name: 'House Chili', vendor_id: 5, purchase_price: 8.00, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'Cream of Mushroom Soup Base', vendor_id: 5, purchase_price: 7.50, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
      { name: 'Spinach Dip', vendor_id: 5, purchase_price: 6.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Brown Sugar', vendor_id: 5, purchase_price: 2.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Oreo Crumbs', vendor_id: 5, purchase_price: 4.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Graham Cracker Crumbs', vendor_id: 5, purchase_price: 3.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Cheesecake Mix', vendor_id: 5, purchase_price: 5.50, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      // Seasonings
      { name: 'Ethiopian-style Seasoning', vendor_id: 5, purchase_price: 14.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Oregano', vendor_id: 5, purchase_price: 12.00, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Bread Crumbs', vendor_id: 3, purchase_price: 2.25, purchase_unit: 'lb', usage_unit: 'oz', unit_conversion_factor: 16, yield_percent: 1.0 },
      { name: 'Buttermilk', vendor_id: 4, purchase_price: 3.50, purchase_unit: 'gallon', usage_unit: 'oz', unit_conversion_factor: 128, yield_percent: 1.0 },
    ];

    const menuItems = [
      // Appetizers
      { name: 'Housemade Stuffed Jalapeños', selling_price: 9.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 8 },
      { name: '"Best Wings In Ohio"', selling_price: 17.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 15 },
      { name: 'House Chili Cheese Fries', selling_price: 9.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 10 },
      { name: 'House-Made Spinach Dip', selling_price: 9.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 5 },
      { name: 'Chicken Cream of Mushroom Soup (16oz)', selling_price: 14.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 12 },
      { name: 'The 91 Chili (16oz)', selling_price: 14.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 10 },
      // Salads
      { name: 'Healthy Vegan', selling_price: 15.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 8 },
      { name: 'The 91 Salad', selling_price: 17.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 10 },
      { name: '*The Buffalo In The Snow*', selling_price: 17.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 12 },
      { name: 'Chicken Apple Salad', selling_price: 16.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 10 },
      { name: 'The Portobello Salad', selling_price: 15.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 8 },
      // Burgers & Sandwiches
      { name: 'The Flavor Burger', selling_price: 16.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 12 },
      { name: 'The Ace Burger', selling_price: 16.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 12 },
      { name: 'The Perfect Patty', selling_price: 16.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 12 },
      { name: 'The Lamb Good Burger', selling_price: 18.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 15 },
      { name: 'The Crispy Chicken Sandwich', selling_price: 16.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 14 },
      { name: 'The Grilled Chicken Sandwich', selling_price: 16.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 12 },
      { name: 'The Chicken Avocado Wrap', selling_price: 16.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 10 },
      { name: 'The Salmon Sandwich', selling_price: 17.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 12 },
      { name: 'The Black Bean Burger', selling_price: 14.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 10 },
      { name: 'The Portabella Burger', selling_price: 13.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 10 },
      { name: '*The Sambusa*', selling_price: 13.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 15 },
      // Kids Menu
      { name: 'Flavor Burger Sliders', selling_price: 9.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 10 },
      { name: 'Chicken Tenders (Large)', selling_price: 16.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 12 },
      { name: 'Popcorn Chicken', selling_price: 14.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 10 },
      { name: 'Hand-cut Seasoned Fries', selling_price: 5.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 8 },
      { name: 'Sweet Potatoes Fries', selling_price: 5.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 8 },
      // Desserts
      { name: "Mama's Oreo-Crusted Cheesecake", selling_price: 7.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 2 },
      { name: "Mama's Graham-Cracker Crust Cheesecake", selling_price: 7.00, q_factor: 0.05, target_cost_percent: 35.0, estimated_prep_time_minutes: 2 },
    ];

    // Recipes mapping (same as seed-data.js)
    const recipes = {
      'Housemade Stuffed Jalapeños': [
        { ingredient: 'Jalapeños', quantity: 4 },
        { ingredient: 'Cream Cheese', quantity: 2 },
        { ingredient: 'Bread Crumbs', quantity: 1 },
        { ingredient: 'Ranch Dressing', quantity: 1 },
      ],
      '"Best Wings In Ohio"': [
        { ingredient: 'Chicken Wings', quantity: 10 },
        { ingredient: 'Ethiopian Dry Rub', quantity: 0.5 },
        { ingredient: 'Hand-cut Fries', quantity: 6 },
      ],
      'House Chili Cheese Fries': [
        { ingredient: 'Hand-cut Fries', quantity: 8 },
        { ingredient: 'House Chili', quantity: 6 },
        { ingredient: 'Cheddar Cheese', quantity: 2 },
        { ingredient: 'Beef Bacon', quantity: 1 },
      ],
      'House-Made Spinach Dip': [
        { ingredient: 'Spinach Dip', quantity: 8 },
        { ingredient: 'Tortilla Chips', quantity: 4 },
      ],
      'Chicken Cream of Mushroom Soup (16oz)': [
        { ingredient: 'Cream of Mushroom Soup Base', quantity: 16 },
        { ingredient: 'Free-range Chicken Breast', quantity: 3 },
      ],
      'The 91 Chili (16oz)': [
        { ingredient: 'House Chili', quantity: 16 },
      ],
      'Healthy Vegan': [
        { ingredient: 'Salad Mix', quantity: 4 },
        { ingredient: 'Chickpeas', quantity: 2 },
        { ingredient: 'Apples', quantity: 0.5 },
        { ingredient: 'Candied Pecans', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Carrots', quantity: 1 },
        { ingredient: 'Avocado Puree', quantity: 1 },
        { ingredient: 'House Vinaigrette', quantity: 1 },
      ],
      'The 91 Salad': [
        { ingredient: 'Salad Mix', quantity: 4 },
        { ingredient: 'Grass-fed Ground Beef (4.5oz)', quantity: 4.5 },
        { ingredient: 'Green Olives', quantity: 0.5 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Avocados', quantity: 0.5 },
        { ingredient: 'Red Onions', quantity: 1 },
        { ingredient: 'Red Bell Peppers', quantity: 0.5 },
        { ingredient: 'Quinoa', quantity: 2 },
        { ingredient: 'House Vinaigrette', quantity: 1 },
      ],
      '*The Buffalo In The Snow*': [
        { ingredient: 'Salad Mix', quantity: 4 },
        { ingredient: 'Free-range Chicken Breast', quantity: 5 },
        { ingredient: 'Buffalo Sauce', quantity: 2 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Caramelized Onions', quantity: 1 },
        { ingredient: 'Goat Cheese', quantity: 1 },
      ],
      'Chicken Apple Salad': [
        { ingredient: 'Green Leaf Lettuce', quantity: 4 },
        { ingredient: 'Candied Pecans', quantity: 1 },
        { ingredient: 'Apples', quantity: 0.5 },
        { ingredient: 'Red Onions', quantity: 0.5 },
        { ingredient: 'Free-range Chicken Breast', quantity: 5 },
        { ingredient: 'House Vinaigrette', quantity: 1 },
      ],
      'The Portobello Salad': [
        { ingredient: 'Salad Mix', quantity: 4 },
        { ingredient: 'Portobello Mushrooms', quantity: 1 },
        { ingredient: 'Fire-roasted Red Peppers', quantity: 2 },
        { ingredient: 'Quinoa', quantity: 2 },
        { ingredient: 'Goat Cheese', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Avocado Puree', quantity: 1 },
      ],
      'The Flavor Burger': [
        { ingredient: 'Burger Buns', quantity: 1 },
        { ingredient: 'Grass-fed Ground Beef (4.5oz)', quantity: 4.5 },
        { ingredient: 'Ethiopian-style Seasoning', quantity: 0.25 },
        { ingredient: 'Pepper Jack Cheese', quantity: 1.5 },
        { ingredient: 'Signature Flavor Sauce', quantity: 1 },
        { ingredient: 'Iceberg Lettuce', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Red Onions', quantity: 0.5 },
        { ingredient: 'Hand-cut Fries', quantity: 6 },
      ],
      'The Ace Burger': [
        { ingredient: 'Burger Buns', quantity: 1 },
        { ingredient: 'Grass-fed Ground Beef (4.5oz)', quantity: 4.5 },
        { ingredient: 'Ethiopian-style Seasoning', quantity: 0.25 },
        { ingredient: 'House BBQ Sauce', quantity: 1 },
        { ingredient: 'Cheddar Cheese', quantity: 1.5 },
        { ingredient: 'Iceberg Lettuce', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Red Onions', quantity: 0.5 },
        { ingredient: 'Hand-cut Fries', quantity: 6 },
      ],
      'The Perfect Patty': [
        { ingredient: 'Burger Buns', quantity: 1 },
        { ingredient: 'Grass-fed Ground Beef (4.5oz)', quantity: 4.5 },
        { ingredient: 'Ethiopian-style Seasoning', quantity: 0.25 },
        { ingredient: 'American Cheese', quantity: 1 },
        { ingredient: 'Iceberg Lettuce', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Red Onions', quantity: 0.5 },
        { ingredient: 'Hand-cut Fries', quantity: 6 },
      ],
      'The Lamb Good Burger': [
        { ingredient: 'Burger Buns', quantity: 1 },
        { ingredient: 'Fresh Lamb', quantity: 5 },
        { ingredient: 'Oregano', quantity: 0.25 },
        { ingredient: 'Goat Cheese', quantity: 2 },
        { ingredient: 'Fire-roasted Red Peppers', quantity: 2 },
        { ingredient: 'Caramelized Onions', quantity: 1.5 },
        { ingredient: 'Spinach', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Hand-cut Fries', quantity: 6 },
      ],
      'The Crispy Chicken Sandwich': [
        { ingredient: 'Burger Buns', quantity: 1 },
        { ingredient: 'Free-range Chicken Breast', quantity: 6 },
        { ingredient: 'Buttermilk', quantity: 2 },
        { ingredient: 'Bread Crumbs', quantity: 2 },
        { ingredient: 'Pepper Jack Cheese', quantity: 1.5 },
        { ingredient: 'Iceberg Lettuce', quantity: 1 },
        { ingredient: 'Candied Jalapeños', quantity: 1 },
        { ingredient: 'Pickles', quantity: 3 },
        { ingredient: 'Hand-cut Fries', quantity: 6 },
      ],
      'The Grilled Chicken Sandwich': [
        { ingredient: 'Burger Buns', quantity: 1 },
        { ingredient: 'Free-range Chicken Breast', quantity: 6 },
        { ingredient: 'Goat Cheese', quantity: 2 },
        { ingredient: 'Spinach', quantity: 1 },
        { ingredient: 'Fire-roasted Red Peppers', quantity: 2 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Caramelized Onions', quantity: 1 },
        { ingredient: 'Hand-cut Fries', quantity: 6 },
      ],
      'The Chicken Avocado Wrap': [
        { ingredient: 'Flour Tortillas', quantity: 1 },
        { ingredient: 'Free-range Chicken Breast', quantity: 5 },
        { ingredient: 'Avocado Puree', quantity: 2 },
        { ingredient: 'Spinach', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
      ],
      'The Salmon Sandwich': [
        { ingredient: 'Burger Buns', quantity: 1 },
        { ingredient: 'Wild-caught Sockeye Salmon', quantity: 6 },
        { ingredient: 'Spinach', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Red Onions', quantity: 0.5 },
        { ingredient: 'Honey Mustard', quantity: 1 },
      ],
      'The Black Bean Burger': [
        { ingredient: 'Burger Buns', quantity: 1 },
        { ingredient: 'Black Beans', quantity: 4 },
        { ingredient: 'Avocado Puree', quantity: 1.5 },
        { ingredient: 'Spinach', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Red Onions', quantity: 0.5 },
      ],
      'The Portabella Burger': [
        { ingredient: 'Burger Buns', quantity: 1 },
        { ingredient: 'Portobello Mushrooms', quantity: 1 },
        { ingredient: 'Spinach', quantity: 1 },
        { ingredient: 'Tomatoes', quantity: 0.5 },
        { ingredient: 'Red Onions', quantity: 0.5 },
      ],
      '*The Sambusa*': [
        { ingredient: 'Pastry Dough', quantity: 3 },
        { ingredient: 'Lentils', quantity: 3 },
        { ingredient: 'Signature Flavor Sauce', quantity: 1 },
      ],
      'Flavor Burger Sliders': [
        { ingredient: 'Burger Buns', quantity: 2 },
        { ingredient: 'Grass-fed Ground Beef (4.5oz)', quantity: 3 },
        { ingredient: 'American Cheese', quantity: 2 },
        { ingredient: 'Hand-cut Fries', quantity: 4 },
      ],
      'Chicken Tenders (Large)': [
        { ingredient: 'Free-range Chicken Breast', quantity: 8 },
        { ingredient: 'Bread Crumbs', quantity: 3 },
        { ingredient: 'Buttermilk', quantity: 3 },
        { ingredient: 'Hand-cut Fries', quantity: 6 },
      ],
      'Popcorn Chicken': [
        { ingredient: 'Free-range Chicken Breast', quantity: 6 },
        { ingredient: 'Bread Crumbs', quantity: 2 },
        { ingredient: 'Buttermilk', quantity: 2 },
        { ingredient: 'House BBQ Sauce', quantity: 1 },
        { ingredient: 'Signature Flavor Sauce', quantity: 1 },
        { ingredient: 'Hand-cut Fries', quantity: 5 },
      ],
      'Hand-cut Seasoned Fries': [
        { ingredient: 'Hand-cut Fries', quantity: 6 },
      ],
      'Sweet Potatoes Fries': [
        { ingredient: 'Sweet Potato Fries', quantity: 6 },
        { ingredient: 'Brown Sugar', quantity: 0.5 },
        { ingredient: 'Honey Mustard', quantity: 1 },
      ],
      "Mama's Oreo-Crusted Cheesecake": [
        { ingredient: 'Cheesecake Mix', quantity: 6 },
        { ingredient: 'Oreo Crumbs', quantity: 2 },
      ],
      "Mama's Graham-Cracker Crust Cheesecake": [
        { ingredient: 'Cheesecake Mix', quantity: 6 },
        { ingredient: 'Graham Cracker Crumbs', quantity: 2 },
      ],
    };

    // Insert vendors
    console.log('📦 Inserting vendors...');
    const vendorIds = [];
    for (const vendor of vendors) {
      const result = await db.query(
        `INSERT INTO vendors (name, account_number, contact_person, phone, email, delivery_days) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT (name) DO UPDATE SET 
           account_number = EXCLUDED.account_number,
           contact_person = EXCLUDED.contact_person,
           phone = EXCLUDED.phone,
           email = EXCLUDED.email,
           delivery_days = EXCLUDED.delivery_days
         RETURNING id`,
        [vendor.name, vendor.account_number, vendor.contact_person, vendor.phone, vendor.email, vendor.delivery_days]
      );
      vendorIds.push(result.rows[0].id);
      console.log(`  ✓ ${vendor.name}`);
    }

    // Update ingredient vendor_ids
    ingredients.forEach((ing, idx) => {
      if (ing.vendor_id) {
        ing.vendor_id = vendorIds[ing.vendor_id - 1];
      }
    });

    // Insert ingredients
    console.log('\n🥬 Inserting ingredients...');
    const ingredientIds = [];
    const ingredientMap = new Map();
    for (const ingredient of ingredients) {
      const result = await db.query(
        `INSERT INTO ingredients (vendor_id, name, purchase_price, purchase_unit, usage_unit, unit_conversion_factor, yield_percent) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         ON CONFLICT DO NOTHING
         RETURNING id, name`,
        [
          ingredient.vendor_id || null,
          ingredient.name,
          ingredient.purchase_price,
          ingredient.purchase_unit,
          ingredient.usage_unit,
          ingredient.unit_conversion_factor,
          ingredient.yield_percent
        ]
      );
      
      if (result.rows.length > 0) {
        ingredientIds.push(result.rows[0].id);
        ingredientMap.set(ingredient.name, result.rows[0].id);
        console.log(`  ✓ ${ingredient.name}`);
      } else {
        // If conflict, get existing ID
        const existing = await db.get(
          'SELECT id, name FROM ingredients WHERE name = $1',
          [ingredient.name]
        );
        if (existing) {
          ingredientIds.push(existing.id);
          ingredientMap.set(ingredient.name, existing.id);
        }
      }
    }

    // Insert menu items
    console.log('\n🍽️  Inserting menu items...');
    const menuItemIds = [];
    const menuItemMap = new Map();
    for (const menuItem of menuItems) {
      const result = await db.query(
        `INSERT INTO menu_items (name, selling_price, q_factor, target_cost_percent, estimated_prep_time_minutes) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (name) DO UPDATE SET 
           selling_price = EXCLUDED.selling_price,
           q_factor = EXCLUDED.q_factor,
           target_cost_percent = EXCLUDED.target_cost_percent,
           estimated_prep_time_minutes = EXCLUDED.estimated_prep_time_minutes
         RETURNING id, name`,
        [
          menuItem.name,
          menuItem.selling_price,
          menuItem.q_factor,
          menuItem.target_cost_percent,
          menuItem.estimated_prep_time_minutes
        ]
      );
      
      if (result.rows.length > 0) {
        menuItemIds.push(result.rows[0].id);
        menuItemMap.set(menuItem.name, result.rows[0].id);
        console.log(`  ✓ ${menuItem.name}`);
      } else {
        const existing = await db.get(
          'SELECT id, name FROM menu_items WHERE name = $1',
          [menuItem.name]
        );
        if (existing) {
          menuItemIds.push(existing.id);
          menuItemMap.set(menuItem.name, existing.id);
        }
      }
    }

    // Insert recipes
    console.log('\n📝 Inserting recipes...');
    let recipeCount = 0;
    for (const [menuItemName, recipeItems] of Object.entries(recipes)) {
      const menuItemId = menuItemMap.get(menuItemName);
      if (!menuItemId) {
        console.log(`  ⚠️  Menu item not found: ${menuItemName}`);
        continue;
      }

      // Clear existing recipe for this menu item
      await db.query(
        'DELETE FROM recipe_map WHERE menu_item_id = $1',
        [menuItemId]
      );

      for (const recipeItem of recipeItems) {
        const ingredientId = ingredientMap.get(recipeItem.ingredient);
        if (!ingredientId) {
          console.log(`  ⚠️  Ingredient not found: ${recipeItem.ingredient} for ${menuItemName}`);
          continue;
        }

        await db.query(
          `INSERT INTO recipe_map (menu_item_id, ingredient_id, quantity_used) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (menu_item_id, ingredient_id) 
           DO UPDATE SET quantity_used = EXCLUDED.quantity_used`,
          [menuItemId, ingredientId, recipeItem.quantity]
        );
        recipeCount++;
      }
      console.log(`  ✓ ${menuItemName} (${recipeItems.length} ingredients)`);
    }

    // Generate a full year of fake sales data (365 days)
    console.log('\n💰 Generating sales data for the past year...');
    const today = new Date();
    let salesCount = 0;
    
    // Generate data for the past 365 days
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Vary sales probability by day of week (weekends busier)
      const dayOfWeek = date.getDay();
      const baseProbability = dayOfWeek === 0 || dayOfWeek === 6 ? 0.45 : 0.25; // Weekends 45%, weekdays 25%
      
      // Random sales for each menu item
      for (const menuItemId of menuItemIds) {
        if (Math.random() < baseProbability) {
          // Vary quantity based on day (weekends sell more)
          const baseQuantity = dayOfWeek === 0 || dayOfWeek === 6 ? 3 : 2;
          const quantity = Math.floor(Math.random() * (baseQuantity * 2)) + 1; // 1 to baseQuantity*2
          
          await db.query(
            `INSERT INTO sales_log (date, menu_item_id, quantity_sold) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (date, menu_item_id) 
             DO UPDATE SET quantity_sold = sales_log.quantity_sold + EXCLUDED.quantity_sold`,
            [dateStr, menuItemId, quantity]
          );
          salesCount++;
        }
      }
      
      // Progress indicator every 50 days
      if ((i + 1) % 50 === 0) {
        console.log(`  ... Processed ${i + 1} days (${salesCount} sales so far)`);
      }
    }
    console.log(`  ✓ Generated ${salesCount} sales records for 365 days`);

    console.log('\n✅ Neon database seeding completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Vendors: ${vendorIds.length}`);
    console.log(`   - Ingredients: ${ingredientMap.size}`);
    console.log(`   - Menu Items: ${menuItemMap.size}`);
    console.log(`   - Recipes: ${recipeCount} ingredient mappings`);
    console.log(`   - Sales Records: ${salesCount}`);

  } catch (error) {
    console.error('❌ Error seeding Neon database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seed script
seedNeonDatabase().catch(console.error);

