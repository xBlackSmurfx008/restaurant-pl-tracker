# Vercel Access & Deployment Guide

Complete information for AI to access and manage Vercel deployments.

## Project Access

### Project Details
- **Project Name**: restaurant-pl-tracker
- **Vercel Team**: stephen-s-projects-96d9c6b4
- **Project ID**: (auto-managed by Vercel)
- **Production URL**: https://restaurant-pl-tracker.vercel.app
- **Dashboard URL**: https://vercel.com/stephen-s-projects-96d9c6b4/restaurant-pl-tracker

### Vercel CLI Authentication
```bash
# Check if logged in
vercel whoami

# Login (if needed)
vercel login
# Follow browser prompts to authenticate
```

## Environment Variables Management

### View All Environment Variables
```bash
vercel env ls
```

### Add Environment Variable
```bash
# Production
echo "value" | vercel env add VARIABLE_NAME production

# Preview
echo "value" | vercel env add VARIABLE_NAME preview

# Development
echo "value" | vercel env add VARIABLE_NAME development
```

### Remove Environment Variable
```bash
vercel env rm VARIABLE_NAME production --yes
```

### Current Environment Variables

#### DATABASE_URL
- **Value**: `postgresql://neondb_owner:npg_X6ljSUJpqZ3F@ep-odd-resonance-adwmrhks-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- **Environments**: Production, Preview, Development

#### REACT_APP_API_URL
- **Value**: `https://restaurant-pl-tracker.vercel.app/api`
- **Environments**: Production, Preview, Development

#### NODE_ENV
- **Value**: `production`
- **Environments**: Production, Preview, Development

## Deployment Commands

### Deploy to Production
```bash
vercel --prod
```

### Deploy Preview
```bash
vercel
```

### View Deployment Logs
```bash
vercel logs
```

### Inspect Deployment
```bash
vercel inspect [deployment-url]
```

### Redeploy
```bash
vercel redeploy [deployment-url]
```

## Project Configuration

### Vercel Configuration File
- **File**: `vercel.json`
- **Location**: Project root

### Build Configuration
- **Build Command**: `npm run build`
- **Output Directory**: `client/build`
- **Install Command**: `npm run install-all`
- **Framework**: Other (custom)

### Routes Configuration
```json
{
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/client/$1"
    }
  ]
}
```

## GitHub Integration

### Repository Connection
- **GitHub Repo**: https://github.com/xBlackSmurfx008/restaurant-pl-tracker
- **Auto-Deploy**: Enabled
- **Branch**: main → Production
- **Other Branches**: Preview deployments

### Trigger Deployment
```bash
# Push to GitHub (auto-deploys)
git add .
git commit -m "Update"
git push origin main
```

## Monitoring & Debugging

### View Function Logs
```bash
vercel logs --follow
```

### Check Deployment Status
```bash
vercel ls
```

### View Build Logs
1. Go to Vercel Dashboard
2. Select deployment
3. View "Build Logs" tab

## Common Tasks

### Update Environment Variable
```bash
# Remove old
vercel env rm VARIABLE_NAME production --yes

# Add new
echo "new_value" | vercel env add VARIABLE_NAME production

# Redeploy
vercel --prod
```

### Rollback Deployment
1. Go to Vercel Dashboard
2. Select project
3. Go to Deployments
4. Find previous deployment
5. Click "..." → "Promote to Production"

### Clear Build Cache
```bash
# Force rebuild without cache
vercel --prod --force
```

## API Endpoints

### Health Check
- **URL**: https://restaurant-pl-tracker.vercel.app/api/health
- **Method**: GET
- **Response**: `{"status":"ok","message":"Restaurant P&L Tracker API is running"}`

### API Base URL
- **Production**: https://restaurant-pl-tracker.vercel.app/api
- **All routes**: `/api/vendors`, `/api/ingredients`, `/api/menu-items`, `/api/sales`

## Troubleshooting

### Build Fails
1. Check build logs: `vercel logs`
2. Verify environment variables: `vercel env ls`
3. Test build locally: `npm run build`

### Environment Variables Not Working
1. Verify variable is set: `vercel env ls`
2. Check variable name (case-sensitive)
3. Redeploy after adding variables: `vercel --prod`

### API Not Responding
1. Check function logs: `vercel logs`
2. Verify DATABASE_URL is set correctly
3. Test API endpoint directly: `curl https://restaurant-pl-tracker.vercel.app/api/health`

## Quick Reference

```bash
# Full deployment workflow
git add .
git commit -m "Changes"
git push
vercel --prod

# Update env var and redeploy
echo "value" | vercel env add VAR production
vercel --prod

# View status
vercel ls
vercel logs
```

---

**For AI**: All Vercel operations can be performed via CLI. Use `vercel --help` for full command list.

