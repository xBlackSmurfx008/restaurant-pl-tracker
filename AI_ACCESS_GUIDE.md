# AI Access Guide - Complete Project Information

This file contains all information an AI needs to access, update, and manage this project.

## 📁 File Structure Reference

### Critical Files for AI
- **`CREDENTIALS.md`** - All credentials and connection strings
- **`DATABASE_UPDATE_GUIDE.md`** - How to update database schema
- **`VERCEL_ACCESS.md`** - Vercel deployment and management
- **`neon-schema.sql`** - Current database schema
- **`init-neon-db.js`** - Database initialization script

## 🔑 Quick Access Credentials

### Neon Database
```
Connection String: postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
Host: ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech
Database: neondb
User: neondb_owner
Password: npg_X6ljSUJpqZ3F
```

### Vercel
```
Project: restaurant-pl-tracker
Team: stephen-s-projects-96d9c6b4
URL: https://restaurant-pl-tracker.vercel.app
Dashboard: https://vercel.com/stephen-s-projects-96d9c6b4/restaurant-pl-tracker
```

### GitHub
```
Repository: https://github.com/xBlackSmurfx008/restaurant-pl-tracker
Owner: xBlackSmurfx008
Branch: main
```

## 🗄️ Database Update Workflow

### When User Requests Database Update:

1. **Locate the update file or instruction**
   - Check if user provided SQL file
   - Check if user provided schema changes
   - Look for `database-update.sql` or similar files

2. **Read current schema**
   ```bash
   cat neon-schema.sql
   ```

3. **Update schema file**
   - Edit `neon-schema.sql` with new changes
   - Or create new migration SQL

4. **Apply changes**
   ```bash
   # Option 1: Use init script (recommended)
   node init-neon-db.js
   
   # Option 2: Direct psql
   psql 'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -f neon-schema.sql
   ```

5. **Verify changes**
   ```bash
   psql 'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -c "\dt"
   ```

## 🚀 Deployment Workflow

### Standard Deployment
```bash
# 1. Make changes
# 2. Commit
git add .
git commit -m "Description"
git push

# 3. Deploy
vercel --prod
```

### Update Environment Variables
```bash
# View current
vercel env ls

# Update
echo "new_value" | vercel env add VARIABLE_NAME production
vercel --prod
```

## 📝 Common Tasks

### Task: Update Database Schema
1. Read `DATABASE_UPDATE_GUIDE.md`
2. Edit `neon-schema.sql`
3. Run `node init-neon-db.js`
4. Verify in Neon console

### Task: Deploy Code Changes
1. Make code changes
2. `git add . && git commit -m "msg" && git push`
3. `vercel --prod`

### Task: Update Environment Variables
1. Read `VERCEL_ACCESS.md`
2. Use `vercel env add` command
3. Redeploy: `vercel --prod`

### Task: Check Deployment Status
```bash
vercel ls
vercel logs
curl https://restaurant-pl-tracker.vercel.app/api/health
```

## 🔍 Finding Information

### Need Database Connection?
→ Read `CREDENTIALS.md`

### Need to Update Database?
→ Read `DATABASE_UPDATE_GUIDE.md`

### Need Vercel Access?
→ Read `VERCEL_ACCESS.md`

### Need Current Schema?
→ Read `neon-schema.sql`

### Need to Initialize DB?
→ Run `node init-neon-db.js`

## 🛠️ Quick Commands Reference

```bash
# Database
psql 'postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
node init-neon-db.js

# Vercel
vercel --prod
vercel env ls
vercel logs

# Git
git add . && git commit -m "msg" && git push

# Test
curl https://restaurant-pl-tracker.vercel.app/api/health
```

## 📋 File Checklist

When user says "update database", check for:
- [ ] `database-update.sql` file
- [ ] `schema-update.sql` file
- [ ] SQL in user message
- [ ] Changes to `neon-schema.sql`

When found:
1. Read the update file/SQL
2. Update `neon-schema.sql`
3. Run `node init-neon-db.js`
4. Report success

## 🎯 Project Status

- ✅ Deployed to Vercel
- ✅ Connected to Neon
- ✅ Database schema initialized
- ✅ Environment variables configured
- ✅ GitHub repository connected
- ✅ Auto-deployment enabled

---

**For AI**: All necessary information is in the .md files. Read them first, then execute commands as needed.

