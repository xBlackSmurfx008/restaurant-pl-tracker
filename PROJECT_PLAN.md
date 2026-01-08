# Restaurant Accounting System - Project Plan

## 📊 Current State Assessment

### Backend Routes (11 files)
| Route | Status | Description |
|-------|--------|-------------|
| `vendors.js` | ✅ Complete | Vendor CRUD |
| `ingredients.js` | ✅ Complete | Ingredient CRUD + price alerts |
| `menuItems.js` | ✅ Complete | Menu items + recipes |
| `sales.js` | ✅ Complete | Sales logging + analytics |
| `expenses.js` | ✅ Complete | Expenses + line items + categories + recurring |
| `uploads.js` | ⚠️ Needs Config | Supabase document storage |
| `mappings.js` | ✅ Complete | Vendor code mappings ("teach codes") |
| `reports.js` | ✅ Complete | P&L, cash flow, daily summary, vendor analysis, budget |
| `tax.js` | ✅ Complete | Schedule C, quarterly estimates, 1099s, exports |
| `payroll.js` | ✅ Complete | Employees, payroll records, run payroll |
| `accounting.js` | ✅ Complete | Chart of accounts, AP/AR, bank accounts, settings |

### Frontend Components (13 files)
| Component | Status | Description |
|-----------|--------|-------------|
| `Dashboard.js` | ✅ Complete | Menu engineering matrix, analytics |
| `VendorManagement.js` | ✅ Complete | Vendor CRUD UI |
| `IngredientLocker.js` | ✅ Complete | Ingredient management |
| `RecipeBuilder.js` | ✅ Complete | Recipe builder |
| `SalesInput.js` | ✅ Complete | Daily sales entry |
| `ExpenseTracker.js` | ✅ Complete | Expense entry + document upload + line items |
| `ExpenseManager.js` | ❓ Duplicate? | Check if needed or remove |
| `ReportsPanel.js` | ✅ Complete | P&L, cash flow, reports |
| `ProfitLossReport.js` | ❓ Duplicate? | Check if needed or remove |
| `TaxCenter.js` | ✅ Complete | Tax prep, Schedule C, 1099s |
| `TaxPrep.js` | ❓ Duplicate? | Check if needed or remove |
| `PayrollManager.js` | ✅ Complete | Employee & payroll management |
| `AccountingDashboard.js` | ✅ Complete | AP/AR, bank accounts |

### Database Schema (25 tables)
- Core: vendors, ingredients, menu_items, recipe_map, sales_log
- Accounting: accounts, expenses, expense_categories, expense_line_items
- Documents: documents, expense_documents
- Payroll: employees, payroll_records
- Financial: accounts_payable, accounts_receivable, bank_accounts, bank_transactions
- Tax: tax_documents, tax_deduction_summary
- Settings: business_settings, fiscal_periods
- Other: daily_revenue, inventory_counts, purchase_orders, etc.

---

## 🔴 Phase 1: CRITICAL FIXES (Do First)

### 1.1 Clean Up Duplicate Components
- [ ] Review `ExpenseManager.js` vs `ExpenseTracker.js` - keep one
- [ ] Review `ProfitLossReport.js` vs `ReportsPanel.js` - keep one
- [ ] Review `TaxPrep.js` vs `TaxCenter.js` - keep one
- [ ] Update App.js imports after cleanup

### 1.2 Configure Supabase Storage
- [ ] Create Supabase project (if not exists)
- [ ] Create `receipts` bucket (private)
- [ ] Add environment variables:
  ```
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your-key
  SUPABASE_BUCKET=receipts
  ```
- [ ] Test document upload flow

### 1.3 Database Verification
- [ ] Run schema against Neon database
- [ ] Verify all 25 tables exist
- [ ] Seed expense_categories if empty
- [ ] Seed default chart of accounts if empty

---

## 🟡 Phase 2: INTEGRATION TESTING (1-2 days)

### 2.1 Backend API Testing
Each endpoint needs testing:

**Expenses**
- [ ] GET /api/expenses - list with filters
- [ ] POST /api/expenses - create
- [ ] GET /api/expenses/:id - with line items and docs
- [ ] PUT /api/expenses/:id - update
- [ ] DELETE /api/expenses/:id
- [ ] POST /api/expenses/:id/line-items - bulk add
- [ ] GET /api/expenses/categories/grouped
- [ ] POST /api/expenses/recurring/generate

**Uploads**
- [ ] POST /api/uploads/create - get signed URL
- [ ] POST /api/uploads/complete - finalize
- [ ] GET /api/uploads/download/:id
- [ ] DELETE /api/uploads/:id

**Mappings**
- [ ] POST /api/mappings - create rule
- [ ] POST /api/mappings/apply - apply to expense
- [ ] GET /api/mappings/unmatched/:expense_id

**Reports**
- [ ] GET /api/reports/pnl
- [ ] GET /api/reports/cash-flow
- [ ] GET /api/reports/daily-summary
- [ ] GET /api/reports/vendor-analysis
- [ ] GET /api/reports/budget-vs-actual

**Tax**
- [ ] GET /api/tax/schedule-c/:year
- [ ] GET /api/tax/quarterly-estimates/:year
- [ ] GET /api/tax/1099-vendors/:year
- [ ] GET /api/tax/export/:year/:type

