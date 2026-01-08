# 🍽️ Restaurant Accounting & Tax Preparation System

## Version 2.0 - Complete Financial Management for Local-Sourcing Restaurants

This system has been upgraded from a simple P&L tracker to a comprehensive accounting solution designed specifically for restaurant owners who source locally and need complete financial visibility.

---

## 🎯 Key Features

### 📊 Profit & Loss Reporting
- **Real-time P&L statements** with customizable date ranges
- **Period comparisons** (compare to previous period)
- **Key metrics tracking:**
  - Food Cost % (target: 30%)
  - Labor Cost % (target: 30%)
  - Prime Cost % (target: 60%)
  - Net Profit Margin
- **Revenue breakdown** by category (food, beverage, alcohol, catering)
- **Expense breakdown** by type (COGS, operating, marketing, payroll)

### 💰 Expense Management
- **5 expense categories:**
  - 📦 Cost of Goods Sold (COGS)
  - 🏢 Operating Expenses
  - 📣 Marketing Expenses
  - 👥 Payroll
  - 📋 Other Expenses

- **Features:**
  - Multiple payment method tracking
  - Vendor association
  - Tax deductibility flags
  - Receipt attachment support
  - Recurring expense templates
  - Budget vs. actual tracking

### 📑 Tax Preparation
- **Schedule C Report** with all line items pre-calculated
- **Quarterly Estimated Tax** calculations
  - Self-employment tax estimates
  - Income tax estimates
  - Due date tracking
- **1099-NEC Vendor Report** (vendors paid $600+)
- **CSV Exports** for:
  - Expenses (categorized for Schedule C)
  - Revenue
  - Payroll records

### 👥 Payroll Management
- **Employee database** with position tracking
- **Payroll processing** with automatic tax calculations:
  - Federal withholding
  - State withholding
  - Social Security (employee + employer)
  - Medicare (employee + employer)
  - FUTA/SUTA
- **Labor cost analysis** vs. revenue
- **Department-based reporting**

### 🏦 Banking & Cash Flow
- **Bank account tracking** (checking, savings, petty cash)
- **Transaction recording** with reconciliation
- **Cash flow reports**
- **Running balance tracking**

### 📋 Accounts Payable/Receivable
- **AP tracking** for vendor invoices
- **Aging reports** (current, 30, 60, 90+ days)
- **AR tracking** for catering/private events
- **Payment recording**

---

## 📁 New Database Tables

The system adds the following tables for complete accounting:

```
accounts              - Chart of accounts (60+ pre-configured)
fiscal_periods        - Accounting periods
expense_categories    - 30+ restaurant-specific categories
expenses              - All expense transactions
marketing_expenses    - Marketing campaign details
employees             - Staff database
payroll_records       - Payroll transactions
accounts_payable      - Vendor invoices
accounts_receivable   - Customer invoices
bank_accounts         - Bank account tracking
bank_transactions     - Deposits, withdrawals, reconciliation
journal_entries       - Double-entry accounting
daily_revenue         - Detailed daily sales
recurring_expense_templates - Auto-generate recurring expenses
tax_documents         - Tax filing records
business_settings     - System configuration
```

---

## 🚀 API Endpoints

### Expenses
```
GET    /api/expenses                    - List expenses with filters
GET    /api/expenses/categories/grouped - Categories by type
GET    /api/expenses/summary            - Expense summary
POST   /api/expenses                    - Create expense
PUT    /api/expenses/:id                - Update expense
DELETE /api/expenses/:id                - Delete expense
POST   /api/expenses/recurring/generate - Generate recurring expenses
```

### Reports
```
GET    /api/reports/pnl                 - P&L statement
GET    /api/reports/tax-expenses        - Tax category report
GET    /api/reports/cash-flow           - Cash flow statement
GET    /api/reports/vendor-analysis     - Vendor spending analysis
GET    /api/reports/budget-vs-actual    - Budget comparison
GET    /api/reports/daily-summary       - Daily revenue summary
```

### Tax Preparation
```
GET    /api/tax/schedule-c/:year        - Schedule C data
GET    /api/tax/expense-report/:year    - Detailed expense report
GET    /api/tax/quarterly-estimates/:year - Quarterly tax estimates
GET    /api/tax/1099-vendors/:year      - Vendors requiring 1099
GET    /api/tax/export/:year/:type      - Export CSV (expenses/revenue/payroll)
```

### Payroll
```
GET    /api/payroll/employees           - List employees
POST   /api/payroll/employees           - Add employee
GET    /api/payroll/records             - Payroll history
POST   /api/payroll/records             - Create payroll record
POST   /api/payroll/run-payroll         - Process payroll for all employees
GET    /api/payroll/labor-analysis      - Labor cost analysis
```

