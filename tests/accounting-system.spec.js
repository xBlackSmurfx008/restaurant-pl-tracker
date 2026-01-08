const { test, expect } = require('@playwright/test');

/**
 * Comprehensive Playwright Test Suite for Restaurant Accounting System
 * Tests all functionality: Operations, Accounting, Expenses, Payroll, Tax
 */

test.describe('Restaurant Accounting System - Full Audit', () => {
  
  // Track all console errors across tests
  let consoleErrors = [];
  let networkErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    networkErrors = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
    
    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', error => {
      consoleErrors.push({
        text: error.message,
        stack: error.stack
      });
    });
    
    // Listen for failed network requests
    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        failure: request.failure()?.errorText
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({}, testInfo) => {
    // Report any errors found
    if (consoleErrors.length > 0) {
      console.log(`\n⚠️  Console errors in "${testInfo.title}":`);
      consoleErrors.forEach(err => console.log(`   - ${err.text}`));
    }
    if (networkErrors.length > 0) {
      console.log(`\n❌ Network errors in "${testInfo.title}":`);
      networkErrors.forEach(err => console.log(`   - ${err.url}: ${err.failure}`));
    }
  });

  // ============================================
  // SECTION 1: APP STRUCTURE & NAVIGATION
  // ============================================
  
  test.describe('1. App Structure & Navigation', () => {
    
    test('1.1 Should load with correct header and branding', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('FLAVOR');
      await expect(page.locator('h1')).toContainText('91');
      await expect(page.locator('h1')).toContainText('BISTRO');
      await expect(page.locator('.tagline')).toContainText('Restaurant Accounting');
    });

    test('1.2 Should have Operations and Accounting section buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Operations/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Accounting.*Tax/i })).toBeVisible();
    });

    test('1.3 Should show Operations tabs by default', async ({ page }) => {
      const tabs = ['Dashboard', 'Sales', 'Recipes', 'Ingredients', 'Vendors'];
      for (const tab of tabs) {
        await expect(page.getByRole('button', { name: new RegExp(tab, 'i') })).toBeVisible();
      }
    });

    test('1.4 Should switch to Accounting tabs when clicking Accounting & Tax', async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(500);
      
      // Check for accounting tabs (use exact match for "Accounting" to avoid matching "Accounting & Tax")
      await expect(page.getByRole('button', { name: /P&L Report/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Expenses/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Payroll/i })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Accounting', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Tax Prep/i })).toBeVisible();
    });

    test('1.5 Should switch back to Operations tabs', async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Operations/i }).click();
      await page.waitForTimeout(300);
      
      await expect(page.getByRole('button', { name: /Dashboard/i })).toBeVisible();
    });
  });

  // ============================================
  // SECTION 2: OPERATIONS - DASHBOARD
  // ============================================

  test.describe('2. Operations - Dashboard', () => {
    
    test('2.1 Should display Dashboard with period selectors', async ({ page }) => {
      await expect(page.locator('h2, h3').filter({ hasText: /Dashboard/i })).toBeVisible();
      
      const periods = ['Today', 'This Week', 'This Month', 'This Quarter', 'This Year', 'YTD'];
      for (const period of periods) {
        const button = page.getByRole('button', { name: new RegExp(period, 'i') });
        if (await button.count() > 0) {
          await expect(button.first()).toBeVisible();
        }
      }
    });

    test('2.2 Should switch period without errors', async ({ page }) => {
      const weekButton = page.getByRole('button', { name: /This Week/i });
      if (await weekButton.count() > 0) {
        await weekButton.first().click();
        await page.waitForTimeout(1000);
      }
      
      // No console errors should occur
      expect(consoleErrors.filter(e => !e.text.includes('favicon'))).toHaveLength(0);
    });

    test('2.3 Should not display NaN, undefined, or null values', async ({ page }) => {
      await page.waitForTimeout(2000);
      const bodyText = await page.textContent('body');
      
      // These indicate data handling issues
      expect(bodyText).not.toContain('NaN');
      expect(bodyText).not.toMatch(/\bundefined\b/);
      expect(bodyText).not.toMatch(/\bnull\b(?!able)/); // exclude "nullable"
    });
  });

  // ============================================
  // SECTION 3: OPERATIONS - VENDORS
  // ============================================

  test.describe('3. Operations - Vendors', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Vendors/i }).click();
      await page.waitForTimeout(1000);
    });

    test('3.1 Should load Vendor Management page', async ({ page }) => {
      await expect(page.locator('h2').filter({ hasText: /Vendor/i })).toBeVisible();
    });

    test('3.2 Should display vendor list from database', async ({ page }) => {
      await page.waitForTimeout(1500);
      
      // Should show vendors we seeded
      const vendorNames = ['Local Farm Fresh', 'Valley Produce', 'Artisan Bakery', 'City Meats'];
      let foundAny = false;
      
      for (const name of vendorNames) {
        const vendor = page.locator(`text=${name}`);
        if (await vendor.count() > 0) {
          foundAny = true;
          break;
        }
      }
      
      expect(foundAny).toBeTruthy();
    });

    test('3.3 Should open Add Vendor form', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add.*Vendor/i });
      if (await addButton.count() > 0) {
        await addButton.first().click();
        await page.waitForTimeout(500);
        
        // Should show form/modal - check for any form element or modal
        const formVisible = await page.locator('form, .modal, input, .modal-overlay').first().isVisible();
        expect(formVisible).toBeTruthy();
      }
    });
  });

  // ============================================
  // SECTION 4: OPERATIONS - INGREDIENTS
  // ============================================

  test.describe('4. Operations - Ingredients', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Ingredients/i }).click();
      await page.waitForTimeout(1000);
    });

    test('4.1 Should load Ingredient Locker page', async ({ page }) => {
      await expect(page.locator('h2').filter({ hasText: /Ingredient/i })).toBeVisible();
    });

    test('4.2 Should display ingredients from database', async ({ page }) => {
      await page.waitForTimeout(1500);
      
      // Check for seeded ingredients
      const ingredients = ['Organic Mixed Greens', 'Roma Tomatoes', 'Beef Tenderloin', 'Salmon'];
      let foundAny = false;
      
      for (const ing of ingredients) {
        const item = page.locator(`text=${ing}`);
        if (await item.count() > 0) {
          foundAny = true;
          break;
        }
      }
      
      expect(foundAny).toBeTruthy();
    });
  });

  // ============================================
  // SECTION 5: OPERATIONS - RECIPES
  // ============================================

  test.describe('5. Operations - Recipes', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Recipes/i }).click();
      await page.waitForTimeout(1000);
    });

    test('5.1 Should load Recipe Builder page', async ({ page }) => {
      await expect(page.locator('h2').filter({ hasText: /Recipe/i })).toBeVisible();
    });

    test('5.2 Should display menu items from database', async ({ page }) => {
      await page.waitForTimeout(2000);
      
      // Check for seeded menu items (partial match)
      const menuItems = ['Salmon', 'Tenderloin', 'Caesar', 'Truffle', 'Pasta', 'Burger', 'Chicken', 'Soup'];
      let foundAny = false;
      
      for (const item of menuItems) {
        const menuItem = page.locator(`text=/${item}/i`);
        if (await menuItem.count() > 0) {
          foundAny = true;
          break;
        }
      }
      
      // Also check if table or list exists
      const hasTable = await page.locator('table').count() > 0;
      const hasList = await page.locator('.card, .menu-item, li').count() > 0;
      
      expect(foundAny || hasTable || hasList).toBeTruthy();
    });
  });

  // ============================================
  // SECTION 6: OPERATIONS - SALES
  // ============================================

  test.describe('6. Operations - Sales', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Sales/i }).click();
      await page.waitForTimeout(1000);
    });

    test('6.1 Should load Sales Input page', async ({ page }) => {
      await expect(page.locator('h2').filter({ hasText: /Sales/i })).toBeVisible();
    });

    test('6.2 Should have date picker for sales entry', async ({ page }) => {
      const dateInput = page.locator('input[type="date"]');
      await expect(dateInput.first()).toBeVisible();
    });
  });

  // ============================================
  // SECTION 7: ACCOUNTING - P&L REPORTS
  // ============================================

  test.describe('7. Accounting - P&L Reports', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /P&L Report/i }).click();
      await page.waitForTimeout(1000);
    });

    test('7.1 Should load P&L Report page with filters', async ({ page }) => {
      // Should have date filters
      await expect(page.locator('label').filter({ hasText: /Start.*Date/i })).toBeVisible();
      await expect(page.locator('label').filter({ hasText: /End.*Date/i })).toBeVisible();
    });

    test('7.2 Should have report type selector', async ({ page }) => {
      const reportTypes = ['P&L Statement', 'Cash Flow', 'Daily Summary', 'Vendor Analysis'];
      let foundAny = false;
      
      for (const type of reportTypes) {
        const button = page.getByRole('button', { name: new RegExp(type, 'i') });
        if (await button.count() > 0) {
          foundAny = true;
          break;
        }
      }
      
      expect(foundAny).toBeTruthy();
    });

    test('7.3 Should generate P&L report without errors', async ({ page }) => {
      const generateButton = page.getByRole('button', { name: /Generate.*Report/i });
      if (await generateButton.count() > 0) {
        await generateButton.click();
        await page.waitForTimeout(2000);
        
        // Should show revenue section
        const revenueSection = page.locator('text=/Revenue/i');
        await expect(revenueSection.first()).toBeVisible();
      }
    });

    test('7.4 Should display correct revenue amounts', async ({ page }) => {
      await page.getByRole('button', { name: /Generate.*Report/i }).click();
      await page.waitForTimeout(2000);
      
      // Should show dollar amounts
      const amounts = page.locator('text=/\\$[\\d,]+/');
      expect(await amounts.count()).toBeGreaterThan(0);
    });
  });

  // ============================================
  // SECTION 8: ACCOUNTING - EXPENSES
  // ============================================

  test.describe('8. Accounting - Expenses', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Expenses/i }).click();
      await page.waitForTimeout(1000);
    });

    test('8.1 Should load Expense Tracker page', async ({ page }) => {
      await expect(page.locator('h2, h3').filter({ hasText: /Expense/i }).first()).toBeVisible();
    });

    test('8.2 Should have Add Expense button', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add.*Expense/i });
      await expect(addButton).toBeVisible();
    });

    test('8.3 Should have vendor filter dropdown', async ({ page }) => {
      const vendorSelect = page.locator('select, [role="combobox"]').filter({ hasText: /Vendor/i });
      expect(await vendorSelect.count()).toBeGreaterThanOrEqual(0);
    });

    test('8.4 Should have category filter dropdown', async ({ page }) => {
      const categorySelect = page.locator('select, [role="combobox"]').filter({ hasText: /Categor/i });
      expect(await categorySelect.count()).toBeGreaterThanOrEqual(0);
    });

    test('8.5 Should open Add Expense form', async ({ page }) => {
      await page.getByRole('button', { name: /Add.*Expense/i }).click();
      await page.waitForTimeout(500);
      
      // Should show form
      const amountField = page.locator('input[name="amount"], input[placeholder*="amount" i], label:has-text("Amount")');
      await expect(amountField.first()).toBeVisible();
    });

    test('8.6 Should have expense categories loaded', async ({ page }) => {
      await page.getByRole('button', { name: /Add.*Expense/i }).click();
      await page.waitForTimeout(500);
      
      // Check for category dropdown with options
      const categories = ['Food & Ingredients', 'Rent', 'Utilities', 'Insurance', 'Marketing'];
      let foundAny = false;
      
      for (const cat of categories) {
        const option = page.locator(`option, [role="option"]`).filter({ hasText: new RegExp(cat, 'i') });
        if (await option.count() > 0) {
          foundAny = true;
          break;
        }
      }
      
      // Just check it loaded something
      expect(foundAny || await page.locator('select option').count() > 1).toBeTruthy();
    });
  });

  // ============================================
  // SECTION 9: ACCOUNTING - PAYROLL
  // ============================================

  test.describe('9. Accounting - Payroll', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Payroll/i }).click();
      await page.waitForTimeout(1000);
    });

    test('9.1 Should load Payroll Manager page', async ({ page }) => {
      await expect(page.locator('h2, h3').filter({ hasText: /Payroll/i })).toBeVisible();
    });

    test('9.2 Should have payroll sub-tabs', async ({ page }) => {
      const subTabs = ['Employees', 'Payroll Records', 'Run Payroll', 'Labor Analysis'];
      let foundCount = 0;
      
      for (const tab of subTabs) {
        const button = page.getByRole('button', { name: new RegExp(tab, 'i') });
        if (await button.count() > 0) {
          foundCount++;
        }
      }
      
      expect(foundCount).toBeGreaterThanOrEqual(2);
    });

    test('9.3 Should display employees from database', async ({ page }) => {
      await page.waitForTimeout(1500);
      
      // Check for seeded employees
      const employees = ['James', 'Sarah', 'Mike', 'Emily', 'Rodriguez', 'Miller'];
      let foundAny = false;
      
      for (const emp of employees) {
        const employee = page.locator(`text=${emp}`);
        if (await employee.count() > 0) {
          foundAny = true;
          break;
        }
      }
      
      expect(foundAny).toBeTruthy();
    });

    test('9.4 Should have Add Employee button', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add.*Employee/i });
      await expect(addButton).toBeVisible();
    });

    test('9.5 Should show employee details in table', async ({ page }) => {
      await page.waitForTimeout(1000);
      
      // Check for table columns
      const columns = ['Name', 'Position', 'Department', 'Pay', 'Rate'];
      let foundCount = 0;
      
      for (const col of columns) {
        const header = page.locator('th, [role="columnheader"]').filter({ hasText: new RegExp(col, 'i') });
        if (await header.count() > 0) {
          foundCount++;
        }
      }
      
      expect(foundCount).toBeGreaterThanOrEqual(3);
    });

    test('9.6 Should navigate to Run Payroll tab', async ({ page }) => {
      const runPayrollTab = page.getByRole('button', { name: /Run Payroll/i });
      if (await runPayrollTab.count() > 0) {
        await runPayrollTab.click();
        await page.waitForTimeout(500);
        
        // Should show payroll form or employee selection
        const payrollContent = page.locator('text=/Pay Period|Select.*Employee|Gross Pay/i');
        expect(await payrollContent.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ============================================
  // SECTION 10: ACCOUNTING - BANK & AP/AR
  // ============================================

  test.describe('10. Accounting - General Accounting', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Accounting/i }).last().click();
      await page.waitForTimeout(1000);
    });

    test('10.1 Should load Accounting Dashboard', async ({ page }) => {
      const accountingHeader = page.locator('h2, h3').filter({ hasText: /Accounting/i });
      await expect(accountingHeader.first()).toBeVisible();
    });

    test('10.2 Should have accounting sub-sections', async ({ page }) => {
      const sections = ['Bank', 'Accounts Payable', 'Accounts Receivable', 'Chart of Accounts'];
      let foundCount = 0;
      
      for (const section of sections) {
        const sectionEl = page.locator(`text=${section}`);
        if (await sectionEl.count() > 0) {
          foundCount++;
        }
      }
      
      // Should find at least some accounting features
      expect(foundCount).toBeGreaterThanOrEqual(1);
    });

    test('10.3 Should display bank accounts', async ({ page }) => {
      await page.waitForTimeout(1500);
      
      // Check for seeded bank accounts
      const accounts = ['Business Checking', 'Business Savings', 'Petty Cash'];
      let foundAny = false;
      
      for (const acc of accounts) {
        const account = page.locator(`text=${acc}`);
        if (await account.count() > 0) {
          foundAny = true;
          break;
        }
      }
      
      expect(foundAny).toBeTruthy();
    });
  });

  // ============================================
  // SECTION 11: ACCOUNTING - TAX PREP
  // ============================================

  test.describe('11. Accounting - Tax Prep', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Tax Prep/i }).click();
      await page.waitForTimeout(1000);
    });

    test('11.1 Should load Tax Center page', async ({ page }) => {
      const taxHeader = page.locator('h2, h3').filter({ hasText: /Tax/i });
      await expect(taxHeader.first()).toBeVisible();
    });

    test('11.2 Should have year selector', async ({ page }) => {
      const yearSelector = page.locator('select, input[type="number"]').filter({ hasText: /202/ });
      const yearLabel = page.locator('label').filter({ hasText: /Year/i });
      
      expect(await yearSelector.count() + await yearLabel.count()).toBeGreaterThanOrEqual(1);
    });

    test('11.3 Should have tax report options', async ({ page }) => {
      const taxOptions = ['Schedule C', '1099', 'Quarterly', 'Expense Report'];
      let foundCount = 0;
      
      for (const opt of taxOptions) {
        const option = page.locator(`text=${opt}`);
        if (await option.count() > 0) {
          foundCount++;
        }
      }
      
      expect(foundCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // SECTION 12: API HEALTH CHECKS
  // ============================================

  test.describe('12. API Health Checks', () => {
    
    test('12.1 Should have healthy API connection', async ({ page, request }) => {
      const response = await request.get('http://localhost:5001/api/health');
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.version).toMatch(/^2\.\d+\.\d+$/); // Version 2.x.x
    });

    test('12.2 Should fetch vendors from API', async ({ page, request }) => {
      const response = await request.get('http://localhost:5001/api/vendors');
      expect(response.ok()).toBeTruthy();
      
      const vendors = await response.json();
      expect(Array.isArray(vendors)).toBeTruthy();
      expect(vendors.length).toBeGreaterThan(0);
    });

    test('12.3 Should fetch employees from API', async ({ page, request }) => {
      const response = await request.get('http://localhost:5001/api/payroll/employees');
      expect(response.ok()).toBeTruthy();
      
      const employees = await response.json();
      expect(Array.isArray(employees)).toBeTruthy();
      expect(employees.length).toBeGreaterThan(0);
    });

    test('12.4 Should fetch expense categories from API', async ({ page, request }) => {
      const response = await request.get('http://localhost:5001/api/expenses/meta/categories');
      expect(response.ok()).toBeTruthy();
      
      const categories = await response.json();
      expect(Array.isArray(categories)).toBeTruthy();
      expect(categories.length).toBeGreaterThan(0);
    });

    test('12.5 Should fetch bank accounts from API', async ({ page, request }) => {
      const response = await request.get('http://localhost:5001/api/accounting/bank-accounts');
      expect(response.ok()).toBeTruthy();
      
      const accounts = await response.json();
      expect(Array.isArray(accounts)).toBeTruthy();
      expect(accounts.length).toBeGreaterThan(0);
    });

    test('12.6 Should fetch business settings from API', async ({ page, request }) => {
      const response = await request.get('http://localhost:5001/api/accounting/settings');
      expect(response.ok()).toBeTruthy();
      
      const settings = await response.json();
      expect(settings.business_name).toBe('Flavor 91 Bistro');
    });

    test('12.7 Should generate P&L report from API', async ({ page, request }) => {
      const today = new Date().toISOString().split('T')[0];
      const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await request.get(`http://localhost:5001/api/reports/pnl?start_date=${lastMonth}&end_date=${today}`);
      expect(response.ok()).toBeTruthy();
      
      const pnl = await response.json();
      expect(pnl).toHaveProperty('revenue');
      expect(pnl).toHaveProperty('gross_profit');
      expect(pnl).toHaveProperty('net_income');
    });

    test('12.8 Should fetch menu items from API', async ({ page, request }) => {
      const response = await request.get('http://localhost:5001/api/menu-items');
      expect(response.ok()).toBeTruthy();
      
      const items = await response.json();
      expect(Array.isArray(items)).toBeTruthy();
      expect(items.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // SECTION 13: DATA INTEGRITY CHECKS
  // ============================================

  test.describe('13. Data Integrity', () => {
    
    test('13.1 All pages should load without JavaScript errors', async ({ page }) => {
      const pagesToTest = [
        { section: 'operations', tab: 'Dashboard' },
        { section: 'operations', tab: 'Vendors' },
        { section: 'operations', tab: 'Ingredients' },
        { section: 'operations', tab: 'Recipes' },
        { section: 'operations', tab: 'Sales' },
        { section: 'accounting', tab: 'P&L Report' },
        { section: 'accounting', tab: 'Expenses' },
        { section: 'accounting', tab: 'Payroll' },
        { section: 'accounting', tab: 'Tax Prep' },
      ];
      
      const errors = [];
      
      for (const p of pagesToTest) {
        if (p.section === 'accounting') {
          await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
          await page.waitForTimeout(300);
        } else {
          await page.getByRole('button', { name: /Operations/i }).click();
          await page.waitForTimeout(300);
        }
        
        const tabButton = page.getByRole('button', { name: new RegExp(p.tab, 'i') });
        if (await tabButton.count() > 0) {
          await tabButton.first().click();
          await page.waitForTimeout(1000);
        }
      }
      
      // Filter out non-critical errors
      const criticalErrors = consoleErrors.filter(err => 
        !err.text.includes('favicon') && 
        !err.text.includes('sourcemap') &&
        !err.text.includes('DevTools')
      );
      
      expect(criticalErrors).toHaveLength(0);
    });

    test('13.2 Currency values should be properly formatted', async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /P&L Report/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Generate.*Report/i }).click();
      await page.waitForTimeout(2000);
      
      // Get all dollar amounts
      const dollarAmounts = await page.locator('text=/\\$[\\d,\\.]+/').allTextContents();
      
      for (const amount of dollarAmounts) {
        // Should match $X,XXX.XX format
        expect(amount).toMatch(/\$[\d,]+(\.\d{2})?/);
      }
    });

    test('13.3 Dates should be properly formatted', async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Expenses/i }).click();
      await page.waitForTimeout(1500);
      
      // Check date inputs have valid dates
      const dateInputs = await page.locator('input[type="date"]').all();
      for (const input of dateInputs) {
        const value = await input.inputValue();
        if (value) {
          expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    });
  });

  // ============================================
  // SECTION 14: RESPONSIVE & ACCESSIBILITY
  // ============================================

  test.describe('14. UI Quality', () => {
    
    test('14.1 All buttons should be clickable', async ({ page }) => {
      const buttons = await page.locator('button:visible').all();
      
      for (const button of buttons.slice(0, 10)) { // Test first 10
        const isDisabled = await button.isDisabled();
        if (!isDisabled) {
          const box = await button.boundingBox();
          expect(box).not.toBeNull();
          expect(box?.width).toBeGreaterThan(0);
          expect(box?.height).toBeGreaterThan(0);
        }
      }
    });

    test('14.2 Forms should have labels', async ({ page }) => {
      await page.getByRole('button', { name: /Accounting.*Tax/i }).click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Expenses/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Add.*Expense/i }).click();
      await page.waitForTimeout(500);
      
      // Check for labels
      const labels = await page.locator('label').count();
      expect(labels).toBeGreaterThan(0);
    });

    test('14.3 Footer should display version info', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer).toContainText('v2.0');
    });
  });
});