**Payroll**
- [ ] GET /api/payroll/employees
- [ ] POST /api/payroll/employees
- [ ] POST /api/payroll/run-payroll
- [ ] GET /api/payroll/labor-analysis

**Accounting**
- [ ] GET /api/accounting/payables
- [ ] POST /api/accounting/payables/:id/payment
- [ ] GET /api/accounting/payables/aging
- [ ] GET /api/accounting/receivables
- [ ] GET /api/accounting/bank-accounts
- [ ] POST /api/accounting/daily-revenue
- [ ] GET/PUT /api/accounting/settings

### 2.2 Frontend Integration Testing
- [ ] Test each component loads without errors
- [ ] Test forms submit correctly
- [ ] Test filters work
- [ ] Test modals open/close
- [ ] Test data refresh after actions

---

## 🟢 Phase 3: FEATURE COMPLETION (3-5 days)

### 3.1 Expense Line Items - Bulk Entry
- [ ] Add CSV paste/import for line items
- [ ] Add copy from previous expense
- [ ] Add quick-add common items

### 3.2 Vendor Code Mappings UI
- [ ] Add mappings management screen
- [ ] Show unmatched codes with quick-map
- [ ] Test mapping suggestions
- [ ] Add mapping history/audit

### 3.3 Bank Reconciliation
- [ ] Add transaction entry form
- [ ] Add reconciliation workflow
- [ ] Add statement import (CSV)
- [ ] Show unreconciled items

### 3.4 Daily Revenue Entry
- [ ] Add daily close form
- [ ] Add POS import option
- [ ] Show week/month summaries

### 3.5 Recurring Expenses
- [ ] Add template management UI
- [ ] Add auto-generation trigger
- [ ] Add upcoming expenses view

---

## 🔵 Phase 4: ENHANCEMENTS (1-2 weeks)

### 4.1 Document Processing (OCR)
- [ ] Research: Tesseract.js vs Google Vision vs AWS Textract
- [ ] Add PDF text extraction
- [ ] Add image OCR
- [ ] Auto-populate expense fields from receipt
- [ ] Show extracted text for user confirmation

### 4.2 Reporting Enhancements
- [ ] Add date range comparisons
- [ ] Add PDF export for reports
- [ ] Add print-friendly views
- [ ] Add charts/graphs (Chart.js or Recharts)
- [ ] Add custom report builder

### 4.3 Dashboard Improvements
- [ ] Add real-time P&L widget
- [ ] Add cash position widget
- [ ] Add upcoming bills widget
- [ ] Add payroll due widget
- [ ] Add tax deadline reminders

### 4.4 Mobile Optimization
- [ ] Test responsive layout
- [ ] Add mobile-friendly expense entry
- [ ] Add camera upload for receipts
- [ ] Test on iOS/Android browsers

---

## ⚪ Phase 5: SECURITY & PRODUCTION (Before Launch)

### 5.1 Authentication (Optional)
- [ ] Decide: Single-user PIN vs Full auth
- [ ] If auth: Add login/logout
- [ ] If auth: Protect all API routes
- [ ] If auth: Add session management

### 5.2 Data Validation
- [ ] Add input validation on all routes
- [ ] Add SQL injection protection (parameterized queries ✅)
- [ ] Add rate limiting
- [ ] Add request size limits

### 5.3 Backup & Recovery
- [ ] Set up Neon automated backups
- [ ] Add manual export function
- [ ] Document restore procedure

### 5.4 Performance
- [ ] Add database indexes (✅ already have many)
- [ ] Add API response caching
- [ ] Optimize large queries
- [ ] Test with 1 year of data

### 5.5 Deployment
- [ ] Update Vercel environment variables
- [ ] Test production build
- [ ] Set up error logging (Sentry/LogRocket)
- [ ] Set up uptime monitoring

---

## 📋 Quick Reference: Environment Variables Needed

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Supabase Storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=receipts

# Server
PORT=5001
NODE_ENV=production
```

---

## 📅 Suggested Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Critical Fixes | 1 day | 🔴 High |
| Phase 2: Integration Testing | 1-2 days | 🔴 High |
| Phase 3: Feature Completion | 3-5 days | 🟡 Medium |
| Phase 4: Enhancements | 1-2 weeks | 🟢 Low |
| Phase 5: Security & Production | 2-3 days | 🔴 High (before launch) |

**Total: 2-4 weeks to production-ready**

---

## 🎯 Immediate Next Actions

1. **Run the app and test:**
   ```bash
   # Terminal 1: Backend
   npm run server
   
   # Terminal 2: Frontend  
   cd client && npm start
   ```

2. **Check database connection:**
   - Verify Neon credentials in .env
   - Check tables exist

3. **Delete duplicate components:**
   - Remove unused ExpenseManager.js, ProfitLossReport.js, TaxPrep.js

4. **Test critical flows:**
   - Add an expense
   - Add line items
   - View P&L report
   - Add an employee

---

## 📝 Notes

- **No AI Required Initially**: All expense categorization uses rule-based mappings
- **AI Can Be Added Later**: For receipt OCR and smart suggestions
- **Single User**: No auth currently - add before sharing access
- **Local First**: Works offline for data entry, syncs when connected

