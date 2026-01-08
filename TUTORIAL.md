# 📖 Flavor 91 Bistro - Complete Tutorial Guide

## Restaurant Accounting & Profit Management System

This comprehensive tutorial will walk you through every aspect of the Flavor 91 Bistro system - a full-featured restaurant accounting, P&L tracking, and management platform.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Getting Started](#-getting-started)
3. [Architecture Deep Dive](#-architecture-deep-dive)
4. [Core Concepts](#-core-concepts)
5. [Operations Module](#-operations-module)
6. [Accounting Module](#-accounting-module)
7. [API Reference](#-api-reference)
8. [Database Schema](#-database-schema)
9. [Frontend Components](#-frontend-components)
10. [Deployment Guide](#-deployment-guide)
11. [Advanced Features](#-advanced-features)
12. [Best Practices](#-best-practices)

---

## 🎯 Project Overview

### What is Flavor 91 Bistro?

Flavor 91 Bistro is a complete restaurant management system designed with a simple philosophy: **"Don't make me do math."** The system handles all conversions, calculations, and accounting silently while providing an intuitive, visual interface.

### Key Features

| Feature | Description |
|---------|-------------|
| **Menu Costing** | Real-time plate cost calculation with automatic unit conversions |
| **Recipe Builder** | Visual recipe creation with instant cost updates |
| **Sales Tracking** | Quick daily sales input with instant profit calculations |
| **Menu Engineering** | Matrix analysis (Champions, Hidden Gems, Volume Drivers, Needs Review) |
| **Full Accounting** | Chart of accounts, journal entries, double-entry bookkeeping |
| **Expense Tracking** | Categorized expenses with receipt storage |
| **Payroll Management** | Employee management, timeclock, tip tracking |
| **Tax Preparation** | Schedule C generation, quarterly estimates, 1099 tracking |
| **AP Automation** | Invoice inbox, vendor item mapping, payment batching |
| **POS Integration** | Connect with Square, Toast, Clover, and more |

### Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│   React 18 · CSS3 · Modern UI Components                │
├─────────────────────────────────────────────────────────┤
│                      BACKEND                            │
│   Node.js · Express 4.18 · Pino Logging                 │
├─────────────────────────────────────────────────────────┤
│                      DATABASE                           │
│   PostgreSQL · Neon (Serverless) · Supabase (Storage)   │
├─────────────────────────────────────────────────────────┤
│                      DEPLOYMENT                         │
│   Vercel · Serverless Functions                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** 9+
- **PostgreSQL** 14+ (local or cloud like Neon/Supabase)

### Installation

#### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd "Coffeeshop - Rest - Backend"

# Install all dependencies (backend + frontend)
npm run install-all
```

#### Step 2: Database Setup

**Option A: Local PostgreSQL**

```bash
# Create the database
createdb restaurant_pl

# Create a .env file
cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurant_pl
DB_USER=postgres
DB_PASSWORD=your_password
PORT=5001
EOF
```

**Option B: Neon (Serverless PostgreSQL)**

```bash
# Create a .env file with Neon connection string
cat > .env << EOF
DATABASE_URL=postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/restaurant_pl?sslmode=require
PORT=5001
EOF
```

#### Step 3: Initialize Database

The database schema auto-initializes on first run. For manual setup:

```bash
# Run the seed script (optional - adds sample data)
node seed-data.js
```

#### Step 4: Start Development Servers

```bash
# Start both backend (5001) and frontend (3000)
npm run dev
```

Your app is now running at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001/api

### Quick Test

```bash
# Test the API health endpoint
curl http://localhost:5001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Restaurant Accounting & P&L System API is running",
  "version": "2.6.0",
  "features": ["accounting", "expenses", "payroll", "tax-prep", "reports", "pnl", "gl-ledger", "inventory", "ap-automation", "labor-ops", "auth", "pos-integration"]
}
```

---

## 🏗 Architecture Deep Dive

### Project Structure

```
Coffeeshop - Rest - Backend/
├── server/                     # Backend Application
│   ├── index.js               # Server entry point
│   ├── app.js                 # Express app factory
│   ├── db.js                  # PostgreSQL connection pool
│   ├── db-accounting-schema.sql # Full database schema
│   │
│   ├── config/                # Configuration
│   │   ├── index.js          # Environment & DB config (Zod validated)
│   │   └── cors.js           # CORS settings
│   │
│   ├── middleware/            # Express Middleware
│   │   ├── errorHandler.js   # Global error handling
│   │   ├── requestId.js      # Request tracing
│   │   └── validate.js       # Zod schema validation
│   │
│   ├── routes/                # API Routes (Controllers)
│   │   ├── vendors.js        # Vendor CRUD
│   │   ├── ingredients.js    # Ingredients + conversions
│   │   ├── menuItems.js      # Menu items + recipes
│   │   ├── sales.js          # Sales tracking + analytics
│   │   ├── expenses.js       # Expense management
│   │   ├── accounting.js     # Chart of accounts, AP/AR
│   │   ├── ledger.js         # General ledger, journal entries
│   │   ├── payroll.js        # Employee payroll
│   │   ├── tax.js            # Tax preparation
│   │   ├── reports.js        # P&L and financial reports
│   │   ├── inventory.js      # Inventory management
│   │   ├── labor.js          # Scheduling, timeclock, tips
│   │   ├── pos.js            # POS integration
│   │   ├── ap.js             # Accounts payable automation
│   │   ├── auth.js           # Authentication
│   │   ├── uploads.js        # Document storage
│   │   └── mappings.js       # Vendor item mappings
│   │
│   ├── services/              # Business Logic Layer
│   │   ├── VendorService.js
│   │   ├── IngredientService.js
│   │   ├── MenuItemService.js
│   │   ├── SalesService.js
│   │   ├── APService.js
│   │   ├── InventoryService.js
│   │   ├── LaborService.js
│   │   ├── PosService.js
│   │   ├── PostingService.js
│   │   └── AuthService.js
│   │
│   ├── repositories/          # Data Access Layer
│   │   ├── BaseRepository.js  # Common CRUD operations
│   │   ├── VendorRepository.js
│   │   ├── IngredientRepository.js
│   │   ├── MenuItemRepository.js
│   │   ├── SalesRepository.js
│   │   └── ExpenseRepository.js
│   │
│   ├── schemas/               # Zod Validation Schemas
│   │   ├── vendor.schema.js
│   │   ├── ingredient.schema.js
│   │   ├── menuItem.schema.js
│   │   └── ... (all entities)
│   │
│   └── utils/                 # Utilities
│       ├── calculations.js   # P&L calculation engine
│       ├── errors.js         # Custom error classes
│       ├── logger.js         # Pino logger configuration
│       └── supabase.js       # Supabase client (for storage)
│
├── client/                    # Frontend Application
│   ├── src/
│   │   ├── App.js            # Main app with routing
│   │   ├── App.css           # Global styles
│   │   ├── theme.js          # Theme configuration
│   │   │
│   │   ├── components/       # React Components
│   │   │   ├── Dashboard.js          # Menu engineering dashboard
│   │   │   ├── VendorManagement.js   # Vendor CRUD
│   │   │   ├── IngredientLocker.js   # Ingredient management
│   │   │   ├── RecipeBuilder.js      # Recipe/menu item builder
│   │   │   ├── SalesInput.js         # Daily sales entry
│   │   │   ├── ExpenseTracker.js     # Expense management
│   │   │   ├── ReportsPanel.js       # P&L reports
│   │   │   ├── TaxCenter.js          # Tax preparation
│   │   │   ├── PayrollManager.js     # Payroll management
│   │   │   ├── AccountingDashboard.js # GL, AP/AR, bank
│   │   │   └── Login.js              # Authentication
│   │   │
│   │   └── services/
│   │       └── api.js        # API service layer
│   │
│   └── public/               # Static assets
│
├── api/                       # Vercel serverless entry
│   └── index.js
│
├── tests/                     # Playwright E2E tests
│   ├── app.spec.js
│   └── e2e/
│       └── restaurant-system.spec.js
│
└── Configuration Files
    ├── package.json
    ├── vercel.json           # Vercel deployment config
    ├── playwright.config.js
    └── .env                  # Environment variables (create this)
```

### Layered Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                      │
│   React Components → State Management → API Service            │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTP/JSON
┌───────────────────────────▼───────────────────────────────────┐
│                        CONTROLLER LAYER                        │
│   Express Routes → Validation (Zod) → Request Handling         │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                        SERVICE LAYER                           │
│   Business Logic → Calculations → Domain Rules                 │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                        REPOSITORY LAYER                        │
│   Data Access → SQL Queries → Connection Pool                  │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                        DATABASE LAYER                          │
│   PostgreSQL → Indexes → Constraints → Relationships           │
└───────────────────────────────────────────────────────────────┘
```

---

## 📚 Core Concepts

### 1. Unit Conversion System

The heart of the system is automatic unit conversion. When you buy ingredients in bulk (e.g., "50lb bag of flour") but use them in recipes (e.g., "2 cups of flour"), the system handles all conversions.

**Key Formula:**
```
Cost Per Usage Unit = Purchase Price / (Conversion Factor × Yield Percent)
```

**Example:**
```javascript
// You buy: 50lb bag of flour for $25
// You use: cups in recipes
// Conversion: 1 lb = 4 cups, so 50 lb = 200 cups

const purchasePrice = 25.00;
const conversionFactor = 200; // cups per bag
const yieldPercent = 0.95; // 5% waste

const costPerCup = purchasePrice / (conversionFactor * yieldPercent);
// costPerCup = $0.1316
```

**Built-in Conversions:**
```javascript
const UNIT_CONVERSIONS = {
  // Weight
  'lb': { 'oz': 16, 'g': 453.592, 'kg': 0.453592 },
  'oz': { 'lb': 0.0625, 'g': 28.3495 },
  
  // Volume
  'gal': { 'fl oz': 128, 'cup': 16, 'tbsp': 256, 'tsp': 768 },
  'cup': { 'fl oz': 8, 'tbsp': 16, 'tsp': 48 },
  'tbsp': { 'tsp': 3, 'fl oz': 0.5 },
  
  // Count
  'each': { 'each': 1 }
};
```

### 2. Plate Cost Calculation

Every menu item has a calculated plate cost based on its recipe:

```javascript
function calculatePlateCost(recipeItems, qFactor = 0) {
  const ingredientCost = recipeItems.reduce((sum, item) => {
    return sum + (item.cost_per_unit * item.quantity_used);
  }, 0);
  
  return ingredientCost + qFactor; // Q-factor for misc items
}
```

### 3. Profitability Metrics

```javascript
function calculateProfitability(sellingPrice, plateCost, laborCost = 0) {
  const primeCost = plateCost + laborCost;
  const grossProfit = sellingPrice - plateCost;
  const netProfit = sellingPrice - primeCost;
  const foodCostPercent = (plateCost / sellingPrice) * 100;
  const primeCostPercent = (primeCost / sellingPrice) * 100;
  
  return {
    grossProfit,
    netProfit,
    foodCostPercent,      // Target: < 30%
    primeCostPercent,     // Target: < 60%
    profitMargin: (grossProfit / sellingPrice) * 100,
    netProfitMargin: (netProfit / sellingPrice) * 100
  };
}
```

### 4. Menu Engineering Matrix

Classify menu items based on profitability and popularity:

```
                    HIGH POPULARITY
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        │  VOLUME DRIVERS │    CHAMPIONS    │
        │                 │                 │
LOW     │   Low Profit    │   High Profit   │   HIGH
PROFIT  │   High Sales    │   High Sales    │   PROFIT
        │  → Optimize     │   → Protect     │
        │                 │                 │
        ├─────────────────┼─────────────────┤
        │                 │                 │
        │  NEEDS REVIEW   │   HIDDEN GEMS   │
        │                 │                 │
        │   Low Profit    │   High Profit   │
        │   Low Sales     │   Low Sales     │
        │   → Remove      │   → Market More │
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                    LOW POPULARITY
```

---

## 🍽 Operations Module

### Vendors

Vendors are your suppliers (Sysco, US Foods, local farms, etc.).

**Creating a Vendor:**
```javascript
// POST /api/vendors
{
  "name": "Sysco",
  "account_number": "CUST-12345",
  "contact_person": "John Smith",
  "phone": "555-123-4567",
  "email": "john@sysco.com",
  "delivery_days": "Mon, Wed, Fri"
}
```

### Ingredients

Ingredients are the building blocks of your recipes.

**Creating an Ingredient:**
```javascript
// POST /api/ingredients
{
  "vendor_id": 1,
  "name": "All-Purpose Flour",
  "purchase_price": 25.00,
  "purchase_unit": "50lb bag",
  "usage_unit": "cup",
  "unit_conversion_factor": 200,  // 200 cups per bag
  "yield_percent": 0.95           // 5% waste
}
```

**Getting Conversion Suggestions:**
```javascript
// POST /api/ingredients/suggest-conversion
{
  "purchase_unit": "lb",
  "usage_unit": "oz"
}
// Response: { "suggested_factor": 16 }
```

**Price Watch Alerts:**
```javascript
// GET /api/ingredients/alerts/price-watch?days=30
// Returns ingredients not updated in 30+ days
```

### Menu Items & Recipes

**Creating a Menu Item:**
```javascript
// POST /api/menu-items
{
  "name": "Chicken Parmesan",
  "selling_price": 18.99,
  "q_factor": 0.50,              // Misc items (napkins, etc.)
  "target_cost_percent": 30,
  "estimated_prep_time_minutes": 15
}
```

**Adding Ingredients to Recipe:**
```javascript
// POST /api/menu-items/1/recipe
{
  "ingredient_id": 5,    // Chicken breast
  "quantity_used": 8     // 8 oz
}
```

**Getting Full Menu Item with Costs:**
```javascript
// GET /api/menu-items/1
{
  "id": 1,
  "name": "Chicken Parmesan",
  "selling_price": 18.99,
  "plate_cost": 5.67,
  "food_cost_percent": 29.86,
  "gross_profit": 13.32,
  "recipe": [
    {
      "ingredient_id": 5,
      "ingredient_name": "Chicken Breast",
      "quantity_used": 8,
      "usage_unit": "oz",
      "cost_per_unit": 0.3125,
      "line_cost": 2.50
    },
    // ... more ingredients
  ]
}
```

### Sales Tracking

**Quick Daily Sales Entry:**
```javascript
// POST /api/sales/daily
{
  "date": "2025-01-08",
  "sales": [
    { "menu_item_id": 1, "quantity_sold": 25 },
    { "menu_item_id": 2, "quantity_sold": 18 },
    { "menu_item_id": 3, "quantity_sold": 42 }
  ]
}
// Response includes daily profit calculation
```

**Sales Analytics:**
```javascript
// GET /api/sales/analytics?period=month
{
  "period": "month",
  "totals": {
    "totalRevenue": 45678.90,
    "totalCOGS": 14567.80,
    "netProfit": 31111.10,
    "totalQuantity": 2456,
    "globalFoodCostPercent": 31.89,
    "totalLaborCost": 8234.50,
    "primeCostPercent": 49.93
  },
  "breakdown": [
    {
      "menu_item_id": 1,
      "menu_item_name": "Chicken Parmesan",
      "quantity_sold": 456,
      "revenue": 8659.44,
      "cogs": 2585.52,
      "net_profit": 5234.12,
      "food_cost_percent": 29.86
    }
    // ... more items sorted by profit
  ]
}
```

---

## 💰 Accounting Module

### Chart of Accounts

The system comes pre-configured with a restaurant-specific chart of accounts:

| Account Range | Type | Examples |
|--------------|------|----------|
| 1000-1999 | Assets | Cash, Inventory, Equipment |
| 2000-2999 | Liabilities | Accounts Payable, Loans |
| 3000-3999 | Equity | Owner's Equity, Retained Earnings |
| 4000-4999 | Revenue | Food Sales, Catering |
| 5000-5999 | COGS | Food Cost, Beverage Cost |
| 6000-6999 | Labor | Wages, Payroll Taxes |
| 7000-7999 | Operating | Rent, Utilities, Insurance |
| 8000-8999 | Marketing | Advertising, Promotions |
| 9000-9999 | Other | Bank Fees, Depreciation |

### Expenses

**Creating an Expense:**
```javascript
// POST /api/expenses
{
  "expense_date": "2025-01-08",
  "category_id": 1,           // Food & Ingredients
  "vendor_id": 1,             // Sysco
  "description": "Weekly food order",
  "amount": 2456.78,
  "payment_method": "check",
  "reference_number": "CHK-4567",
  "tax_deductible": true,
  "tax_category": "cost_of_goods_sold"
}
```

**Expense Line Items (Invoice Details):**
```javascript
// POST /api/expenses/1/line-items
{
  "items": [
    {
      "raw_vendor_code": "CHKBRST-5LB",
      "raw_description": "Chicken Breast 5lb bag",
      "quantity": 10,
      "unit": "bag",
      "unit_price": 24.99,
      "line_total": 249.90,
      "mapped_ingredient_id": 5
    }
  ]
}
```

### Accounts Payable

**Creating an AP Record:**
```javascript
// POST /api/accounting/payables
{
  "vendor_id": 1,
  "invoice_number": "INV-2025-0108",
  "invoice_date": "2025-01-08",
  "due_date": "2025-02-07",
  "amount": 2456.78,
  "terms": "net_30"
}
```

**Recording a Payment:**
```javascript
// POST /api/accounting/payables/1/payment
{
  "amount": 2456.78,
  "payment_date": "2025-02-01",
  "payment_method": "ach",
  "reference_number": "ACH-789012"
}
```

**AP Aging Report:**
```javascript
// GET /api/accounting/payables/aging
{
  "current": 12345.67,    // 0-30 days
  "days_31_60": 5678.90,
  "days_61_90": 1234.56,
  "over_90": 0,
  "total": 19259.13,
  "vendors": [
    {
      "vendor_id": 1,
      "vendor_name": "Sysco",
      "current": 5678.90,
      "days_31_60": 2345.67,
      "total": 8024.57
    }
  ]
}
```

### Payroll

**Creating an Employee:**
```javascript
// POST /api/payroll/employees
{
  "first_name": "John",
  "last_name": "Doe",
  "position": "Line Cook",
  "department": "kitchen",
  "hire_date": "2024-03-15",
  "pay_type": "hourly",
  "pay_rate": 18.50,
  "hours_per_week": 40
}
```

**Running Payroll:**
```javascript
// POST /api/payroll/run-payroll
{
  "pay_period_start": "2025-01-01",
  "pay_period_end": "2025-01-14",
  "payment_date": "2025-01-15",
  "employee_hours": [
    {
      "employee_id": 1,
      "regular_hours": 80,
      "overtime_hours": 5,
      "tips_reported": 245.00
    }
  ]
}
```

### Tax Preparation

**Schedule C Data:**
```javascript
// GET /api/tax/schedule-c/2024
{
  "year": 2024,
  "gross_receipts": 567890.12,
  "returns_and_allowances": 1234.56,
  "cost_of_goods_sold": 178901.23,
  "gross_profit": 387754.33,
  "expenses_by_category": {
    "advertising": 12345.67,
    "car_expenses": 3456.78,
    "insurance": 8901.23,
    "rent": 48000.00,
    "utilities": 12000.00,
    "wages": 189000.00
    // ... more categories
  },
  "total_expenses": 345678.90,
  "net_profit": 42075.43
}
```

**Quarterly Estimates:**
```javascript
// GET /api/tax/quarterly-estimates/2025
{
  "estimated_annual_income": 450000,
  "estimated_tax_rate": 0.25,
  "quarterly_payment": 28125,
  "due_dates": [
    { "quarter": "Q1", "due": "2025-04-15", "amount": 28125 },
    { "quarter": "Q2", "due": "2025-06-15", "amount": 28125 },
    { "quarter": "Q3", "due": "2025-09-15", "amount": 28125 },
    { "quarter": "Q4", "due": "2026-01-15", "amount": 28125 }
  ]
}
```

---

## 📡 API Reference

### Base URL

```
Development: http://localhost:5001/api
Production:  https://your-domain.vercel.app/api
```

### Authentication

All API requests (except health check) require authentication:

```javascript
// Headers
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <token>"
}
```

### Complete Endpoint List

#### Core Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| **Vendors** |||
| GET | `/vendors` | List all vendors |
| GET | `/vendors/:id` | Get vendor by ID |
| POST | `/vendors` | Create vendor |
| PUT | `/vendors/:id` | Update vendor |
| DELETE | `/vendors/:id` | Delete vendor |
| **Ingredients** |||
| GET | `/ingredients` | List all ingredients |
| GET | `/ingredients/:id` | Get ingredient by ID |
| POST | `/ingredients` | Create ingredient |
| PUT | `/ingredients/:id` | Update ingredient |
| DELETE | `/ingredients/:id` | Delete ingredient |
| POST | `/ingredients/suggest-conversion` | Get conversion suggestion |
| GET | `/ingredients/alerts/price-watch` | Price watch alerts |
| **Menu Items** |||
| GET | `/menu-items` | List all with costs |
| GET | `/menu-items/:id` | Get with full recipe |
| POST | `/menu-items` | Create menu item |
| PUT | `/menu-items/:id` | Update menu item |
| DELETE | `/menu-items/:id` | Delete menu item |
| POST | `/menu-items/:id/recipe` | Add ingredient to recipe |
| DELETE | `/menu-items/:id/recipe/:recipeId` | Remove from recipe |
| **Sales** |||
| GET | `/sales` | Get sales (with filters) |
| GET | `/sales/date/:date` | Get sales for date |
| POST | `/sales/daily` | Save daily sales (bulk) |
| POST | `/sales` | Create single sale |
| POST | `/sales/add` | Add to existing sale |
| PUT | `/sales/:id` | Update sale |
| DELETE | `/sales/:id` | Delete sale |
| GET | `/sales/analytics` | Get analytics by period |

#### Accounting & Finance

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Expenses** |||
| GET | `/expenses` | List expenses (with filters) |
| GET | `/expenses/:id` | Get expense details |
| POST | `/expenses` | Create expense |
| PUT | `/expenses/:id` | Update expense |
| DELETE | `/expenses/:id` | Delete expense |
| GET | `/expenses/meta/categories` | Get categories |
| GET | `/expenses/meta/summary` | Get expense summary |
| **Expense Line Items** |||
| GET | `/expenses/:id/line-items` | Get line items |
| POST | `/expenses/:id/line-items` | Add line items |
| PUT | `/expenses/line-items/:id` | Update line item |
| DELETE | `/expenses/line-items/:id` | Delete line item |
| **Accounts** |||
| GET | `/accounting/accounts` | List chart of accounts |
| POST | `/accounting/accounts` | Create account |
| **AP/AR** |||
| GET | `/accounting/payables` | List AP |
| POST | `/accounting/payables` | Create AP |
| POST | `/accounting/payables/:id/payment` | Record payment |
| GET | `/accounting/payables/aging` | Aging report |
| GET | `/accounting/receivables` | List AR |
| POST | `/accounting/receivables` | Create AR |
| POST | `/accounting/receivables/:id/payment` | Record receipt |
| **Bank Accounts** |||
| GET | `/accounting/bank-accounts` | List bank accounts |
| POST | `/accounting/bank-accounts` | Create bank account |
| GET | `/accounting/bank-accounts/:id/transactions` | Get transactions |
| POST | `/accounting/bank-accounts/:id/transactions` | Add transaction |
| POST | `/accounting/bank-accounts/:id/reconcile` | Reconcile |
| **Reports** |||
| GET | `/reports/pnl` | P&L statement |
| GET | `/reports/cash-flow` | Cash flow report |
| GET | `/reports/vendor-analysis` | Vendor spending |
| GET | `/reports/budget-vs-actual` | Budget comparison |
| GET | `/reports/daily-summary` | Daily summary |
| **Payroll** |||
| GET | `/payroll/employees` | List employees |
| POST | `/payroll/employees` | Create employee |
| PUT | `/payroll/employees/:id` | Update employee |
| GET | `/payroll/records` | Get payroll records |
| POST | `/payroll/run-payroll` | Process payroll |
| GET | `/payroll/summary/department` | By department |
| **Tax** |||
| GET | `/tax/schedule-c/:year` | Schedule C data |
| GET | `/tax/expense-report/:year` | Tax expenses |
| GET | `/tax/quarterly-estimates/:year` | Quarterly estimates |
| GET | `/tax/1099-vendors/:year` | 1099 vendors |
| GET | `/tax/export/:year/:type` | Export to CSV |

#### Advanced Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Inventory** |||
| GET | `/inventory/levels` | Current stock levels |
| POST | `/inventory/receive` | Receive inventory |
| POST | `/inventory/adjust` | Adjust stock |
| GET | `/inventory/movements` | Movement history |
| GET | `/inventory/valuation` | Inventory value |
| **Labor** |||
| GET | `/labor/schedules` | Get schedules |
| POST | `/labor/schedules` | Create schedule |
| POST | `/labor/timeclock/clock-in` | Clock in |
| POST | `/labor/timeclock/clock-out` | Clock out |
| GET | `/labor/tips` | Tip records |
| POST | `/labor/tips/distribute` | Distribute tips |
| **POS Integration** |||
| GET | `/pos/configurations` | POS configs |
| POST | `/pos/configurations` | Add POS |
| POST | `/pos/sync` | Manual sync |
| GET | `/pos/transactions` | Imported transactions |
| **AP Automation** |||
| GET | `/ap/invoices` | Invoice inbox |
| POST | `/ap/invoices` | Create invoice |
| POST | `/ap/invoices/:id/approve` | Approve invoice |
| POST | `/ap/invoices/:id/post` | Post to GL |
| GET | `/ap/batches` | Payment batches |
| POST | `/ap/batches` | Create batch |
| **Mappings** |||
| GET | `/mappings` | Vendor item mappings |
| POST | `/mappings` | Create mapping |
| POST | `/mappings/apply` | Apply to expense |
| POST | `/mappings/test` | Test mapping |

---

## 🗄 Database Schema

### Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   vendors   │────<│   ingredients   │>────│ recipe_map  │
└─────────────┘     └─────────────────┘     └──────┬──────┘
       │                                           │
       │            ┌─────────────────┐            │
       │            │   menu_items    │────────────┘
       │            └────────┬────────┘
       │                     │
       │            ┌────────▼────────┐
       │            │   sales_log     │
       │            └─────────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  expenses   │────<│expense_line_items│   │  employees  │
└──────┬──────┘     └─────────────────┘     └──────┬──────┘
       │                                           │
       │                                   ┌───────▼───────┐
       │                                   │payroll_records│
       │                                   └───────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│accounts_pay │     │ journal_entries │────<│journal_lines│
└─────────────┘     └─────────────────┘     └─────────────┘
                            │
                    ┌───────▼───────┐
                    │   accounts    │
                    └───────────────┘
```

### Key Tables

#### Core Tables

```sql
-- Vendors (suppliers)
CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  account_number VARCHAR(100),
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  delivery_days VARCHAR(255)
);

-- Ingredients (inventory items)
CREATE TABLE ingredients (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  name VARCHAR(255) NOT NULL,
  purchase_price DECIMAL(10, 2) NOT NULL,
  purchase_unit VARCHAR(50) NOT NULL,
  usage_unit VARCHAR(50) NOT NULL,
  unit_conversion_factor DECIMAL(15, 6) NOT NULL,
  yield_percent DECIMAL(5, 4) DEFAULT 1.0,
  last_price_update DATE DEFAULT CURRENT_DATE
);

-- Menu Items
CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  selling_price DECIMAL(10, 2) NOT NULL,
  q_factor DECIMAL(10, 2) DEFAULT 0.0,
  target_cost_percent DECIMAL(5, 2) DEFAULT 35.0,
  estimated_prep_time_minutes DECIMAL(10, 2) DEFAULT 0.0
);

-- Recipe Map (menu item ↔ ingredient relationship)
CREATE TABLE recipe_map (
  id SERIAL PRIMARY KEY,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_used DECIMAL(15, 6) NOT NULL,
  UNIQUE(menu_item_id, ingredient_id)
);

-- Sales Log
CREATE TABLE sales_log (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date, menu_item_id)
);
```

#### Accounting Tables

```sql
-- Chart of Accounts
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  account_number VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL,  -- asset, liability, equity, revenue, expense
  sub_type VARCHAR(100),
  parent_account_id INTEGER REFERENCES accounts(id),
  is_tax_deductible BOOLEAN DEFAULT false,
  tax_category VARCHAR(100),
  is_active BOOLEAN DEFAULT true
);

-- Expenses
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  expense_date DATE NOT NULL,
  category_id INTEGER REFERENCES expense_categories(id),
  vendor_id INTEGER REFERENCES vendors(id),
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  tax_deductible BOOLEAN DEFAULT true,
  tax_category VARCHAR(100)
);

-- Journal Entries (double-entry)
CREATE TABLE journal_entries (
  id SERIAL PRIMARY KEY,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INTEGER,
  is_adjusting BOOLEAN DEFAULT false
);

CREATE TABLE journal_entry_lines (
  id SERIAL PRIMARY KEY,
  journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id),
  debit DECIMAL(12, 2) DEFAULT 0,
  credit DECIMAL(12, 2) DEFAULT 0
);
```

---

## ⚛️ Frontend Components

### Component Architecture

```
App.js
├── Login.js (authentication gate)
│
├── Operations Section
│   ├── Dashboard.js         (menu engineering matrix)
│   ├── SalesInput.js        (daily sales entry)
│   ├── RecipeBuilder.js     (menu item management)
│   ├── IngredientLocker.js  (ingredient management)
│   └── VendorManagement.js  (vendor CRUD)
│
└── Accounting Section
    ├── ReportsPanel.js      (P&L reports)
    ├── ExpenseTracker.js    (expense management)
    ├── PayrollManager.js    (employee payroll)
    ├── AccountingDashboard.js (GL, AP/AR, bank)
    └── TaxCenter.js         (tax preparation)
```

### API Service

The frontend uses a centralized API service (`client/src/services/api.js`):

```javascript
import apiService from './services/api';

// Usage examples
const vendors = await apiService.getVendors();
const ingredient = await apiService.createIngredient(data);
const analytics = await apiService.getAnalytics('month');
const pnl = await apiService.getPnLStatement('2025-01-01', '2025-01-31');
```

### State Management

The app uses React's built-in state management with hooks:

```javascript
// Example component pattern
function Dashboard() {
  const [menuItems, setMenuItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [items, stats] = await Promise.all([
        apiService.getMenuItems(),
        apiService.getAnalytics(period)
      ]);
      setMenuItems(items);
      setAnalytics(stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ... render
}
```

---

## 🚢 Deployment Guide

### Vercel Deployment

#### Step 1: Prepare Environment Variables

In Vercel dashboard, add these environment variables:

```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NODE_ENV=production
SUPABASE_URL=https://xxx.supabase.co (optional - for file storage)
SUPABASE_SERVICE_ROLE_KEY=xxx (optional)
```

#### Step 2: Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Step 3: Verify

```bash
curl https://your-app.vercel.app/api/health
```

### Configuration Files

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
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
      "dest": "/api/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/client/$1"
    }
  ]
}
```

### Database Migration

For production database setup, run the schema manually:

```bash
# Connect to your production database
psql $DATABASE_URL

# Run the schema
\i server/db-accounting-schema.sql
```

---

## 🔧 Advanced Features

### 1. Vendor Item Mappings

Automatically categorize vendor invoice items:

```javascript
// Create a mapping rule
// POST /api/mappings
{
  "vendor_id": 1,
  "match_type": "contains",      // or 'exact_code', 'regex'
  "match_value": "CHKBRST",
  "normalized_label": "Chicken Breast",
  "ingredient_id": 5,
  "category_id": 1
}

// Apply mappings to an expense
// POST /api/mappings/apply
{
  "expense_id": 123
}
```

### 2. Inventory Management

Track inventory movements with perpetual inventory:

```javascript
// Receive inventory from PO
// POST /api/inventory/receive
{
  "purchase_order_id": 1,
  "receipt_date": "2025-01-08",
  "lines": [
    {
      "po_item_id": 1,
      "quantity_received": 10,
      "unit": "case",
      "unit_cost": 24.99,
      "condition": "good"
    }
  ]
}

// Adjust inventory (waste, damage, etc.)
// POST /api/inventory/adjust
{
  "ingredient_id": 5,
  "quantity": -2,
  "unit": "lb",
  "reason": "Spoilage",
  "movement_type": "waste"
}
```

### 3. POS Integration

Connect to your POS system:

```javascript
// Configure POS connection
// POST /api/pos/configurations
{
  "provider": "square",
  "name": "Main Register",
  "api_key_encrypted": "...",
  "location_id": "LXX123"
}

// Manual sync
// POST /api/pos/sync
{
  "config_id": 1,
  "start_date": "2025-01-01",
  "end_date": "2025-01-08"
}
```

### 4. Labor Operations

Track time and manage tips:

```javascript
// Clock in
// POST /api/labor/timeclock/clock-in
{
  "employee_id": 1,
  "department": "kitchen",
  "position": "line_cook"
}

// Clock out
// POST /api/labor/timeclock/clock-out
{
  "timeclock_entry_id": 123
}

// Record tips
// POST /api/labor/tips
{
  "employee_id": 1,
  "shift_date": "2025-01-08",
  "cash_tips": 45.00,
  "credit_tips": 120.50
}

// Distribute tip pool
// POST /api/labor/tips/distribute
{
  "pool_date": "2025-01-08",
  "pool_type": "front_of_house",
  "total_amount": 850.00,
  "distribution_method": "hours_worked"
}
```

---

## 📋 Best Practices

### 1. Data Entry

- **Daily Routine**: Enter sales at end of day (takes ~30 seconds)
- **Weekly**: Review price watch alerts, update stale ingredient prices
- **Monthly**: Run P&L reports, reconcile bank accounts, close fiscal period

### 2. Recipe Management

- Use consistent units within recipes (all oz, all cups, etc.)
- Include Q-factor for miscellaneous items (napkins, to-go containers)
- Update ingredient prices when invoices arrive

### 3. Cost Control

- Target food cost: **28-32%**
- Target labor cost: **25-30%**
- Target prime cost: **55-60%**
- Review menu engineering matrix monthly

### 4. Error Handling

The API uses standard HTTP status codes and returns structured errors:

```javascript
// 400 Bad Request
{
  "error": "Validation error",
  "details": [
    { "field": "amount", "message": "Amount must be positive" }
  ]
}

// 404 Not Found
{
  "error": "Vendor not found"
}

// 500 Internal Server Error
{
  "error": "Database error",
  "requestId": "abc-123-xyz"  // Use for debugging
}
```

### 5. Performance Tips

- Use pagination for large datasets (`?limit=50&offset=0`)
- Filter by date ranges to reduce data transfer
- The API uses optimized JOINs to prevent N+1 queries

---

## 🧪 Testing

### Run E2E Tests

```bash
# Install Playwright
npx playwright install

# Run tests
npm test

# Run with UI
npx playwright test --ui
```

### API Testing with cURL

```bash
# Health check
curl http://localhost:5001/api/health

# List vendors
curl http://localhost:5001/api/vendors

# Create vendor
curl -X POST http://localhost:5001/api/vendors \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Vendor"}'

# Get analytics
curl "http://localhost:5001/api/sales/analytics?period=week"
```

---

## 🆘 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Database connection fails | Check `DATABASE_URL` or `DB_*` variables |
| Port already in use | Kill process on port 5001: `kill -9 $(lsof -t -i:5001)` |
| CORS errors | Check `server/config/cors.js` allowed origins |
| 404 on API routes | Ensure server is running and route exists |
| Calculation errors | Check ingredient unit conversions |

### Logs

```bash
# Development logs (pretty printed)
npm run server

# Production logs (JSON format)
NODE_ENV=production npm run server

# View server log file
tail -f server/server.log
```

---

## 📄 License

ISC License

---

## 🙏 Credits

Built with ❤️ for restaurant owners who want to focus on cooking, not accounting.

---

*Last updated: January 2025*

