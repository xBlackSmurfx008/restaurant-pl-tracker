# Deployment Guide: Vercel + Neon Database

This guide will help you deploy the Restaurant P&L Tracker application to Vercel (frontend + backend) with Neon PostgreSQL database.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Neon Account**: Sign up at [neon.tech](https://neon.tech)
3. **GitHub Account**: For connecting your repository to Vercel
4. **Node.js 18+**: Installed locally for testing

## 🗄️ Step 1: Set Up Neon Database

### 1.1 Create Neon Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. Click **"Create a project"**
3. Choose a project name (e.g., `restaurant-pl-tracker`)
4. Select a region closest to your users
5. Click **"Create project"**

### 1.2 Get Connection String

1. After project creation, you'll see a connection string like:
   ```
   postgresql://username:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require
   ```
2. **Copy this connection string** - you'll need it for Vercel environment variables
3. Alternatively, you can get individual connection details:
   - **Host**: `ep-xxx-xxx.region.neon.tech`
   - **Database**: `neondb` (default) or your custom name
   - **User**: Your username
   - **Password**: Your password
   - **Port**: `5432`

### 1.3 Initialize Database Schema

You have two options:

#### Option A: Using Neon SQL Editor (Recommended)

1. In Neon console, go to **"SQL Editor"**
2. Run the following SQL to create all tables:

```sql
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

-- Recipe Map table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_log_date ON sales_log(date);
CREATE INDEX IF NOT EXISTS idx_sales_log_menu_item ON sales_log(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_vendor ON ingredients(vendor_id);
CREATE INDEX IF NOT EXISTS idx_recipe_map_menu_item ON recipe_map(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_map_ingredient ON recipe_map(ingredient_id);
```

#### Option B: Using Local Script

1. Update your local `.env` with Neon connection string:
   ```env
   DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require
   ```
2. Run the database initialization:
   ```bash
   node setup-db.js
   npm run server
   ```
   The tables will be created automatically on first connection.

## 🚀 Step 2: Prepare Project for Vercel

### 2.1 Create Vercel Configuration

Create `vercel.json` in the project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/client/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 2.2 Update Server for Vercel

Create `api/index.js` (Vercel serverless entry point):

```javascript
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('../server/db');

const app = express();

// CORS - Allow all origins in production (or specify your Vercel domain)
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/vendors', require('../server/routes/vendors'));
app.use('/api/ingredients', require('../server/routes/ingredients'));
app.use('/api/menu-items', require('../server/routes/menuItems'));
app.use('/api/sales', require('../server/routes/sales'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Restaurant P&L Tracker API is running' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export for Vercel serverless
module.exports = app;
```

### 2.3 Update Database Configuration

Update `server/db.js` to use `DATABASE_URL` from Neon:

```javascript
const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL from Neon if available, otherwise use individual env vars
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Neon
      }
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

// ... rest of the file remains the same
```

### 2.4 Update Frontend API Configuration

Update `client/src/services/api.js` to use environment variable:

```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export const api = {
  // ... existing code
  get: async (endpoint) => {
    const response = await fetch(`${API_URL}${endpoint}`);
    // ... rest of the code
  },
  // ... update all other methods to use API_URL
};
```

### 2.5 Update package.json Scripts

Add build script to root `package.json`:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "nodemon server/index.js",
    "client": "cd client && npm start",
    "install-all": "npm install && cd client && npm install",
    "build": "cd client && npm run build",
    "vercel-build": "npm run build"
  }
}
```

## 📦 Step 3: Deploy to Vercel

### 3.1 Install Vercel CLI (Optional)

```bash
npm i -g vercel
```

### 3.2 Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click **"Add New Project"**
   - Import your GitHub repository
   - Vercel will auto-detect the project

3. **Configure Project Settings**:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `client/build`

4. **Add Environment Variables**:
   Click **"Environment Variables"** and add:
   
   ```
   DATABASE_URL = postgresql://username:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require
   NODE_ENV = production
   REACT_APP_API_URL = https://your-project.vercel.app
   ```
   
   **Important**: Replace `your-project.vercel.app` with your actual Vercel domain after first deployment.

5. **Deploy**:
   - Click **"Deploy"**
   - Wait for build to complete
   - Your app will be live at `https://your-project.vercel.app`

