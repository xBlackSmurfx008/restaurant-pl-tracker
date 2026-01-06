# Database Update Guide for AI

This guide provides all information needed for an AI to update the database schema or data.

## Quick Database Update Process

### Step 1: Locate Database Information
- **Connection String**: See `CREDENTIALS.md`
- **Schema File**: `neon-schema.sql`
- **Update Script**: `init-neon-db.js`

### Step 2: Update Schema File
Edit `neon-schema.sql` with your changes:
```sql
-- Add your SQL changes here
ALTER TABLE vendors ADD COLUMN new_column VARCHAR(255);
```

### Step 3: Apply Changes

**Option A: Using Node.js Script (Recommended)**
```bash
node init-neon-db.js
```

**Option B: Using psql Directly**
```bash
psql 'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -f neon-schema.sql
```

**Option C: Using Neon SQL Editor**
1. Go to https://console.neon.tech
2. Open your project
3. Go to SQL Editor
4. Paste and run your SQL

### Step 4: Verify Changes
```bash
# Connect to database
psql 'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

# Check tables
\dt

# Check specific table structure
\d vendors
```

## Current Database Schema

### Tables
1. **vendors** - Vendor information
   - id (SERIAL PRIMARY KEY)
   - name (VARCHAR(255) NOT NULL UNIQUE)
   - account_number (VARCHAR(100))
   - contact_person (VARCHAR(255))
   - phone (VARCHAR(50))
   - email (VARCHAR(255))
   - delivery_days (VARCHAR(255))
   - created_at (TIMESTAMP)

2. **ingredients** - Ingredient inventory
   - id (SERIAL PRIMARY KEY)
   - vendor_id (INTEGER REFERENCES vendors)
   - name (VARCHAR(255) NOT NULL)
   - purchase_price (DECIMAL(10, 2))
   - purchase_unit (VARCHAR(50))
   - usage_unit (VARCHAR(50))
   - unit_conversion_factor (DECIMAL(15, 6))
   - yield_percent (DECIMAL(5, 4))
   - last_price_update (DATE)
   - created_at (TIMESTAMP)

3. **menu_items** - Menu items
   - id (SERIAL PRIMARY KEY)
   - name (VARCHAR(255) NOT NULL UNIQUE)
   - selling_price (DECIMAL(10, 2))
   - q_factor (DECIMAL(10, 2))
   - target_cost_percent (DECIMAL(5, 2))
   - estimated_prep_time_minutes (DECIMAL(10, 2))
   - created_at (TIMESTAMP)

4. **recipe_map** - Links ingredients to menu items
   - id (SERIAL PRIMARY KEY)
   - menu_item_id (INTEGER REFERENCES menu_items)
   - ingredient_id (INTEGER REFERENCES ingredients)
   - quantity_used (DECIMAL(15, 6))
   - created_at (TIMESTAMP)

5. **sales_log** - Daily sales records
   - id (SERIAL PRIMARY KEY)
   - date (DATE NOT NULL)
   - menu_item_id (INTEGER REFERENCES menu_items)
   - quantity_sold (INTEGER)
   - created_at (TIMESTAMP)

## Common Update Scenarios

### Add a New Column
```sql
ALTER TABLE vendors ADD COLUMN website VARCHAR(255);
```

### Modify Existing Column
```sql
ALTER TABLE vendors ALTER COLUMN phone TYPE VARCHAR(100);
```

### Add a New Table
```sql
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Add Index
```sql
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
```

### Update Data
```sql
UPDATE vendors SET email = 'new@email.com' WHERE id = 1;
```

## Automated Update Script Template

Create a file `update-db.js`:
```javascript
const { Pool } = require('pg');
const fs = require('fs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateDatabase() {
  const client = await pool.connect();
  try {
    // Your SQL updates here
    await client.query(`
      -- Add your SQL here
    `);
    console.log('✅ Database updated successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateDatabase();
```

## File Locations Reference

- **Credentials**: `CREDENTIALS.md`
- **Schema File**: `neon-schema.sql`
- **Init Script**: `init-neon-db.js`
- **This Guide**: `DATABASE_UPDATE_GUIDE.md`

## Quick Reference Commands

```bash
# View current schema
cat neon-schema.sql

# Update schema file
# (Edit neon-schema.sql)

# Apply updates
node init-neon-db.js

# Or use psql
psql 'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -f neon-schema.sql
```

---

**For AI**: When updating the database, always:
1. Read `CREDENTIALS.md` for connection string
2. Update `neon-schema.sql` with changes
3. Run `node init-neon-db.js` to apply
4. Verify changes in Neon console or via psql