### Accounting
```
GET    /api/accounting/accounts         - Chart of accounts
GET    /api/accounting/payables         - Accounts payable
GET    /api/accounting/payables/aging   - AP aging report
GET    /api/accounting/receivables      - Accounts receivable
GET    /api/accounting/bank-accounts    - Bank accounts
POST   /api/accounting/daily-revenue    - Record daily revenue
GET    /api/accounting/settings         - Business settings
```

---

## 🎨 Frontend Components

### Operations Section (🍽️)
- **Dashboard** - Menu engineering matrix, sales analytics
- **Sales** - Daily sales entry
- **Recipes** - Menu item costing
- **Ingredients** - Ingredient pricing
- **Vendors** - Local vendor management

### Accounting Section (💼)
- **P&L Report** - Complete profit & loss statements
- **Expenses** - Full expense management
- **Tax Prep** - Schedule C, quarterly estimates, 1099s, exports

---

## 📊 Pre-configured Chart of Accounts

The system includes 60+ pre-configured accounts following restaurant industry standards:

**Assets (1000s)**
- Checking, Savings, Petty Cash
- Accounts Receivable
- Food, Beverage, Supplies Inventory
- Kitchen Equipment, Furniture
- Leasehold Improvements

**Liabilities (2000s)**
- Accounts Payable
- Credit Card Payable
- Sales Tax, Payroll Taxes
- Gift Cards Outstanding
- Loans Payable

**Equity (3000s)**
- Owner Equity
- Retained Earnings
- Owner Draws

**Revenue (4000s)**
- Food, Beverage, Alcohol Sales
- Catering Revenue
- Gift Card Sales

**COGS (5000s)**
- Food Cost, Beverage Cost
- Alcohol Cost, Packaging

**Labor (6000s)**
- Kitchen Wages, Server Wages
- Management Salaries
- Payroll Taxes, Benefits

**Operating (7000s)**
- Rent, Utilities
- Insurance, Repairs
- POS System, Credit Card Fees
- Licenses, Professional Fees

**Marketing (8000s)**
- Print, Digital, Radio/TV Advertising
- Social Media, Website
- Events, Sponsorships
- Loyalty Programs

**Other (9000s)**
- Bank Charges, Interest
- Depreciation, Miscellaneous

---

## 🔧 Getting Started

### 1. Initialize the Database
The schema will auto-initialize on first server start, but you can also run:
```bash
psql -f server/db-accounting-schema.sql
```

### 2. Configure Business Settings
```javascript
// Via API
PUT /api/accounting/settings
{
  "business_name": "Your Restaurant",
  "target_food_cost_percent": 30,
  "target_labor_cost_percent": 30,
  "default_hourly_wage": 15.00
}
```

### 3. Set Up Expense Categories
The system comes with 30+ pre-configured categories. Add custom categories:
```javascript
POST /api/expenses/categories
{
  "name": "Custom Category",
  "expense_type": "operating",
  "tax_category": "supplies",
  "is_tax_deductible": true
}
```

### 4. Add Recurring Expenses
For rent, utilities, insurance that repeat monthly:
```javascript
POST /api/expenses/recurring
{
  "name": "Monthly Rent",
  "category_id": 1,
  "amount": 5000,
  "frequency": "monthly",
  "day_of_month": 1,
  "start_date": "2024-01-01"
}
```

---

## 📋 Tax Time Checklist

1. **Review Expense Categories** - Ensure all expenses are properly categorized
2. **Generate Schedule C** - GET `/api/tax/schedule-c/{year}`
3. **Check 1099 Vendors** - GET `/api/tax/1099-vendors/{year}`
4. **Export All Data** - Download CSVs for backup
5. **Review Quarterly Estimates** - Plan for next year's payments

---

## 🛡️ Best Practices

### For Local Sourcing
- Track each vendor separately
- Note delivery days and order schedules
- Monitor price changes with price watch alerts
- Analyze vendor spending with vendor analysis report

### For Accounting
- Enter expenses daily or as they occur
- Reconcile bank accounts monthly
- Review P&L weekly
- Generate tax reports quarterly

### For Tax Preparation
- Keep all receipts organized by category
- Document business use for mixed-use expenses
- Review 1099 vendor list quarterly
- Make quarterly estimated tax payments on time

---

## 📞 Support

This system is designed for restaurant owners managing local sourcing and needing comprehensive financial tracking. For questions or customization, refer to the API documentation or contact your development team.

---

*Built with ❤️ for independent restaurant owners*