### 3.3 Deploy via CLI (Alternative)

```bash
# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? restaurant-pl-tracker
# - Directory? ./
# - Override settings? No

# Set environment variables
vercel env add DATABASE_URL
# Paste your Neon connection string

vercel env add NODE_ENV
# Enter: production

# Deploy to production
vercel --prod
```

## 🔧 Step 4: Post-Deployment Configuration

### 4.1 Update API URL

After first deployment:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `REACT_APP_API_URL` to your actual Vercel domain:
   ```
   REACT_APP_API_URL = https://your-actual-project.vercel.app
   ```
3. Redeploy to apply changes

### 4.2 Update CORS Settings

Update `api/index.js` (or `server/index.js` if using that) to include your Vercel domain:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://your-project.vercel.app',
    'https://your-project-*.vercel.app' // For preview deployments
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## ✅ Step 5: Verify Deployment

1. **Check API Health**:
   ```
   https://your-project.vercel.app/api/health
   ```
   Should return: `{"status":"ok","message":"Restaurant P&L Tracker API is running"}`

2. **Test Database Connection**:
   - Open your app in browser
   - Try creating a vendor or ingredient
   - Check Neon dashboard → SQL Editor → Run: `SELECT * FROM vendors;`

3. **Check Logs**:
   - Vercel Dashboard → Your Project → Functions → View Logs
   - Look for any connection errors

## 🐛 Troubleshooting

### Database Connection Errors

**Error**: `Connection refused` or `timeout`

**Solutions**:
1. Verify `DATABASE_URL` is correct in Vercel environment variables
2. Check Neon dashboard to ensure database is active
3. Ensure SSL is enabled: `?sslmode=require` in connection string
4. Check Neon IP allowlist (if enabled)

### CORS Errors

**Error**: `Access to fetch blocked by CORS policy`

**Solutions**:
1. Update CORS origin to include your Vercel domain
2. Ensure `credentials: true` is set in CORS config
3. Check that API routes are properly configured in `vercel.json`

### Build Failures

**Error**: Build fails on Vercel

**Solutions**:
1. Check build logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify Node.js version (Vercel uses 18.x by default)
4. Check that `vercel.json` is correctly configured

### Environment Variables Not Working

**Error**: `process.env.DATABASE_URL is undefined`

**Solutions**:
1. Ensure environment variables are set in Vercel dashboard
2. Redeploy after adding environment variables
3. Check variable names match exactly (case-sensitive)
4. For React app, use `REACT_APP_` prefix

## 📝 Additional Configuration

### Custom Domain

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `REACT_APP_API_URL` environment variable

### Database Migrations

For future schema changes:

1. Create migration files in `server/migrations/`
2. Run migrations via Neon SQL Editor or a migration script
3. Or use a migration tool like `node-pg-migrate`

### Monitoring

- **Vercel Analytics**: Enable in project settings
- **Neon Metrics**: Check database performance in Neon dashboard
- **Error Tracking**: Consider adding Sentry or similar

## 🔄 Continuous Deployment

Vercel automatically deploys on every push to your main branch:

1. Push to `main` branch → Production deployment
2. Push to other branches → Preview deployment
3. Pull requests → Preview deployment with unique URL

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [PostgreSQL on Vercel](https://vercel.com/docs/storage/vercel-postgres)
- [Serverless Functions Guide](https://vercel.com/docs/functions)

## 🎉 Success Checklist

- [ ] Neon database created and schema initialized
- [ ] `vercel.json` created
- [ ] `api/index.js` created for serverless functions
- [ ] Database connection updated to use `DATABASE_URL`
- [ ] Frontend API URL configured
- [ ] Environment variables set in Vercel
- [ ] Project deployed to Vercel
- [ ] API health check passes
- [ ] Database operations working
- [ ] CORS configured correctly
- [ ] Custom domain configured (optional)

---

**Need Help?** Check Vercel and Neon documentation or review the error logs in your Vercel dashboard.

