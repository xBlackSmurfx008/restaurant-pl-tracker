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
-- 15. SETTINGS & CONFIGURATIONS
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
  upload_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'uploaded', 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bucket, object_path)
);

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

