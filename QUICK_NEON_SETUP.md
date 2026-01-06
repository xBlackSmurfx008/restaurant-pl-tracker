# Quick Neon Database Setup

## 🚀 Fastest Way to Connect Neon to Vercel

### If you already have a Neon connection string:

Run this command and paste your connection string:
```bash
vercel env add DATABASE_URL production
```

Then add it to preview and development:
```bash
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL development
```

### If you need to create a Neon database:

1. **Go to**: https://console.neon.tech
2. **Sign in** (or create free account)
3. **Create Project**:
   - Click "Create a project"
   - Name: `restaurant-pl-tracker`
   - Region: Choose closest to you
   - Click "Create"
4. **Get Connection String**:
   - After creation, you'll see "Connection Details"
   - Click "Copy" on the connection string
   - It looks like: `postgresql://user:pass@ep-xxx.region.neon.tech/dbname?sslmode=require`
5. **Add to Vercel** (use commands above)

### Initialize Database Schema:

1. In Neon console → **SQL Editor**
2. Copy all content from `neon-schema.sql`
3. Paste and click "Run"
4. Done! ✅

### Final Step - Redeploy:

```bash
vercel --prod
```

---

**Your app will be fully functional after these steps!**

