#!/bin/bash

# Neon Database Setup Script for Restaurant P&L Tracker
# This script helps you add the Neon database connection to Vercel

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️  Neon Database Setup${NC}"
echo ""
echo "To get your Neon connection string:"
echo "1. Go to https://console.neon.tech"
echo "2. Sign in or create an account"
echo "3. Create a new project (or select existing)"
echo "4. Go to your project dashboard"
echo "5. Click on 'Connection Details' or 'Connection String'"
echo "6. Copy the connection string (format: postgresql://...)"
echo ""
echo -e "${YELLOW}The connection string should look like:${NC}"
echo "postgresql://username:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require"
echo ""

read -p "Paste your Neon connection string here: " DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  No connection string provided. Exiting.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}📦 Adding DATABASE_URL to Vercel...${NC}"

# Add to production environment
echo "$DATABASE_URL" | vercel env add DATABASE_URL production

# Add to preview environment
echo "$DATABASE_URL" | vercel env add DATABASE_URL preview

# Add to development environment
echo "$DATABASE_URL" | vercel env add DATABASE_URL development

echo ""
echo -e "${GREEN}✅ DATABASE_URL added to all Vercel environments!${NC}"
echo ""
echo "Next steps:"
echo "1. Initialize database schema in Neon SQL Editor (use neon-schema.sql)"
echo "2. Redeploy: vercel --prod"
echo ""

