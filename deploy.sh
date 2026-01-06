#!/bin/bash

# Restaurant P&L Tracker - Deployment Script
# This script automates deployment to Vercel

set -e

echo "🚀 Starting deployment process..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set. You'll need to:${NC}"
    echo "   1. Set up Neon database at https://console.neon.tech"
    echo "   2. Get connection string"
    echo "   3. Run: vercel env add DATABASE_URL"
    echo ""
    read -p "Continue with deployment anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Deploy to Vercel
echo -e "${GREEN}📦 Deploying to Vercel...${NC}"
vercel --prod

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Set up Neon database: https://console.neon.tech"
echo "2. Add DATABASE_URL to Vercel: vercel env add DATABASE_URL"
echo "3. Initialize database schema (see agent.md)"
echo "4. Update REACT_APP_API_URL with your Vercel domain"

