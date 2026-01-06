# Quick Deployment Steps

Follow these steps to deploy your application to Vercel with Neon database.

## ✅ Step 1: Git Repository (COMPLETED)
- ✅ Git repository initialized
- ✅ Initial commit created
- ✅ Files ready to push

## 📤 Step 2: Push to GitHub

**Option A: Create New Repository on GitHub**
1. Go to [github.com/new](https://github.com/new)
2. Create a new repository (e.g., `restaurant-pl-tracker`)
3. **DO NOT** initialize with README, .gitignore, or license
4. Copy the repository URL

**Option B: Use Existing Repository**
- If you already have a GitHub repository, use its URL

**Then run these commands:**
```bash
cd "/Users/mr.008/Desktop/Projects/Coffeeshop - Rest - Backend"
git remote add origin <YOUR_GITHUB_REPO_URL>
git branch -M main
git push -u origin main
```

## 🗄️ Step 3: Set Up Neon Database

1. **Create Neon Account & Project:**
   - Go to [console.neon.tech](https://console.neon.tech)
   - Sign up/login
   - Click "Create a project"
   - Name it: `restaurant-pl-tracker`
   - Select region closest to you
   - Click "Create project"

2. **Get Connection String:**
   - After creation, you'll see a connection string like:
     ```
     postgresql://username:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require
     ```
   - **COPY THIS STRING** - you'll need it for Vercel

3. **Initialize Database Schema:**
   - In Neon console, go to **"SQL Editor"**
   - Copy and paste the SQL from `agent.md` (Step 1.3, Option A)
   - Or use the SQL script below:

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

## 🚀 Step 4: Deploy to Vercel

### 4.1 Connect GitHub Repository

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Sign up/login with GitHub
3. Click **"Add New Project"**
4. Import your GitHub repository (`restaurant-pl-tracker`)
5. Vercel will auto-detect the project

### 4.2 Configure Project Settings

- **Framework Preset**: Other
- **Root Directory**: `./` (root)
- **Build Command**: `npm run build`
- **Output Directory**: `client/build`
- **Install Command**: `npm run install-all`

### 4.3 Add Environment Variables

**BEFORE clicking Deploy**, click **"Environment Variables"** and add:

1. **DATABASE_URL**
   - Key: `DATABASE_URL`
   - Value: Your Neon connection string (from Step 3)
   - Environment: Production, Preview, Development (check all)

2. **NODE_ENV**
   - Key: `NODE_ENV`
   - Value: `production`
   - Environment: Production, Preview, Development (check all)

3. **REACT_APP_API_URL**
   - Key: `REACT_APP_API_URL`
   - Value: `https://your-project.vercel.app` (you'll update this after first deployment)
   - Environment: Production, Preview, Development (check all)

### 4.4 Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-5 minutes)
3. Your app will be live at `https://your-project.vercel.app`

### 4.5 Update API URL (After First Deployment)

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find `REACT_APP_API_URL`
3. Update value to your actual Vercel domain: `https://your-actual-project.vercel.app`
4. Redeploy (or it will auto-redeploy on next push)

## ✅ Step 5: Verify Deployment

1. **Check API Health:**
   ```
   https://your-project.vercel.app/api/health
   ```
   Should return: `{"status":"ok","message":"Restaurant P&L Tracker API is running"}`

2. **Test Database Connection:**
   - Open your app: `https://your-project.vercel.app`
   - Try creating a vendor or ingredient
   - Check Neon dashboard → SQL Editor → Run: `SELECT * FROM vendors;`

3. **Check Logs:**
   - Vercel Dashboard → Your Project → Functions → View Logs
   - Look for any connection errors

## 🎉 Success!

Your application is now deployed! 

- **Frontend**: `https://your-project.vercel.app`
- **API**: `https://your-project.vercel.app/api`
- **Database**: Neon PostgreSQL (managed)

## 📝 Next Steps

- Set up custom domain (optional)
- Enable Vercel Analytics
- Set up monitoring/error tracking
- Configure automatic deployments from GitHub

## 🆘 Troubleshooting

See `agent.md` for detailed troubleshooting guide.

---

**Quick Reference:**
- Full guide: `agent.md`
- Database setup: `POSTGRES_SETUP.md`
- Project README: `README.md`

