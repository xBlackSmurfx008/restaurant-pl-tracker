-- Restaurant P&L Tracker Database Schema
-- Run this in Neon SQL Editor to initialize the database

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  account_number VARCHAR(100),
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  delivery_days VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ingredients table
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
);

-- Menu Items table
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  selling_price DECIMAL(10, 2) NOT NULL,
  q_factor DECIMAL(10, 2) DEFAULT 0.0,
  target_cost_percent DECIMAL(5, 2) DEFAULT 35.0,
  estimated_prep_time_minutes DECIMAL(10, 2) DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipe Map table (bridge between menu items and ingredients)
CREATE TABLE IF NOT EXISTS recipe_map (
  id SERIAL PRIMARY KEY,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_used DECIMAL(15, 6) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(menu_item_id, ingredient_id)
);

-- Sales Log table
CREATE TABLE IF NOT EXISTS sales_log (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, menu_item_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_log_date ON sales_log(date);
CREATE INDEX IF NOT EXISTS idx_sales_log_menu_item ON sales_log(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_vendor ON ingredients(vendor_id);
CREATE INDEX IF NOT EXISTS idx_recipe_map_menu_item ON recipe_map(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_map_ingredient ON recipe_map(ingredient_id);

