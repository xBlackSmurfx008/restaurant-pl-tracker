const { chromium } = require('playwright');
const http = require('http');

// Test server health
function testServerHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:5001/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 403) {
          // 403 might be CORS or auth, but server is responding
          console.log(`✅ Backend server is running (HTTP ${res.statusCode})`);
          resolve(true);
        } else {
          reject(new Error(`Server returned ${res.statusCode}`));
        }
      });
    });
    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('Server is not running'));
      } else {
        reject(err);
      }
    });
    req.setTimeout(5000, () => reject(new Error('Server health check timeout')));
  });
}

// Test API endpoints
async function testAPIEndpoints() {
  const endpoints = [
    '/api/vendors',
    '/api/ingredients',
    '/api/menu-items',
    '/api/sales/analytics?period=month'
  ];

  console.log('\n📡 Testing API Endpoints...');
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:5001${endpoint}`);
      const data = await response.json();
      if (response.ok) {
        console.log(`✅ ${endpoint} - OK`);
      } else {
        console.log(`⚠️  ${endpoint} - ${response.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }
  }
}

// Test frontend with Playwright
async function testFrontend() {
  console.log('\n🌐 Testing Frontend with Playwright...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Test 1: Load homepage
    console.log('Testing: Loading homepage...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('✅ Homepage loaded');

    // Test 2: Check if tabs are visible
    console.log('Testing: Checking tabs...');
    const tabs = ['Dashboard', 'Vendors', 'Ingredients', 'Recipes', 'Sales'];
    for (const tab of tabs) {
      const tabElement = await page.locator(`text=${tab}`).first();
      if (await tabElement.isVisible()) {
        console.log(`✅ Tab "${tab}" is visible`);
      } else {
        console.log(`❌ Tab "${tab}" not found`);
      }
    }

    // Test 3: Test each tab
    console.log('\nTesting: Switching between tabs...');
    for (const tab of tabs) {
      try {
        console.log(`  → Clicking "${tab}" tab...`);
        await page.click(`text=${tab}`, { timeout: 5000 });
        await page.waitForTimeout(2000);
        
        // Check for error messages
        const errorElements = await page.locator('text=/error|Error|cannot fetch|failed/i').all();
        if (errorElements.length > 0) {
          const errorText = await errorElements[0].textContent();
          console.log(`  ⚠️  "${tab}" tab shows error: ${errorText}`);
        } else {
          console.log(`  ✅ "${tab}" tab loaded successfully`);
        }
      } catch (error) {
        console.log(`  ❌ Error testing "${tab}" tab: ${error.message}`);
      }
    }

    // Test 4: Check for console errors
    console.log('\nChecking browser console...');
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    if (consoleMessages.length > 0) {
      console.log('⚠️  Console errors found:');
      consoleMessages.forEach(msg => console.log(`  - ${msg}`));
    } else {
      console.log('✅ No console errors');
    }

    // Keep browser open for manual inspection
    console.log('\n✅ Frontend testing complete. Browser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ Frontend test failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Application Tests...\n');

  // Test 1: Server Health
  try {
    await testServerHealth();
  } catch (error) {
    console.error('❌ Backend server is not running:', error.message);
    console.error('Please start the server with: npm run dev');
    process.exit(1);
  }

  // Test 2: API Endpoints
  await testAPIEndpoints();

  // Test 3: Frontend
  await testFrontend();

  console.log('\n✨ All tests complete!');
}

// Run tests
runTests().catch(console.error);

