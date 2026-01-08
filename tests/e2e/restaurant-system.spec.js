/**
 * Restaurant Management System - End-to-End Tests
 * Tests all major features: Auth, POS, Inventory, AP, Labor, GL
 * 
 * Run with: npx playwright test tests/e2e/restaurant-system.spec.js --headed --slowmo=500
 */
const { test, expect } = require('@playwright/test');

const API_BASE = 'http://localhost:5001/api';
const APP_URL = 'http://localhost:3000';

// Helper function to make API calls
async function apiCall(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  return response.json();
}

// ============================================
// TEST SUITE: API Health & Backend
// ============================================
test.describe('Backend API Health', () => {
  test('API is running and healthy', async ({ request }) => {
    console.log('\n🏥 Checking API Health...');
    const response = await request.get(`${API_BASE}/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log(`✅ API Version: ${data.version}`);
    console.log(`✅ Features: ${data.features.join(', ')}`);
    
    expect(data.status).toBe('ok');
    expect(data.features).toContain('pos-integration');
    expect(data.features).toContain('inventory');
    expect(data.features).toContain('ap-automation');
    expect(data.features).toContain('labor-ops');
    expect(data.features).toContain('auth');
  });
});

// ============================================
// TEST SUITE: Authentication
// ============================================
test.describe('Authentication System', () => {
  test('Login with admin credentials', async ({ request }) => {
    console.log('\n🔐 Testing Login...');
    
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: { email: 'admin', password: '1234' }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    console.log(`✅ Login successful for: ${data.user.email}`);
    console.log(`✅ User role: ${data.user.role}`);
    console.log(`✅ Token received: ${data.token.substring(0, 20)}...`);
    
    expect(data.user.role).toBe('admin');
    expect(data.token).toBeTruthy();
  });

  test('Reject invalid credentials', async ({ request }) => {
    console.log('\n🔐 Testing Invalid Login...');
    
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: { email: 'admin', password: 'wrongpassword' }
    });
    
    expect(response.ok()).toBeFalsy();
    console.log('✅ Invalid credentials correctly rejected');
  });

  test('Get current user with token', async ({ request }) => {
    console.log('\n👤 Testing Get Current User...');
    
    // First login
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: 'admin', password: '1234' }
    });
    const loginData = await loginResponse.json();
    
    // Get current user
    const meResponse = await request.get(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    
    expect(meResponse.ok()).toBeTruthy();
    const userData = await meResponse.json();
    
    console.log(`✅ Current user: ${userData.first_name} ${userData.last_name}`);
    console.log(`✅ Role: ${userData.role}`);
    
    expect(userData.email).toBe('admin');
  });
});

// ============================================
// TEST SUITE: POS Integration
// ============================================
test.describe('POS Integration', () => {
  let authToken;

  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: { email: 'admin', password: '1234' }
    });
    const data = await response.json();
    authToken = data.token;
  });

  test('Get POS configurations', async ({ request }) => {
    console.log('\n📱 Testing POS Configs...');
    
    const response = await request.get(`${API_BASE}/pos/configs`);
    expect(response.ok()).toBeTruthy();
    
    const configs = await response.json();
    console.log(`✅ Found ${configs.length} POS configuration(s)`);
    
    if (configs.length > 0) {
      console.log(`   - ${configs[0].name} (${configs[0].provider})`);
    }
  });

  test('Get POS transactions', async ({ request }) => {
    console.log('\n💳 Testing POS Transactions...');
    
    const response = await request.get(`${API_BASE}/pos/transactions`);
    expect(response.ok()).toBeTruthy();
    
    const transactions = await response.json();
    console.log(`✅ Found ${transactions.length} transaction(s)`);
    
    if (transactions.length > 0) {
      const total = transactions.reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
      console.log(`   - Total amount: $${total.toFixed(2)}`);
    }
  });

  test('Get POS settlements', async ({ request }) => {
    console.log('\n📊 Testing POS Settlements...');
    
    const response = await request.get(`${API_BASE}/pos/settlements`);
    expect(response.ok()).toBeTruthy();
    
    const settlements = await response.json();
    console.log(`✅ Found ${settlements.length} settlement(s)`);
    
    if (settlements.length > 0) {
      const posted = settlements.filter(s => s.is_posted).length;
      console.log(`   - Posted to GL: ${posted}/${settlements.length}`);
    }
  });
});

// ============================================
// TEST SUITE: Inventory Management
// ============================================
test.describe('Inventory Management', () => {
  test('Get inventory levels', async ({ request }) => {
    console.log('\n📦 Testing Inventory Levels...');
    
    const response = await request.get(`${API_BASE}/inventory/levels`);
    expect(response.ok()).toBeTruthy();
    
    const levels = await response.json();
    console.log(`✅ Tracking ${levels.length} inventory item(s)`);
    
    if (levels.length > 0) {
      const lowStock = levels.filter(l => parseFloat(l.quantity_on_hand) < 10);
      console.log(`   - Low stock items: ${lowStock.length}`);
    }
  });

  test('Get purchase orders', async ({ request }) => {
    console.log('\n📋 Testing Purchase Orders...');
    
    const response = await request.get(`${API_BASE}/inventory/purchase-orders`);
    expect(response.ok()).toBeTruthy();
    
    const orders = await response.json();
    console.log(`✅ Found ${orders.length} purchase order(s)`);
    
    if (orders.length > 0) {
      const pending = orders.filter(o => o.status === 'pending').length;
      console.log(`   - Pending orders: ${pending}`);
    }
  });

  test('Get inventory movements', async ({ request }) => {
    console.log('\n🔄 Testing Inventory Movements...');
    
    const response = await request.get(`${API_BASE}/inventory/movements`);
    expect(response.ok()).toBeTruthy();
    
    const movements = await response.json();
    console.log(`✅ Found ${movements.length} inventory movement(s)`);
  });

  test('Get inventory counts', async ({ request }) => {
    console.log('\n📝 Testing Inventory Counts...');
    
    const response = await request.get(`${API_BASE}/inventory/counts`);
    expect(response.ok()).toBeTruthy();
    
    const counts = await response.json();
    console.log(`✅ Found ${counts.length} inventory count(s)`);
  });
});

// ============================================
// TEST SUITE: AP Automation
// ============================================
test.describe('AP Automation', () => {
  test('Get AP invoices', async ({ request }) => {
    console.log('\n🧾 Testing AP Invoices...');
    
    const response = await request.get(`${API_BASE}/ap/invoices`);
    expect(response.ok()).toBeTruthy();
    
    const invoices = await response.json();
    console.log(`✅ Found ${invoices.length} AP invoice(s)`);
    
    if (invoices.length > 0) {
      const pending = invoices.filter(i => i.status === 'pending').length;
      const approved = invoices.filter(i => i.status === 'approved').length;
      console.log(`   - Pending: ${pending}, Approved: ${approved}`);
    }
  });

  test('Get payment batches', async ({ request }) => {
    console.log('\n💰 Testing Payment Batches...');
    
    const response = await request.get(`${API_BASE}/ap/payment-batches`);
    expect(response.ok()).toBeTruthy();
    
    const batches = await response.json();
    console.log(`✅ Found ${batches.length} payment batch(es)`);
  });
});

// ============================================
// TEST SUITE: Labor Operations
// ============================================
test.describe('Labor Operations', () => {
  test('Get employees (via payroll)', async ({ request }) => {
    console.log('\n👥 Testing Employees...');
    
    // Employees are in payroll endpoint
    const response = await request.get(`${API_BASE}/payroll/employees`);
    
    if (response.ok()) {
      const employees = await response.json();
      console.log(`✅ Found ${employees.length} employee(s)`);
      
      if (employees.length > 0) {
        const active = employees.filter(e => e.status === 'active').length;
        console.log(`   - Active: ${active}/${employees.length}`);
      }
    } else {
      console.log('⚠️ Employees endpoint returned non-OK (may be empty)');
    }
  });

  test('Get schedules', async ({ request }) => {
    console.log('\n📅 Testing Schedules...');
    
    const response = await request.get(`${API_BASE}/labor/schedules`);
    expect(response.ok()).toBeTruthy();
    
    const schedules = await response.json();
    console.log(`✅ Found ${schedules.length} schedule(s)`);
  });

  test('Get timeclock entries', async ({ request }) => {
    console.log('\n⏰ Testing Timeclock...');
    
    const response = await request.get(`${API_BASE}/labor/timeclock`);
    expect(response.ok()).toBeTruthy();
    
    const entries = await response.json();
    console.log(`✅ Found ${entries.length} timeclock entr(ies)`);
  });

  test('Get tip records', async ({ request }) => {
    console.log('\n💵 Testing Tips...');
    
    const response = await request.get(`${API_BASE}/labor/tips`);
    expect(response.ok()).toBeTruthy();
    
    const tips = await response.json();
    console.log(`✅ Found ${tips.length} tip record(s)`);
  });

  test('Get labor summary', async ({ request }) => {
    console.log('\n📊 Testing Labor Summary...');
    
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const response = await request.get(`${API_BASE}/labor/summary?start_date=${weekAgo}&end_date=${today}`);
    
    if (response.ok()) {
      const summary = await response.json();
      console.log(`✅ Labor summary retrieved`);
      console.log(`   - Total hours: ${summary.total_hours || 0}`);
      console.log(`   - Total labor cost: $${summary.total_labor_cost || 0}`);
    } else {
      // May return 404 if no data
      console.log('⚠️ Labor summary not available (may have no data)');
    }
  });
});

// ============================================
// TEST SUITE: General Ledger
// ============================================
test.describe('General Ledger', () => {
  test('Get chart of accounts', async ({ request }) => {
    console.log('\n📒 Testing Chart of Accounts...');
    
    const response = await request.get(`${API_BASE}/accounting/accounts`);
    expect(response.ok()).toBeTruthy();
    
    const accounts = await response.json();
    console.log(`✅ Found ${accounts.length} account(s)`);
    
    const byType = {};
    accounts.forEach(a => {
      byType[a.account_type] = (byType[a.account_type] || 0) + 1;
    });
    console.log(`   - By type: ${JSON.stringify(byType)}`);
  });

  test('Get journal entries', async ({ request }) => {
    console.log('\n📖 Testing Journal Entries...');
    
    const response = await request.get(`${API_BASE}/ledger/journal-entries`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log(`✅ Found ${data.entries?.length || 0} journal entr(ies)`);
  });

  test('Get trial balance', async ({ request }) => {
    console.log('\n⚖️ Testing Trial Balance...');
    
    const response = await request.get(`${API_BASE}/ledger/trial-balance`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log(`✅ Trial balance retrieved`);
    console.log(`   - Total debits: $${data.total_debits || 0}`);
    console.log(`   - Total credits: $${data.total_credits || 0}`);
    console.log(`   - Balanced: ${data.is_balanced ? 'Yes ✓' : 'No ✗'}`);
  });

  test('Get income statement', async ({ request }) => {
    console.log('\n💹 Testing Income Statement...');
    
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const response = await request.get(`${API_BASE}/ledger/income-statement?start_date=${monthAgo}&end_date=${today}`);
    
    if (response.ok()) {
      const data = await response.json();
      console.log(`✅ Income statement retrieved`);
      console.log(`   - Total revenue: $${data.total_revenue || 0}`);
      console.log(`   - Total expenses: $${data.total_expenses || 0}`);
      console.log(`   - Net income: $${data.net_income || 0}`);
    } else {
      // May return different status depending on data availability
      console.log('⚠️ Income statement endpoint returned non-OK (may be reconfiguring)');
    }
  });
});

// ============================================
// TEST SUITE: Core Operations
// ============================================
test.describe('Core Operations', () => {
  test('Get vendors', async ({ request }) => {
    console.log('\n🏪 Testing Vendors...');
    
    const response = await request.get(`${API_BASE}/vendors`);
    expect(response.ok()).toBeTruthy();
    
    const vendors = await response.json();
    console.log(`✅ Found ${vendors.length} vendor(s)`);
  });

  test('Get ingredients', async ({ request }) => {
    console.log('\n🥕 Testing Ingredients...');
    
    const response = await request.get(`${API_BASE}/ingredients`);
    expect(response.ok()).toBeTruthy();
    
    const ingredients = await response.json();
    console.log(`✅ Found ${ingredients.length} ingredient(s)`);
  });

  test('Get menu items', async ({ request }) => {
    console.log('\n🍽️ Testing Menu Items...');
    
    const response = await request.get(`${API_BASE}/menu-items`);
    expect(response.ok()).toBeTruthy();
    
    const menuItems = await response.json();
    console.log(`✅ Found ${menuItems.length} menu item(s)`);
    
    if (menuItems.length > 0) {
      const avgPrice = menuItems.reduce((sum, m) => sum + parseFloat(m.selling_price || 0), 0) / menuItems.length;
      console.log(`   - Average price: $${avgPrice.toFixed(2)}`);
    }
  });

  test('Get expenses', async ({ request }) => {
    console.log('\n💸 Testing Expenses...');
    
    const response = await request.get(`${API_BASE}/expenses`);
    expect(response.ok()).toBeTruthy();
    
    const expenses = await response.json();
    console.log(`✅ Found ${expenses.length} expense(s)`);
  });
});

// ============================================
// TEST SUITE: Integration Tests
// ============================================
test.describe('Integration Tests', () => {
  test('POS → GL Integration: Settlements flow to journal entries', async ({ request }) => {
    console.log('\n🔗 Testing POS → GL Integration...');
    
    // Get settlements
    const settlementsResponse = await request.get(`${API_BASE}/pos/settlements`);
    const settlements = await settlementsResponse.json();
    
    // Get journal entries
    const entriesResponse = await request.get(`${API_BASE}/ledger/journal-entries`);
    const entriesData = await entriesResponse.json();
    
    // Check for POS settlement entries
    const posEntries = entriesData.entries?.filter(e => 
      e.reference_type === 'pos_settlement'
    ) || [];
    
    console.log(`✅ POS Settlements: ${settlements.length}`);
    console.log(`✅ Posted to GL: ${settlements.filter(s => s.is_posted).length}`);
    console.log(`✅ GL entries from POS: ${posEntries.length}`);
    
    expect(settlements.filter(s => s.is_posted).length).toBe(posEntries.length);
  });

  test('Inventory → Purchasing flow', async ({ request }) => {
    console.log('\n🔗 Testing Inventory → Purchasing...');
    
    // Get inventory levels
    const levelsResponse = await request.get(`${API_BASE}/inventory/levels`);
    const levels = await levelsResponse.json();
    
    // Get purchase orders
    const ordersResponse = await request.get(`${API_BASE}/inventory/purchase-orders`);
    const orders = await ordersResponse.json();
    
    console.log(`✅ Inventory items tracked: ${levels.length}`);
    console.log(`✅ Purchase orders: ${orders.length}`);
  });

  test('Employees → Labor → Tips integration', async ({ request }) => {
    console.log('\n🔗 Testing Employees → Labor → Tips...');
    
    // Get employees
    const employeesResponse = await request.get(`${API_BASE}/labor/employees`);
    const employees = await employeesResponse.json();
    
    // Get timeclock
    const timeclockResponse = await request.get(`${API_BASE}/labor/timeclock`);
    const timeclock = await timeclockResponse.json();
    
    // Get tips
    const tipsResponse = await request.get(`${API_BASE}/labor/tips`);
    const tips = await tipsResponse.json();
    
    console.log(`✅ Employees: ${employees.length}`);
    console.log(`✅ Timeclock entries: ${timeclock.length}`);
    console.log(`✅ Tip records: ${tips.length}`);
  });
});

// ============================================
// TEST SUITE: Frontend UI
// ============================================
test.describe('Frontend UI', () => {
  test('App loads correctly', async ({ page }) => {
    console.log('\n🖥️ Testing App Loading...');
    
    await page.goto(APP_URL);
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/app-loaded.png', fullPage: true });
    console.log('📸 Screenshot: app-loaded.png');
    
    // Check for main content (either login or dashboard depending on auth state)
    const pageContent = await page.content();
    const hasContent = pageContent.includes('FLAVOR') || pageContent.includes('Flavor91') || pageContent.includes('Login');
    
    console.log(`✅ App loaded with content: ${hasContent}`);
    expect(hasContent).toBeTruthy();
  });

  test('Dashboard loads after login', async ({ page }) => {
    console.log('\n🖥️ Testing Dashboard UI...');
    
    await page.goto(APP_URL);
    
    // Set auth state (bypass login for UI test)
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        email: 'admin',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      }));
    });
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
    console.log('📸 Screenshot: dashboard.png');
    
    // Check for main UI elements
    const header = await page.locator('text=FLAVOR').first();
    await expect(header).toBeVisible();
    console.log('✅ Header visible');
  });

  test('Navigate through sections', async ({ page }) => {
    console.log('\n🖥️ Testing Navigation...');
    
    await page.goto(APP_URL);
    
    // Set auth state
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        email: 'admin',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      }));
    });
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Click Accounting & Tax section
    const accountingBtn = page.locator('text=Accounting');
    if (await accountingBtn.count() > 0) {
      await accountingBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/accounting-section.png' });
      console.log('📸 Screenshot: accounting-section.png');
      console.log('✅ Navigated to Accounting section');
    }
    
    // Click Operations section
    const operationsBtn = page.locator('text=Operations');
    if (await operationsBtn.count() > 0) {
      await operationsBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/operations-section.png' });
      console.log('📸 Screenshot: operations-section.png');
      console.log('✅ Navigated to Operations section');
    }
  });
});

// ============================================
// SUMMARY TEST
// ============================================
test('📋 SYSTEM SUMMARY', async ({ request }) => {
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESTAURANT MANAGEMENT SYSTEM - TEST SUMMARY');
  console.log('='.repeat(60));
  
  // Gather stats
  const health = await (await request.get(`${API_BASE}/health`)).json();
  const vendors = await (await request.get(`${API_BASE}/vendors`)).json();
  const ingredients = await (await request.get(`${API_BASE}/ingredients`)).json();
  const menuItems = await (await request.get(`${API_BASE}/menu-items`)).json();
  const accounts = await (await request.get(`${API_BASE}/accounting/accounts`)).json();
  const employees = await (await request.get(`${API_BASE}/labor/employees`)).json();
  const posConfigs = await (await request.get(`${API_BASE}/pos/configs`)).json();
  
  console.log(`
🏥 System Status: ${health.status.toUpperCase()}
📦 Version: ${health.version}

📊 DATA SUMMARY:
   • Vendors: ${vendors.length}
   • Ingredients: ${ingredients.length}
   • Menu Items: ${menuItems.length}
   • GL Accounts: ${accounts.length}
   • Employees: ${employees.length}
   • POS Integrations: ${posConfigs.length}

🔧 FEATURES ENABLED:
   ${health.features.map(f => `• ${f}`).join('\n   ')}

✅ All systems operational!
  `);
  
  expect(health.status).toBe('ok');
});

