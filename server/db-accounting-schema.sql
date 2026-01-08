-- ============================================
-- Restaurant Accounting System - Full Schema
-- For local-sourcing restaurants with complete
-- expense tracking, P&L, and tax preparation
-- ============================================

-- ============================================
-- 1. CHART OF ACCOUNTS (Accounting Foundation)
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  account_number VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL, -- 'asset', 'liability', 'equity', 'revenue', 'expense'
  sub_type VARCHAR(100), -- 'cash', 'receivable', 'inventory', 'fixed_asset', 'payable', 'cogs', 'operating', 'marketing', etc.
  parent_account_id INTEGER REFERENCES accounts(id),
  is_tax_deductible BOOLEAN DEFAULT false,
  tax_category VARCHAR(100), -- IRS category for tax prep: 'meals', 'advertising', 'utilities', 'rent', etc.
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. FISCAL PERIODS (For proper accounting periods)
-- ============================================
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id SERIAL PRIMARY KEY,
  period_name VARCHAR(100) NOT NULL,
  period_type VARCHAR(20) NOT NULL, -- 'month', 'quarter', 'year'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  closed_at TIMESTAMP,
  closed_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. EXPENSE CATEGORIES (Restaurant-Specific)
-- ============================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  parent_category_id INTEGER REFERENCES expense_categories(id),
  expense_type VARCHAR(50) NOT NULL, -- 'cogs', 'operating', 'marketing', 'payroll', 'other'
  account_id INTEGER REFERENCES accounts(id),
  is_tax_deductible BOOLEAN DEFAULT true,
  tax_category VARCHAR(100), -- For Schedule C: 'advertising', 'car_expenses', 'utilities', 'rent', 'supplies', etc.
  description TEXT,
  budget_monthly DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. EXPENSES (All restaurant expenses)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  expense_date DATE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  vendor_id INTEGER REFERENCES vendors(id), -- Link to existing vendors table
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50), -- 'cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'vendor_credit'
  reference_number VARCHAR(100), -- Check number, invoice number, etc.
  receipt_url TEXT, -- Path to stored receipt image
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency VARCHAR(20), -- 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'
  tax_deductible BOOLEAN DEFAULT true,
  tax_category VARCHAR(100),
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. MARKETING EXPENSES (Detailed tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS marketing_expenses (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
  campaign_name VARCHAR(255),
  marketing_channel VARCHAR(100), -- 'social_media', 'print', 'radio', 'tv', 'email', 'events', 'sponsorship', 'signage', 'loyalty_program'
  platform VARCHAR(100), -- 'facebook', 'instagram', 'google_ads', 'yelp', 'local_paper', etc.
  target_audience TEXT,
  start_date DATE,
  end_date DATE,
  impressions INTEGER,
  clicks INTEGER,
  conversions INTEGER,
  roi_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. PAYROLL & LABOR (Beyond just prep time)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  position VARCHAR(100) NOT NULL, -- 'chef', 'line_cook', 'server', 'host', 'manager', 'busser', 'dishwasher', etc.
  department VARCHAR(50), -- 'kitchen', 'front_of_house', 'management', 'maintenance'
  hire_date DATE NOT NULL,
  termination_date DATE,
  pay_type VARCHAR(20) NOT NULL, -- 'hourly', 'salary'
  pay_rate DECIMAL(10, 2) NOT NULL, -- Hourly rate or annual salary
  hours_per_week DECIMAL(5, 2), -- Expected hours for hourly employees
  is_active BOOLEAN DEFAULT true,
  ssn_last_four VARCHAR(4), -- For tax purposes (encrypted in production)
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  emergency_contact TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  regular_hours DECIMAL(6, 2) DEFAULT 0,
  overtime_hours DECIMAL(6, 2) DEFAULT 0,
  tips_reported DECIMAL(10, 2) DEFAULT 0,
  gross_pay DECIMAL(12, 2) NOT NULL,
  federal_tax_withheld DECIMAL(10, 2) DEFAULT 0,
  state_tax_withheld DECIMAL(10, 2) DEFAULT 0,
  social_security_withheld DECIMAL(10, 2) DEFAULT 0,
  medicare_withheld DECIMAL(10, 2) DEFAULT 0,
  other_deductions DECIMAL(10, 2) DEFAULT 0,
  net_pay DECIMAL(12, 2) NOT NULL,
  employer_social_security DECIMAL(10, 2) DEFAULT 0,
  employer_medicare DECIMAL(10, 2) DEFAULT 0,
  employer_futa DECIMAL(10, 2) DEFAULT 0,
  employer_suta DECIMAL(10, 2) DEFAULT 0,
  total_employer_cost DECIMAL(12, 2) NOT NULL, -- Total cost to business
  payment_date DATE,
  payment_method VARCHAR(50),
  check_number VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. ACCOUNTS PAYABLE (What you owe vendors)
-- ============================================
CREATE TABLE IF NOT EXISTS accounts_payable (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  invoice_number VARCHAR(100),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  amount_paid DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'overdue', 'disputed'
  expense_id INTEGER REFERENCES expenses(id),
  terms VARCHAR(50), -- 'net_30', 'net_15', 'due_on_receipt', etc.
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. ACCOUNTS RECEIVABLE (Catering, gift cards, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS accounts_receivable (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_contact TEXT,
  invoice_number VARCHAR(100),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  amount_received DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'overdue', 'written_off'
  description TEXT,
  service_type VARCHAR(50), -- 'catering', 'private_event', 'gift_card', 'other'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. BANK ACCOUNTS & TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  account_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255),
  account_type VARCHAR(50), -- 'checking', 'savings', 'credit_card', 'petty_cash'
  account_number_last_four VARCHAR(4),
  routing_number VARCHAR(20),
  opening_balance DECIMAL(12, 2) DEFAULT 0,
  current_balance DECIMAL(12, 2) DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id SERIAL PRIMARY KEY,
  bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- 'deposit', 'withdrawal', 'transfer', 'fee', 'interest'
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL, -- Positive for deposits, negative for withdrawals
  running_balance DECIMAL(12, 2),
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_date DATE,
  expense_id INTEGER REFERENCES expenses(id),
  payroll_id INTEGER REFERENCES payroll_records(id),
  sales_date DATE, -- Link to daily sales
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. JOURNAL ENTRIES (Double-entry accounting)
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50), -- 'expense', 'sale', 'payroll', 'adjustment', 'transfer'
  reference_id INTEGER,
  is_adjusting BOOLEAN DEFAULT false,
  is_closing BOOLEAN DEFAULT false,
  fiscal_period_id INTEGER REFERENCES fiscal_periods(id),
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id SERIAL PRIMARY KEY,
  journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  debit DECIMAL(12, 2) DEFAULT 0,
  credit DECIMAL(12, 2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. RECURRING EXPENSES (Auto-generate expenses)
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_expense_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  vendor_id INTEGER REFERENCES vendors(id),
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  frequency VARCHAR(20) NOT NULL, -- 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'
  day_of_week INTEGER, -- 0-6 for weekly
  day_of_month INTEGER, -- 1-31 for monthly
  month_of_year INTEGER, -- 1-12 for annual
  start_date DATE NOT NULL,
  end_date DATE,
  last_generated_date DATE,
  next_due_date DATE,
  is_active BOOLEAN DEFAULT true,
  auto_create BOOLEAN DEFAULT true, -- Auto-create expenses or just remind
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 12. TAX DOCUMENTS & EXPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS tax_documents (
  id SERIAL PRIMARY KEY,
  tax_year INTEGER NOT NULL,
  document_type VARCHAR(50) NOT NULL, -- 'schedule_c', 'quarterly_estimate', '1099_misc', 'sales_tax', 'w2', 'w3'
  document_name VARCHAR(255) NOT NULL,
  generated_date DATE NOT NULL,
  file_path TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'final', 'filed', 'amended'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_deduction_summary (
  id SERIAL PRIMARY KEY,
  tax_year INTEGER NOT NULL,
  category VARCHAR(100) NOT NULL, -- Schedule C categories
  total_amount DECIMAL(14, 2) NOT NULL,
  notes TEXT,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 13. DAILY REVENUE SUMMARY (Beyond just menu items)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_revenue (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  food_sales DECIMAL(12, 2) DEFAULT 0,
  beverage_sales DECIMAL(12, 2) DEFAULT 0,
  alcohol_sales DECIMAL(12, 2) DEFAULT 0,
  catering_sales DECIMAL(12, 2) DEFAULT 0,
  gift_card_sales DECIMAL(12, 2) DEFAULT 0,
  other_sales DECIMAL(12, 2) DEFAULT 0,
  total_gross_sales DECIMAL(12, 2) DEFAULT 0,
  discounts DECIMAL(12, 2) DEFAULT 0,
  comps DECIMAL(12, 2) DEFAULT 0,
  refunds DECIMAL(12, 2) DEFAULT 0,
  total_net_sales DECIMAL(12, 2) DEFAULT 0,
  tips_collected DECIMAL(12, 2) DEFAULT 0,
  cash_payments DECIMAL(12, 2) DEFAULT 0,
  card_payments DECIMAL(12, 2) DEFAULT 0,
  other_payments DECIMAL(12, 2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  customer_count INTEGER DEFAULT 0,
  weather_notes VARCHAR(100),
  event_notes TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 14. INVENTORY TRACKING (Local sourcing focus)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_counts (
  id SERIAL PRIMARY KEY,
  count_date DATE NOT NULL,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  quantity_on_hand DECIMAL(15, 6) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_cost DECIMAL(10, 4),
  total_value DECIMAL(12, 2),
  counted_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  order_date DATE NOT NULL,
  expected_delivery DATE,
  actual_delivery DATE,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'ordered', 'partial', 'received', 'cancelled'
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  shipping DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id INTEGER REFERENCES ingredients(id),
  description TEXT NOT NULL,
  quantity DECIMAL(12, 4) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(10, 4) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  received_quantity DECIMAL(12, 4) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 14b. INVENTORY MOVEMENTS (Perpetual Inventory Ledger)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  movement_type VARCHAR(30) NOT NULL, -- 'receipt', 'usage', 'adjustment', 'waste', 'transfer_in', 'transfer_out', 'count_adjustment'
  quantity DECIMAL(15, 6) NOT NULL,   -- Positive for in, negative for out
  unit VARCHAR(50) NOT NULL,
  unit_cost DECIMAL(10, 4),           -- Cost at time of movement
  total_cost DECIMAL(12, 2),
  reference_type VARCHAR(50),         -- 'purchase_order', 'recipe', 'count', 'manual'
  reference_id INTEGER,               -- ID of PO, recipe usage, count, etc.
  reason TEXT,                        -- Reason for adjustment/waste
  performed_by VARCHAR(255),
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 14c. INVENTORY LEVELS (Denormalized current stock)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_levels (
  id SERIAL PRIMARY KEY,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) UNIQUE,
  quantity_on_hand DECIMAL(15, 6) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL,
  average_cost DECIMAL(10, 4) DEFAULT 0,     -- Weighted average cost
  total_value DECIMAL(12, 2) DEFAULT 0,
  last_received_date DATE,
  last_used_date DATE,
  last_count_date DATE,
  reorder_point DECIMAL(15, 6),              -- Alert when qty falls below
  reorder_quantity DECIMAL(15, 6),           -- Suggested reorder amount
  par_level DECIMAL(15, 6),                  -- Target stock level
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 14d. INVENTORY RECEIPTS (Receiving against POs)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_receipts (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by VARCHAR(255),
  invoice_number VARCHAR(100),
  invoice_total DECIMAL(12, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_receipt_lines (
  id SERIAL PRIMARY KEY,
  receipt_id INTEGER NOT NULL REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  po_item_id INTEGER NOT NULL REFERENCES purchase_order_items(id),
  ingredient_id INTEGER REFERENCES ingredients(id),
  quantity_received DECIMAL(12, 4) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_cost DECIMAL(10, 4) NOT NULL,
  total_cost DECIMAL(12, 2) NOT NULL,
  condition VARCHAR(20) DEFAULT 'good', -- 'good', 'damaged', 'returned', 'short'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 15. AP AUTOMATION (Invoice Inbox & Batching)
-- ============================================

-- AP Invoices - Inbox/staging area for vendor bills
CREATE TABLE IF NOT EXISTS ap_invoices (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  invoice_number VARCHAR(100),
  invoice_date DATE,
  due_date DATE,
  terms VARCHAR(50),
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  shipping DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  document_id INTEGER REFERENCES documents(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  extraction_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'extracted', 'manual', 'failed'
  mapping_status VARCHAR(20) DEFAULT 'pending',    -- 'pending', 'partial', 'complete', 'manual'
  approval_status VARCHAR(20) DEFAULT 'pending',   -- 'pending', 'approved', 'rejected', 'hold'
  posting_status VARCHAR(20) DEFAULT 'pending',    -- 'pending', 'posted', 'failed'
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  posted_at TIMESTAMP,
  journal_entry_id INTEGER REFERENCES journal_entries(id),
  accounts_payable_id INTEGER REFERENCES accounts_payable(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AP Invoice Line Items
CREATE TABLE IF NOT EXISTS ap_invoice_lines (
  id SERIAL PRIMARY KEY,
  ap_invoice_id INTEGER NOT NULL REFERENCES ap_invoices(id) ON DELETE CASCADE,
  line_number INTEGER,
  raw_vendor_code TEXT,
  raw_description TEXT NOT NULL,
  quantity DECIMAL(12, 4),
  unit TEXT,
  unit_price DECIMAL(12, 4),
  line_total DECIMAL(12, 2),
  mapped_ingredient_id INTEGER REFERENCES ingredients(id),
  mapped_category_id INTEGER REFERENCES expense_categories(id),
  mapped_account_id INTEGER REFERENCES accounts(id),
  mapping_confidence DECIMAL(3, 2) DEFAULT 0,
  mapping_source VARCHAR(20), -- 'auto', 'manual', 'suggested'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Batches
CREATE TABLE IF NOT EXISTS payment_batches (
  id SERIAL PRIMARY KEY,
  batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_number VARCHAR(50),
  bank_account_id INTEGER REFERENCES bank_accounts(id),
  payment_method VARCHAR(50), -- 'check', 'ach', 'wire', 'card'
  total_amount DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'approved', 'processing', 'completed', 'cancelled'
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  processed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Batch Items
CREATE TABLE IF NOT EXISTS payment_batch_items (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES payment_batches(id) ON DELETE CASCADE,
  accounts_payable_id INTEGER NOT NULL REFERENCES accounts_payable(id),
  amount DECIMAL(12, 2) NOT NULL,
  check_number VARCHAR(50),
  reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'voided'
  paid_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 16. LABOR OPERATIONS (Scheduling, Timeclock, Tips)
-- ============================================

-- Work Schedules
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  schedule_date DATE NOT NULL,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  position VARCHAR(100),
  department VARCHAR(50),
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'confirmed', 'no_show', 'called_out'
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, schedule_date, shift_start)
);

-- Timeclock Entries
CREATE TABLE IF NOT EXISTS timeclock_entries (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  clock_in TIMESTAMP NOT NULL,
  clock_out TIMESTAMP,
  break_start TIMESTAMP,
  break_end TIMESTAMP,
  total_break_minutes INTEGER DEFAULT 0,
  schedule_id INTEGER REFERENCES schedules(id),
  department VARCHAR(50),
  position VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'adjusted', 'approved'
  adjusted_by VARCHAR(255),
  adjusted_at TIMESTAMP,
  adjustment_reason TEXT,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tip Records (per shift)
CREATE TABLE IF NOT EXISTS tip_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  shift_date DATE NOT NULL,
  timeclock_entry_id INTEGER REFERENCES timeclock_entries(id),
  cash_tips DECIMAL(10, 2) DEFAULT 0,
  credit_tips DECIMAL(10, 2) DEFAULT 0,
  tip_out_given DECIMAL(10, 2) DEFAULT 0,     -- Tips given to support staff
  tip_pool_contribution DECIMAL(10, 2) DEFAULT 0, -- Contribution to pool
  tip_pool_received DECIMAL(10, 2) DEFAULT 0,     -- Received from pool
  total_tips DECIMAL(10, 2) DEFAULT 0,
  hours_worked DECIMAL(5, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tip Pool Sessions (for pool distribution)
CREATE TABLE IF NOT EXISTS tip_pool_sessions (
  id SERIAL PRIMARY KEY,
  pool_date DATE NOT NULL,
  pool_type VARCHAR(50) NOT NULL, -- 'front_of_house', 'bar', 'kitchen', 'all_staff'
  total_pool_amount DECIMAL(12, 2) NOT NULL,
  distribution_method VARCHAR(50) NOT NULL, -- 'hours_worked', 'equal', 'points'
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'calculated', 'approved', 'distributed'
  calculated_at TIMESTAMP,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  distributed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tip Pool Distributions
CREATE TABLE IF NOT EXISTS tip_pool_distributions (
  id SERIAL PRIMARY KEY,
  pool_session_id INTEGER NOT NULL REFERENCES tip_pool_sessions(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  hours_worked DECIMAL(5, 2) DEFAULT 0,
  points DECIMAL(5, 2) DEFAULT 0,
  share_percentage DECIMAL(5, 4) DEFAULT 0,
  amount DECIMAL(10, 2) NOT NULL,
  tip_record_id INTEGER REFERENCES tip_records(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 17. AUTHENTICATION & ACCESS CONTROL
-- ============================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer', -- 'admin', 'manager', 'accountant', 'viewer', 'staff'
  employee_id INTEGER REFERENCES employees(id),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  password_changed_at TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (for token-based auth)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL, -- 'expenses', 'payroll', 'reports', 'accounting', etc.
  action VARCHAR(50) NOT NULL,    -- 'create', 'read', 'update', 'delete', 'approve'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role, resource, action)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval Requests (for sensitive operations)
CREATE TABLE IF NOT EXISTS approval_requests (
  id SERIAL PRIMARY KEY,
  request_type VARCHAR(50) NOT NULL, -- 'expense', 'journal_entry', 'payment_batch', 'period_close'
  reference_type VARCHAR(50) NOT NULL,
  reference_id INTEGER NOT NULL,
  requested_by INTEGER REFERENCES users(id),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  notes TEXT
);

-- ============================================
-- 18. SETTINGS & CONFIGURATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS business_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type VARCHAR(20) DEFAULT 'text', -- 'text', 'number', 'boolean', 'json'
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 17. DOCUMENTS (Supabase Storage metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  bucket TEXT NOT NULL,
  object_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  sha256 TEXT,
  upload_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  uploaded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bucket, object_path)
);

-- Backfill for older deployments (safe if column already exists)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP;

-- ============================================
-- 18. EXPENSE DOCUMENTS (Many-to-many link)
-- ============================================
CREATE TABLE IF NOT EXISTS expense_documents (
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, document_id)
);

-- ============================================
-- 19. EXPENSE LINE ITEMS (Invoice/receipt details)
-- ============================================
CREATE TABLE IF NOT EXISTS expense_line_items (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  line_number INTEGER,
  raw_vendor_code TEXT,
  raw_description TEXT NOT NULL,
  quantity DECIMAL(12, 4),
  unit TEXT,
  unit_price DECIMAL(12, 4),
  line_total DECIMAL(12, 2),
  mapped_ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
  mapped_category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  mapping_confidence DECIMAL(3, 2) DEFAULT 0, -- 0-1 confidence score
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 20. VENDOR ITEM MAPPINGS ("Teach codes" system)
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_item_mappings (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL, -- 'exact_code', 'contains', 'regex', 'exact_desc'
  match_value TEXT NOT NULL,
  normalized_label TEXT,
  ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON expenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_records(pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_bank_trans_date ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_trans_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ap_vendor ON accounts_payable(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_status ON accounts_payable(status);
CREATE INDEX IF NOT EXISTS idx_ar_status ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_daily_revenue_date ON daily_revenue(date);
CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_counts(count_date);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient ON inventory_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_po ON inventory_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_lines_receipt ON inventory_receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_vendor ON ap_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_approval ON ap_invoices(approval_status);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_posting ON ap_invoices(posting_status);
CREATE INDEX IF NOT EXISTS idx_ap_invoice_lines_invoice ON ap_invoice_lines(ap_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_batches_status ON payment_batches(status);
CREATE INDEX IF NOT EXISTS idx_payment_batch_items_batch ON payment_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_schedules_employee ON schedules(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_timeclock_employee ON timeclock_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_timeclock_date ON timeclock_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_tip_records_employee ON tip_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_tip_records_date ON tip_records(shift_date);
CREATE INDEX IF NOT EXISTS idx_tip_pool_sessions_date ON tip_pool_sessions(pool_date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_documents_vendor ON documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(upload_status);
CREATE INDEX IF NOT EXISTS idx_expense_line_items_expense ON expense_line_items(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_line_items_ingredient ON expense_line_items(mapped_ingredient_id);
CREATE INDEX IF NOT EXISTS idx_vendor_item_mappings_vendor ON vendor_item_mappings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_item_mappings_active ON vendor_item_mappings(active);

-- ============================================
-- INSERT DEFAULT CHART OF ACCOUNTS
-- ============================================
INSERT INTO accounts (account_number, name, account_type, sub_type, is_tax_deductible, tax_category, description) VALUES
-- Assets (1000s)
('1000', 'Checking Account', 'asset', 'cash', false, NULL, 'Primary business checking'),
('1010', 'Savings Account', 'asset', 'cash', false, NULL, 'Business savings'),
('1020', 'Petty Cash', 'asset', 'cash', false, NULL, 'Cash on hand for small expenses'),
('1100', 'Accounts Receivable', 'asset', 'receivable', false, NULL, 'Money owed to us'),
('1200', 'Food Inventory', 'asset', 'inventory', false, NULL, 'Value of food on hand'),
('1210', 'Beverage Inventory', 'asset', 'inventory', false, NULL, 'Value of beverages on hand'),
('1220', 'Supplies Inventory', 'asset', 'inventory', false, NULL, 'Value of supplies on hand'),
('1300', 'Prepaid Expenses', 'asset', 'prepaid', false, NULL, 'Insurance, rent paid in advance'),
('1500', 'Kitchen Equipment', 'asset', 'fixed_asset', false, NULL, 'Ovens, refrigerators, etc.'),
('1510', 'Furniture & Fixtures', 'asset', 'fixed_asset', false, NULL, 'Tables, chairs, decor'),
('1520', 'Leasehold Improvements', 'asset', 'fixed_asset', false, NULL, 'Building modifications'),
('1600', 'Accumulated Depreciation', 'asset', 'contra_asset', false, NULL, 'Depreciation of fixed assets'),

-- Liabilities (2000s)
('2000', 'Accounts Payable', 'liability', 'payable', false, NULL, 'Money owed to vendors'),
('2100', 'Credit Card Payable', 'liability', 'payable', false, NULL, 'Business credit card balance'),
('2200', 'Sales Tax Payable', 'liability', 'payable', false, NULL, 'Collected sales tax'),
('2300', 'Payroll Taxes Payable', 'liability', 'payable', false, NULL, 'Withheld taxes to be paid'),
('2400', 'Gift Cards Outstanding', 'liability', 'deferred_revenue', false, NULL, 'Unredeemed gift card value'),
('2500', 'Loans Payable', 'liability', 'long_term', false, NULL, 'Business loans'),

-- Equity (3000s)
('3000', 'Owner Equity', 'equity', 'capital', false, NULL, 'Owner investment'),
('3100', 'Retained Earnings', 'equity', 'retained', false, NULL, 'Accumulated profits'),
('3200', 'Owner Draws', 'equity', 'draws', false, NULL, 'Money taken out by owner'),

-- Revenue (4000s)
('4000', 'Food Sales', 'revenue', 'sales', false, NULL, 'Revenue from food sales'),
('4010', 'Beverage Sales', 'revenue', 'sales', false, NULL, 'Non-alcoholic beverage sales'),
('4020', 'Alcohol Sales', 'revenue', 'sales', false, NULL, 'Beer, wine, spirits sales'),
('4100', 'Catering Revenue', 'revenue', 'service', false, NULL, 'Catering income'),
('4200', 'Gift Card Sales', 'revenue', 'deferred', false, NULL, 'Gift card purchases'),
('4300', 'Other Income', 'revenue', 'other', false, NULL, 'Miscellaneous income'),

-- Cost of Goods Sold (5000s)
('5000', 'Food Cost', 'expense', 'cogs', true, 'cost_of_goods_sold', 'Ingredients and raw food'),
('5010', 'Beverage Cost', 'expense', 'cogs', true, 'cost_of_goods_sold', 'Non-alcoholic beverage costs'),
('5020', 'Alcohol Cost', 'expense', 'cogs', true, 'cost_of_goods_sold', 'Beer, wine, spirits cost'),
('5100', 'Packaging & To-Go', 'expense', 'cogs', true, 'cost_of_goods_sold', 'Containers, bags, utensils'),

-- Labor Expenses (6000s)
('6000', 'Kitchen Wages', 'expense', 'payroll', true, 'wages', 'Kitchen staff wages'),
('6010', 'Server Wages', 'expense', 'payroll', true, 'wages', 'Server wages (before tips)'),
('6020', 'Management Salaries', 'expense', 'payroll', true, 'wages', 'Manager salaries'),
('6100', 'Payroll Taxes', 'expense', 'payroll', true, 'taxes', 'Employer payroll tax expense'),
('6110', 'Employee Benefits', 'expense', 'payroll', true, 'employee_benefits', 'Health insurance, etc.'),
('6120', 'Workers Compensation', 'expense', 'payroll', true, 'insurance', 'Workers comp insurance'),

-- Operating Expenses (7000s)
('7000', 'Rent', 'expense', 'operating', true, 'rent', 'Monthly rent payment'),
('7010', 'Utilities - Electric', 'expense', 'operating', true, 'utilities', 'Electricity'),
('7020', 'Utilities - Gas', 'expense', 'operating', true, 'utilities', 'Natural gas'),
('7030', 'Utilities - Water', 'expense', 'operating', true, 'utilities', 'Water and sewer'),
('7040', 'Phone & Internet', 'expense', 'operating', true, 'utilities', 'Communication services'),
('7050', 'Trash Removal', 'expense', 'operating', true, 'utilities', 'Garbage and recycling'),
('7100', 'Insurance - Liability', 'expense', 'operating', true, 'insurance', 'General liability insurance'),
('7110', 'Insurance - Property', 'expense', 'operating', true, 'insurance', 'Property insurance'),
('7200', 'Repairs & Maintenance', 'expense', 'operating', true, 'repairs', 'Equipment and building repairs'),
('7210', 'Cleaning & Janitorial', 'expense', 'operating', true, 'supplies', 'Cleaning supplies and services'),
('7220', 'Pest Control', 'expense', 'operating', true, 'supplies', 'Pest control services'),
('7300', 'Equipment Rental', 'expense', 'operating', true, 'rent', 'Leased equipment'),
('7310', 'Linen & Laundry', 'expense', 'operating', true, 'supplies', 'Napkins, tablecloths, aprons'),
('7400', 'POS System & Tech', 'expense', 'operating', true, 'supplies', 'Software subscriptions'),
('7410', 'Credit Card Fees', 'expense', 'operating', true, 'commissions', 'Payment processing fees'),
('7500', 'Licenses & Permits', 'expense', 'operating', true, 'licenses', 'Business licenses, health permits'),
('7510', 'Professional Fees', 'expense', 'operating', true, 'legal_professional', 'Accountant, lawyer fees'),
('7600', 'Office Supplies', 'expense', 'operating', true, 'supplies', 'Paper, pens, office items'),
('7610', 'Smallwares', 'expense', 'operating', true, 'supplies', 'Plates, glasses, utensils'),

-- Marketing Expenses (8000s)
('8000', 'Advertising - Print', 'expense', 'marketing', true, 'advertising', 'Newspapers, magazines, flyers'),
('8010', 'Advertising - Digital', 'expense', 'marketing', true, 'advertising', 'Google, Facebook, Instagram ads'),
('8020', 'Advertising - Radio/TV', 'expense', 'marketing', true, 'advertising', 'Broadcast advertising'),
('8100', 'Social Media Marketing', 'expense', 'marketing', true, 'advertising', 'Paid social media campaigns'),
('8110', 'Website & SEO', 'expense', 'marketing', true, 'advertising', 'Website hosting, SEO services'),
('8200', 'Events & Sponsorships', 'expense', 'marketing', true, 'advertising', 'Community events, sports teams'),
('8210', 'Promotions & Discounts', 'expense', 'marketing', true, 'advertising', 'Promotional costs'),
('8300', 'Loyalty Program', 'expense', 'marketing', true, 'advertising', 'Rewards program costs'),
('8400', 'Photography & Video', 'expense', 'marketing', true, 'advertising', 'Menu photos, promotional videos'),
('8500', 'Public Relations', 'expense', 'marketing', true, 'advertising', 'PR services'),

-- Other Expenses (9000s)
('9000', 'Bank Charges', 'expense', 'other', true, 'bank_charges', 'Bank fees'),
('9010', 'Interest Expense', 'expense', 'other', true, 'interest', 'Loan interest'),
('9100', 'Depreciation Expense', 'expense', 'other', true, 'depreciation', 'Asset depreciation'),
('9200', 'Miscellaneous', 'expense', 'other', true, 'other_expenses', 'Other business expenses'),
('9300', 'Owner/Manager Meals', 'expense', 'other', true, 'meals', '50% deductible meals'),
('9400', 'Training & Development', 'expense', 'other', true, 'education', 'Staff training'),
('9500', 'Travel & Transportation', 'expense', 'other', true, 'travel', 'Business travel')

ON CONFLICT (account_number) DO NOTHING;

-- ============================================
-- INSERT DEFAULT EXPENSE CATEGORIES
-- ============================================
INSERT INTO expense_categories (name, expense_type, is_tax_deductible, tax_category, description) VALUES
-- COGS Categories
('Food & Ingredients', 'cogs', true, 'cost_of_goods_sold', 'All food ingredient purchases'),
('Beverages (Non-Alcoholic)', 'cogs', true, 'cost_of_goods_sold', 'Coffee, tea, soft drinks, juice'),
('Alcohol & Spirits', 'cogs', true, 'cost_of_goods_sold', 'Beer, wine, liquor'),
('Packaging & Supplies', 'cogs', true, 'cost_of_goods_sold', 'To-go containers, bags, napkins'),

-- Operating Categories
('Rent & Lease', 'operating', true, 'rent', 'Monthly rent payments'),
('Utilities', 'operating', true, 'utilities', 'Electric, gas, water, internet'),
('Insurance', 'operating', true, 'insurance', 'Liability, property, workers comp'),
('Repairs & Maintenance', 'operating', true, 'repairs', 'Equipment and facility repairs'),
('Cleaning & Sanitation', 'operating', true, 'supplies', 'Cleaning supplies, janitorial services'),
('Equipment & Smallwares', 'operating', true, 'supplies', 'Kitchen tools, plates, glasses'),
('Technology & POS', 'operating', true, 'supplies', 'Software, POS system, tech'),
('Licenses & Permits', 'operating', true, 'licenses', 'Business licenses, health permits'),
('Professional Services', 'operating', true, 'legal_professional', 'Accountant, lawyer, consultant'),
('Credit Card Processing', 'operating', true, 'commissions', 'Payment processing fees'),
('Bank Fees', 'operating', true, 'bank_charges', 'Bank service charges'),

-- Marketing Categories
('Print Advertising', 'marketing', true, 'advertising', 'Newspapers, flyers, menus'),
('Digital Advertising', 'marketing', true, 'advertising', 'Google Ads, Facebook Ads'),
('Social Media', 'marketing', true, 'advertising', 'Paid social media campaigns'),
('Events & Sponsorships', 'marketing', true, 'advertising', 'Community events, sports teams'),
('Promotions', 'marketing', true, 'advertising', 'Coupons, special offers'),
('Website & Online', 'marketing', true, 'advertising', 'Website hosting, SEO, online listings'),
('Photography & Video', 'marketing', true, 'advertising', 'Menu photography, video production'),

-- Payroll Categories
('Kitchen Staff Wages', 'payroll', true, 'wages', 'Chefs, cooks, prep staff'),
('Front of House Wages', 'payroll', true, 'wages', 'Servers, hosts, bussers'),
('Management Salaries', 'payroll', true, 'wages', 'Managers and supervisors'),
('Payroll Taxes', 'payroll', true, 'taxes', 'Employer portion of taxes'),
('Employee Benefits', 'payroll', true, 'employee_benefits', 'Health insurance, retirement'),

-- Other Categories
('Vehicle & Delivery', 'other', true, 'car_expenses', 'Delivery vehicle, mileage'),
('Travel & Meals', 'other', true, 'travel', 'Business travel, client meals'),
('Training & Education', 'other', true, 'education', 'Staff training, certifications'),
('Miscellaneous', 'other', true, 'other_expenses', 'Other business expenses')

ON CONFLICT (name) DO NOTHING;

-- ============================================
-- INSERT DEFAULT BUSINESS SETTINGS
-- ============================================
INSERT INTO business_settings (setting_key, setting_value, setting_type, description) VALUES
('business_name', 'My Restaurant', 'text', 'Restaurant name'),
('business_address', '', 'text', 'Business address'),
('business_phone', '', 'text', 'Business phone number'),
('tax_id', '', 'text', 'EIN or Tax ID'),
('fiscal_year_start_month', '1', 'number', 'Month fiscal year starts (1-12)'),
('default_hourly_wage', '15.00', 'number', 'Default hourly wage for labor calculations'),
('target_food_cost_percent', '30', 'number', 'Target food cost percentage'),
('target_labor_cost_percent', '30', 'number', 'Target labor cost percentage'),
('target_prime_cost_percent', '60', 'number', 'Target prime cost (food + labor)'),
('sales_tax_rate', '0', 'number', 'Local sales tax rate (percentage)')

ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- INSERT DEFAULT ROLE PERMISSIONS
-- ============================================
INSERT INTO role_permissions (role, resource, action) VALUES
-- Admin: full access
('admin', 'all', 'create'), ('admin', 'all', 'read'), ('admin', 'all', 'update'), ('admin', 'all', 'delete'), ('admin', 'all', 'approve'),

-- Manager: most operations
('manager', 'expenses', 'create'), ('manager', 'expenses', 'read'), ('manager', 'expenses', 'update'), ('manager', 'expenses', 'approve'),
('manager', 'inventory', 'create'), ('manager', 'inventory', 'read'), ('manager', 'inventory', 'update'),
('manager', 'labor', 'create'), ('manager', 'labor', 'read'), ('manager', 'labor', 'update'), ('manager', 'labor', 'approve'),
('manager', 'reports', 'read'),
('manager', 'vendors', 'create'), ('manager', 'vendors', 'read'), ('manager', 'vendors', 'update'),
('manager', 'payroll', 'read'),

-- Accountant: financial operations
('accountant', 'expenses', 'create'), ('accountant', 'expenses', 'read'), ('accountant', 'expenses', 'update'), ('accountant', 'expenses', 'approve'),
('accountant', 'accounting', 'create'), ('accountant', 'accounting', 'read'), ('accountant', 'accounting', 'update'), ('accountant', 'accounting', 'approve'),
('accountant', 'ap', 'create'), ('accountant', 'ap', 'read'), ('accountant', 'ap', 'update'), ('accountant', 'ap', 'approve'),
('accountant', 'ledger', 'create'), ('accountant', 'ledger', 'read'), ('accountant', 'ledger', 'update'),
('accountant', 'reports', 'read'),
('accountant', 'payroll', 'read'), ('accountant', 'payroll', 'create'), ('accountant', 'payroll', 'approve'),
('accountant', 'tax', 'read'),

-- Staff: limited access
('staff', 'labor', 'read'),
('staff', 'timeclock', 'create'), ('staff', 'timeclock', 'read'),

-- Viewer: read-only
('viewer', 'reports', 'read'),
('viewer', 'expenses', 'read'),
('viewer', 'inventory', 'read')

ON CONFLICT (role, resource, action) DO NOTHING;

-- ============================================
-- POS INTEGRATION TABLES
-- ============================================

-- POS Configuration
CREATE TABLE IF NOT EXISTS pos_configurations (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL, -- 'square', 'toast', 'clover', 'revel', 'lightspeed', 'custom'
  name VARCHAR(255) NOT NULL,
  api_key_encrypted TEXT,
  location_id VARCHAR(100),
  webhook_secret TEXT,
  last_sync_at TIMESTAMP,
  sync_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
  sync_error TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- POS Sales Import (normalized transactions)
CREATE TABLE IF NOT EXISTS pos_transactions (
  id SERIAL PRIMARY KEY,
  pos_config_id INTEGER REFERENCES pos_configurations(id),
  external_id VARCHAR(255) NOT NULL, -- ID from POS system
  transaction_date TIMESTAMP NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'sale', 'refund', 'void', 'exchange'
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50), -- 'cash', 'card', 'gift_card', 'split', 'other'
  card_brand VARCHAR(50),
  card_last_four VARCHAR(4),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  employee_external_id VARCHAR(100),
  employee_id INTEGER REFERENCES employees(id),
  raw_data JSONB,
  import_batch_id INTEGER,
  synced_to_gl BOOLEAN DEFAULT false,
  gl_journal_entry_id INTEGER REFERENCES journal_entries(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pos_config_id, external_id)
);

-- POS Transaction Items
CREATE TABLE IF NOT EXISTS pos_transaction_items (
  id SERIAL PRIMARY KEY,
  pos_transaction_id INTEGER NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
  external_item_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 4) NOT NULL,
  unit_price DECIMAL(10, 4) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  category VARCHAR(100),
  menu_item_id INTEGER REFERENCES menu_items(id),
  modifiers JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- POS Settlements (daily closeouts)
CREATE TABLE IF NOT EXISTS pos_settlements (
  id SERIAL PRIMARY KEY,
  pos_config_id INTEGER REFERENCES pos_configurations(id),
  external_id VARCHAR(255),
  settlement_date DATE NOT NULL,
  cash_sales DECIMAL(12, 2) DEFAULT 0,
  card_sales DECIMAL(12, 2) DEFAULT 0,
  gift_card_sales DECIMAL(12, 2) DEFAULT 0,
  other_sales DECIMAL(12, 2) DEFAULT 0,
  total_sales DECIMAL(12, 2) NOT NULL,
  total_refunds DECIMAL(12, 2) DEFAULT 0,
  total_discounts DECIMAL(12, 2) DEFAULT 0,
  total_tips DECIMAL(12, 2) DEFAULT 0,
  total_tax DECIMAL(12, 2) DEFAULT 0,
  net_sales DECIMAL(12, 2) NOT NULL,
  transaction_count INTEGER DEFAULT 0,
  daily_revenue_id INTEGER REFERENCES daily_revenue(id),
  is_posted BOOLEAN DEFAULT false,
  posted_at TIMESTAMP,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pos_config_id, settlement_date)
);

-- POS Menu Item Mappings (link internal menu items to POS product IDs)
CREATE TABLE IF NOT EXISTS pos_menu_mappings (
  id SERIAL PRIMARY KEY,
  pos_config_id INTEGER NOT NULL REFERENCES pos_configurations(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pos_config_id, menu_item_id),
  UNIQUE(pos_config_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_transactions_date ON pos_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_config ON pos_transactions(pos_config_id);
CREATE INDEX IF NOT EXISTS idx_pos_settlements_date ON pos_settlements(settlement_date);
CREATE INDEX IF NOT EXISTS idx_pos_menu_mappings_config ON pos_menu_mappings(pos_config_id);

