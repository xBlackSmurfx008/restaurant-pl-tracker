# Neon Database Setup - Quick Guide

## Step 1: Get Your Neon Connection String

1. **Go to Neon Console**: https://console.neon.tech
2. **Sign in** or create a free account
3. **Create a new project** (or select existing):
   - Click "Create a project"
   - Name: `restaurant-pl-tracker`
   - Select region closest to you
   - Click "Create project"
4. **Get Connection String**:
   - In your project dashboard, look for "Connection Details" or "Connection String"
   - Click "Copy" to copy the connection string
   - Format: `postgresql://username:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require`

## Step 2: Add to Vercel

**Option A: Using the script (easiest)**
```bash
./setup-neon.sh
# Paste your connection string when prompted
```

**Option B: Using Vercel CLI directly**
```bash
# Add to production
vercel env add DATABASE_URL production
# Paste your connection string when prompted

# Add to preview
vercel env add DATABASE_URL preview
# Paste your connection string when prompted

# Add to development
vercel env add DATABASE_URL development
# Paste your connection string when prompted
```

**Option C: Via Vercel Dashboard**
1. Go to: https://vercel.com/stephen-s-projects-96d9c6b4/restaurant-pl-tracker/settings/environment-variables
2. Click "Add New"
3. Key: `DATABASE_URL`
4. Value: Paste your Neon connection string
5. Select: Production, Preview, Development
6. Click "Save"

## Step 3: Initialize Database Schema

1. In Neon console, go to **SQL Editor**
2. Copy the entire contents of `neon-schema.sql`
3. Paste into SQL Editor
4. Click "Run" to execute
5. Verify tables are created (you should see success messages)

## Step 4: Add REACT_APP_API_URL (if not already added)

```bash
vercel env add REACT_APP_API_URL production
# Enter: https://restaurant-pl-tracker.vercel.app
```

## Step 5: Redeploy

```bash
vercel --prod
```

Or trigger a redeploy from Vercel dashboard.

## Verify Everything Works

1. **Test API**: https://restaurant-pl-tracker.vercel.app/api/health
2. **Test Database**: Try creating a vendor in the app
3. **Check Neon**: Run `SELECT * FROM vendors;` in Neon SQL Editor

---

**Need help?** The connection string format should be:
```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

