# Project Credentials & Configuration

**⚠️ SECURITY NOTE: This file contains sensitive credentials. Keep secure but accessible for AI automation.**

## Neon Database Connection

### Connection String
```
postgresql://neondb_owner:npg_whlRm02UQXiq@ep-rough-boat-ahvjxaqc-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Database Details
- **Provider**: Neon PostgreSQL
- **Host**: ep-rough-boat-ahvjxaqc-pooler.c-3.us-east-1.aws.neon.tech
- **Database**: neondb
- **User**: neondb_owner
- **Password**: npg_whlRm02UQXiq
- **Region**: US East 1 (AWS)
- **Connection Type**: Pooled (optimized for serverless)
- **SSL**: Required

### Neon Console
- **URL**: https://console.neon.tech
- **Project**: restaurant-pl-tracker (or check console for exact name)

## Vercel Deployment

### Project Information
- **Project Name**: restaurant-pl-tracker
- **Vercel Team**: stephen-s-projects-96d9c6b4
- **Production URL**: https://restaurant-pl-tracker.vercel.app
- **Dashboard**: https://vercel.com/stephen-s-projects-96d9c6b4/restaurant-pl-tracker

### Environment Variables (Vercel)

#### DATABASE_URL
```
postgresql://neondb_owner:npg_whlRm02UQXiq@ep-rough-boat-ahvjxaqc-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```
- **Environments**: Production, Preview, Development

#### REACT_APP_API_URL
```
https://restaurant-pl-tracker.vercel.app/api
```
- **Environments**: Production, Preview, Development

#### NODE_ENV
```
production
```
- **Environments**: Production, Preview, Development

### Vercel CLI Commands
```bash
# Login (if needed)
vercel login

# View environment variables
vercel env ls

# Add environment variable
vercel env add VARIABLE_NAME production

# Remove environment variable
vercel env rm VARIABLE_NAME production --yes

# Deploy to production
vercel --prod

# View logs
vercel logs
```

## GitHub Repository

### Repository Details
- **URL**: https://github.com/xBlackSmurfx008/restaurant-pl-tracker
- **Owner**: xBlackSmurfx008
- **Branch**: main
- **Visibility**: Public

### GitHub CLI
```bash
# View repository
gh repo view xBlackSmurfx008/restaurant-pl-tracker

# Clone repository
gh repo clone xBlackSmurfx008/restaurant-pl-tracker
```

## Database Schema Location

The database schema is defined in:
- **File**: `neon-schema.sql`
- **Initialization Script**: `init-neon-db.js`

## Quick Access Commands

### Connect to Database
```bash
psql 'postgresql://neondb_owner:npg_whlRm02UQXiq@ep-rough-boat-ahvjxaqc-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
```

### Update Database Schema
```bash
# Run the initialization script
node init-neon-db.js
```

### Deploy Updates
```bash
# Commit and push
git add .
git commit -m "Update description"
git push

# Deploy to Vercel
vercel --prod
```

---

**Last Updated**: 2026-01-05
**Status**: Active and Operational

