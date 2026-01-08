/**
 * Seed script for Accounting, Expenses, Payroll, and related data
 * Run with: node seed-accounting.js
 */

require('dotenv').config();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper to run queries
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ===========================================
// SEED DATA
// ===========================================

const employees = [
  { first_name: 'Maria', last_name: 'Garcia', position: 'chef', department: 'kitchen', pay_type: 'salary', pay_rate: 55000, hours_per_week: 45 },
  { first_name: 'James', last_name: 'Wilson', position: 'line_cook', department: 'kitchen', pay_type: 'hourly', pay_rate: 18.50, hours_per_week: 40 },
  { first_name: 'Emily', last_name: 'Chen', position: 'line_cook', department: 'kitchen', pay_type: 'hourly', pay_rate: 17.00, hours_per_week: 35 },
  { first_name: 'Michael', last_name: 'Brown', position: 'prep_cook', department: 'kitchen', pay_type: 'hourly', pay_rate: 15.50, hours_per_week: 30 },
  { first_name: 'Sarah', last_name: 'Johnson', position: 'server', department: 'front_of_house', pay_type: 'hourly', pay_rate: 12.00, hours_per_week: 25 },
  { first_name: 'David', last_name: 'Martinez', position: 'server', department: 'front_of_house', pay_type: 'hourly', pay_rate: 12.00, hours_per_week: 30 },
  { first_name: 'Jessica', last_name: 'Taylor', position: 'host', department: 'front_of_house', pay_type: 'hourly', pay_rate: 14.00, hours_per_week: 20 },
  { first_name: 'Robert', last_name: 'Anderson', position: 'manager', department: 'management', pay_type: 'salary', pay_rate: 48000, hours_per_week: 45 },
  { first_name: 'Lisa', last_name: 'Thomas', position: 'bartender', department: 'front_of_house', pay_type: 'hourly', pay_rate: 14.00, hours_per_week: 25 },
  { first_name: 'Kevin', last_name: 'Lee', position: 'dishwasher', department: 'kitchen', pay_type: 'hourly', pay_rate: 14.00, hours_per_week: 35 },
];

const bankAccounts = [
  { account_name: 'Business Checking', bank_name: 'Chase Bank', account_type: 'checking', last_four: '4521', opening_balance: 25000, is_primary: true },
  { account_name: 'Business Savings', bank_name: 'Chase Bank', account_type: 'savings', last_four: '8834', opening_balance: 15000, is_primary: false },
  { account_name: 'Business Credit Card', bank_name: 'American Express', account_type: 'credit_card', last_four: '1002', opening_balance: -2500, is_primary: false },
  { account_name: 'Petty Cash', bank_name: null, account_type: 'petty_cash', last_four: null, opening_balance: 500, is_primary: false },
];

// Generate expenses for the past 3 months
function generateExpenses(vendorIds, categoryMap) {
  const expenses = [];
  const today = new Date();
  
  // Recurring monthly expenses
  for (let monthsAgo = 0; monthsAgo < 3; monthsAgo++) {
    const month = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
    
    // Rent - 1st of month
    expenses.push({
      date: new Date(month.getFullYear(), month.getMonth(), 1),
      category_id: categoryMap['Rent/Lease'],
      vendor_id: null,
      description: `Monthly Rent - ${month.toLocaleString('default', { month: 'long' })}`,
      amount: 4500,
      payment_method: 'check',
      reference_number: `CHK-${1000 + monthsAgo}`,
      is_recurring: true
    });
    
    // Utilities - 15th of month
    expenses.push({
      date: new Date(month.getFullYear(), month.getMonth(), 15),
      category_id: categoryMap['Utilities'],
      vendor_id: null,
      description: `Electric & Gas - ${month.toLocaleString('default', { month: 'long' })}`,
      amount: 850 + Math.random() * 200,
      payment_method: 'bank_transfer',
      is_recurring: true
    });
    
    // Internet/Phone
    expenses.push({
      date: new Date(month.getFullYear(), month.getMonth(), 20),
      category_id: categoryMap['Utilities'],
      vendor_id: null,
      description: `Internet & Phone - ${month.toLocaleString('default', { month: 'long' })}`,
      amount: 175,
      payment_method: 'credit_card',
      is_recurring: true
    });
    
    // Insurance
    expenses.push({
      date: new Date(month.getFullYear(), month.getMonth(), 5),
      category_id: categoryMap['Insurance'],
      vendor_id: null,
      description: `Business Insurance - ${month.toLocaleString('default', { month: 'long' })}`,
      amount: 650,
      payment_method: 'bank_transfer',
      is_recurring: true
    });
  }
  
  // Random vendor purchases (food, supplies, etc.)
  const purchaseDescriptions = [
    { desc: 'Weekly produce delivery', category: 'Food Purchases', min: 400, max: 800 },
    { desc: 'Meat and poultry order', category: 'Food Purchases', min: 600, max: 1200 },
    { desc: 'Dairy products', category: 'Food Purchases', min: 150, max: 350 },
    { desc: 'Dry goods and pantry items', category: 'Food Purchases', min: 200, max: 500 },
    { desc: 'Beverages and coffee beans', category: 'Beverage Purchases', min: 300, max: 600 },
    { desc: 'Cleaning supplies', category: 'Cleaning Supplies', min: 75, max: 200 },
    { desc: 'Paper goods and to-go containers', category: 'Paper & Packaging', min: 150, max: 400 },
    { desc: 'Kitchen equipment repair', category: 'Repairs & Maintenance', min: 100, max: 500 },
    { desc: 'POS system subscription', category: 'Software & Technology', min: 150, max: 150 },
    { desc: 'Linen service', category: 'Laundry & Linens', min: 120, max: 180 },
  ];
  
  // Generate 2-4 purchases per week for past 12 weeks
  for (let weeksAgo = 0; weeksAgo < 12; weeksAgo++) {
    const numPurchases = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numPurchases; i++) {
      const purchase = purchaseDescriptions[Math.floor(Math.random() * purchaseDescriptions.length)];
      const dayOffset = Math.floor(Math.random() * 7);
      const date = new Date(today);
      date.setDate(date.getDate() - (weeksAgo * 7) - dayOffset);
      
      if (categoryMap[purchase.category]) {
        expenses.push({
          date,
          category_id: categoryMap[purchase.category],
          vendor_id: vendorIds[Math.floor(Math.random() * vendorIds.length)],
          description: purchase.desc,
          amount: purchase.min + Math.random() * (purchase.max - purchase.min),
          payment_method: Math.random() > 0.3 ? 'credit_card' : 'check',
          reference_number: Math.random() > 0.5 ? `INV-${Math.floor(Math.random() * 10000)}` : null
        });
      }
    }
  }
  
  // Marketing expenses (less frequent)
  const marketingItems = [
    { desc: 'Facebook/Instagram ads', amount: 250 },
    { desc: 'Google Ads campaign', amount: 300 },
    { desc: 'Local newspaper ad', amount: 150 },
    { desc: 'Flyer printing', amount: 85 },
    { desc: 'Event sponsorship', amount: 500 },
    { desc: 'Website hosting', amount: 30 },
  ];
  
  for (let i = 0; i < 8; i++) {
    const item = marketingItems[Math.floor(Math.random() * marketingItems.length)];
    const date = new Date(today);
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));
    
    if (categoryMap['Advertising']) {
      expenses.push({
        date,
        category_id: categoryMap['Advertising'],
        vendor_id: null,
        description: item.desc,
        amount: item.amount,
        payment_method: 'credit_card'
      });
    }
  }
  
  return expenses;
}

// Generate payroll records for past 6 pay periods
function generatePayrollRecords(employeeIds) {
  const records = [];
  const today = new Date();
  
  for (let periodNum = 0; periodNum < 6; periodNum++) {
    const periodEnd = new Date(today);
    periodEnd.setDate(periodEnd.getDate() - (periodNum * 14));
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 13);
    const paymentDate = new Date(periodEnd);
    paymentDate.setDate(paymentDate.getDate() + 3);
    
    for (const empId of employeeIds) {
      // Random hours variation
      const regularHours = 30 + Math.random() * 15;
      const overtimeHours = Math.random() > 0.7 ? Math.random() * 8 : 0;
      const tips = Math.random() > 0.5 ? Math.random() * 200 : 0;
      
      // Use placeholder rate - will be updated when we get actual employee data
      const hourlyRate = 15 + Math.random() * 5;
      const regularPay = regularHours * hourlyRate;
      const overtimePay = overtimeHours * hourlyRate * 1.5;
      const grossPay = regularPay + overtimePay + tips;
      
      // Tax calculations
      const federalTax = grossPay * 0.12;
      const stateTax = grossPay * 0.05;
      const ssTax = grossPay * 0.062;
      const medicareTax = grossPay * 0.0145;
      const netPay = grossPay - federalTax - stateTax - ssTax - medicareTax;
      
      // Employer costs
      const employerSS = grossPay * 0.062;
      const employerMedicare = grossPay * 0.0145;
      const employerFuta = grossPay * 0.006;
      const employerSuta = grossPay * 0.027;
      const totalEmployerCost = grossPay + employerSS + employerMedicare + employerFuta + employerSuta;
      
      records.push({
        employee_id: empId,
        pay_period_start: periodStart.toISOString().split('T')[0],
        pay_period_end: periodEnd.toISOString().split('T')[0],
        regular_hours: regularHours.toFixed(2),
        overtime_hours: overtimeHours.toFixed(2),
        tips_reported: tips.toFixed(2),
        gross_pay: grossPay.toFixed(2),
        federal_tax_withheld: federalTax.toFixed(2),
        state_tax_withheld: stateTax.toFixed(2),
        social_security_withheld: ssTax.toFixed(2),
        medicare_withheld: medicareTax.toFixed(2),
        net_pay: netPay.toFixed(2),
        employer_social_security: employerSS.toFixed(2),
        employer_medicare: employerMedicare.toFixed(2),
        employer_futa: employerFuta.toFixed(2),
        employer_suta: employerSuta.toFixed(2),
        total_employer_cost: totalEmployerCost.toFixed(2),
        payment_date: paymentDate.toISOString().split('T')[0]
      });
    }
  }
  
  return records;
}

// Generate daily revenue for past 90 days
function generateDailyRevenue() {
  const records = [];
  const today = new Date();
  
  for (let daysAgo = 0; daysAgo < 90; daysAgo++) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const dayOfWeek = date.getDay();
    
    // Weekend boost
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const baseMultiplier = isWeekend ? 1.3 : 1.0;
    
    // Random variation
    const variance = 0.8 + Math.random() * 0.4;
    
    const foodSales = (1800 + Math.random() * 800) * baseMultiplier * variance;
    const beverageSales = (300 + Math.random() * 200) * baseMultiplier * variance;
    const alcoholSales = isWeekend ? (400 + Math.random() * 300) * variance : (150 + Math.random() * 100) * variance;
    const cateringSales = Math.random() > 0.9 ? (500 + Math.random() * 1500) : 0;
    
    const grossSales = foodSales + beverageSales + alcoholSales + cateringSales;
    const discounts = grossSales * (0.02 + Math.random() * 0.03);
    const netSales = grossSales - discounts;
    
    const transactions = Math.floor(50 + Math.random() * 40 * baseMultiplier);
    const customers = Math.floor(transactions * (1.5 + Math.random() * 0.5));
    
    records.push({
      date: date.toISOString().split('T')[0],
      food_sales: foodSales.toFixed(2),
      beverage_sales: beverageSales.toFixed(2),
      alcohol_sales: alcoholSales.toFixed(2),
      catering_sales: cateringSales.toFixed(2),
      total_gross_sales: grossSales.toFixed(2),
      discounts: discounts.toFixed(2),
      total_net_sales: netSales.toFixed(2),
      tips_collected: (netSales * 0.18).toFixed(2),
      cash_payments: (netSales * 0.25).toFixed(2),
      card_payments: (netSales * 0.75).toFixed(2),
      transaction_count: transactions,
      customer_count: customers
    });
  }
  
  return records;
}

// Generate accounts payable
function generateAccountsPayable(vendorIds) {
  const payables = [];
  const today = new Date();
  
  const invoices = [
    { desc: 'Food supplies invoice', min: 500, max: 2000 },
    { desc: 'Equipment service', min: 200, max: 800 },
    { desc: 'Linen service invoice', min: 150, max: 300 },
    { desc: 'Cleaning supplies', min: 100, max: 400 },
  ];
  
  for (let i = 0; i < 8; i++) {
    const invoice = invoices[Math.floor(Math.random() * invoices.length)];
    const invoiceDate = new Date(today);
    invoiceDate.setDate(invoiceDate.getDate() - Math.floor(Math.random() * 45));
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    
    const amount = invoice.min + Math.random() * (invoice.max - invoice.min);
    const isPaid = Math.random() > 0.6;
    const isPartial = !isPaid && Math.random() > 0.7;
    
    payables.push({
      vendor_id: vendorIds[Math.floor(Math.random() * vendorIds.length)],
      invoice_number: `INV-${10000 + i}`,
      invoice_date: invoiceDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      amount: amount.toFixed(2),
      amount_paid: isPaid ? amount.toFixed(2) : (isPartial ? (amount * 0.5).toFixed(2) : '0'),
      status: isPaid ? 'paid' : (isPartial ? 'partial' : (dueDate < today ? 'overdue' : 'pending')),
      terms: 'net_30'
    });
  }
  
  return payables;
}

// Generate accounts receivable
function generateAccountsReceivable() {
  const receivables = [];
  const today = new Date();
  
  const customers = [
    { name: 'Johnson Wedding Party', type: 'catering' },
    { name: 'Tech Corp Holiday Event', type: 'private_event' },
    { name: 'Smith Family Reunion', type: 'catering' },
    { name: 'Local Business Lunch', type: 'catering' },
    { name: 'Birthday Party - Miller', type: 'private_event' },
  ];
  
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const invoiceDate = new Date(today);
    invoiceDate.setDate(invoiceDate.getDate() - Math.floor(Math.random() * 60));
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    
    const amount = 500 + Math.random() * 2500;
    const isPaid = Math.random() > 0.5;
    
    receivables.push({
      customer_name: customer.name,
      invoice_number: `AR-${2000 + i}`,
      invoice_date: invoiceDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      amount: amount.toFixed(2),
      amount_received: isPaid ? amount.toFixed(2) : '0',
      status: isPaid ? 'paid' : (dueDate < today ? 'overdue' : 'pending'),
      service_type: customer.type,
      description: `${customer.type === 'catering' ? 'Catering service' : 'Private event'} for ${customer.name}`
    });
  }
  
  return receivables;
}

// ===========================================
// MAIN SEED FUNCTION
// ===========================================

async function seed() {
  console.log('🌱 Starting accounting data seed...\n');
  
  try {
    // Get existing vendors
    console.log('📦 Fetching existing vendors...');
    const vendorResult = await query('SELECT id FROM vendors LIMIT 20');
    const vendorIds = vendorResult.rows.map(r => r.id);
    
    if (vendorIds.length === 0) {
      console.log('⚠️  No vendors found. Please run the main seed script first.');
      console.log('   Run: node seed-neon.js');
      process.exit(1);
    }
    console.log(`   Found ${vendorIds.length} vendors\n`);
    
    // Get expense categories
    console.log('📂 Fetching expense categories...');
    const categoryResult = await query('SELECT id, name FROM expense_categories');
    const categoryMap = {};
    for (const row of categoryResult.rows) {
      categoryMap[row.name] = row.id;
    }
    
    if (Object.keys(categoryMap).length === 0) {
      console.log('⚠️  No expense categories found. Running schema may have failed.');
      console.log('   Categories should be seeded by db-accounting-schema.sql');
      process.exit(1);
    }
    console.log(`   Found ${Object.keys(categoryMap).length} categories\n`);
    
    // Seed employees
    console.log('👥 Seeding employees...');
    const employeeIds = [];
    for (const emp of employees) {
      const hireDate = new Date();
      hireDate.setMonth(hireDate.getMonth() - Math.floor(Math.random() * 24));
      
      const result = await query(`
        INSERT INTO employees (first_name, last_name, position, department, hire_date, pay_type, pay_rate, hours_per_week)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [emp.first_name, emp.last_name, emp.position, emp.department, hireDate.toISOString().split('T')[0], emp.pay_type, emp.pay_rate, emp.hours_per_week]);
      
      if (result.rows.length > 0) {
        employeeIds.push(result.rows[0].id);
      }
    }
    console.log(`   Created ${employeeIds.length} employees\n`);
    
    // Get all employee IDs (including previously created)
    const allEmpsResult = await query('SELECT id FROM employees WHERE is_active = true');
    const allEmployeeIds = allEmpsResult.rows.map(r => r.id);
    
    // Seed bank accounts
    console.log('🏦 Seeding bank accounts...');
    for (const bank of bankAccounts) {
      await query(`
        INSERT INTO bank_accounts (account_name, bank_name, account_type, account_number_last_four, opening_balance, current_balance, is_primary)
        VALUES ($1, $2, $3, $4, $5, $5, $6)
        ON CONFLICT DO NOTHING
      `, [bank.account_name, bank.bank_name, bank.account_type, bank.last_four, bank.opening_balance, bank.is_primary]);
    }
    console.log(`   Created ${bankAccounts.length} bank accounts\n`);
    
    // Seed expenses
    console.log('💰 Seeding expenses...');
    const expenses = generateExpenses(vendorIds, categoryMap);
    let expenseCount = 0;
    for (const exp of expenses) {
      try {
        await query(`
          INSERT INTO expenses (expense_date, category_id, vendor_id, description, amount, payment_method, reference_number, is_recurring)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          exp.date.toISOString().split('T')[0],
          exp.category_id,
          exp.vendor_id,
          exp.description,
          exp.amount.toFixed(2),
          exp.payment_method,
          exp.reference_number || null,
          exp.is_recurring || false
        ]);
        expenseCount++;
      } catch (e) {
        // Skip duplicates or errors
      }
    }
    console.log(`   Created ${expenseCount} expenses\n`);
    
    // Seed payroll records
    console.log('💵 Seeding payroll records...');
    const payrollRecords = generatePayrollRecords(allEmployeeIds);
    let payrollCount = 0;
    for (const rec of payrollRecords) {
      try {
        await query(`
          INSERT INTO payroll_records (
            employee_id, pay_period_start, pay_period_end,
            regular_hours, overtime_hours, tips_reported,
            gross_pay, federal_tax_withheld, state_tax_withheld,
            social_security_withheld, medicare_withheld,
            net_pay, employer_social_security, employer_medicare,
            employer_futa, employer_suta, total_employer_cost, payment_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT DO NOTHING
        `, [
          rec.employee_id, rec.pay_period_start, rec.pay_period_end,
          rec.regular_hours, rec.overtime_hours, rec.tips_reported,
          rec.gross_pay, rec.federal_tax_withheld, rec.state_tax_withheld,
          rec.social_security_withheld, rec.medicare_withheld,
          rec.net_pay, rec.employer_social_security, rec.employer_medicare,
          rec.employer_futa, rec.employer_suta, rec.total_employer_cost, rec.payment_date
        ]);
        payrollCount++;
      } catch (e) {
        // Skip duplicates
      }
    }
    console.log(`   Created ${payrollCount} payroll records\n`);
    
    // Seed daily revenue
    console.log('📊 Seeding daily revenue...');
    const dailyRevenue = generateDailyRevenue();
    let revenueCount = 0;
    for (const rev of dailyRevenue) {
      try {
        await query(`
          INSERT INTO daily_revenue (
            date, food_sales, beverage_sales, alcohol_sales, catering_sales,
            total_gross_sales, discounts, total_net_sales,
            tips_collected, cash_payments, card_payments,
            transaction_count, customer_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (date) DO UPDATE SET
            food_sales = EXCLUDED.food_sales,
            beverage_sales = EXCLUDED.beverage_sales,
            alcohol_sales = EXCLUDED.alcohol_sales,
            catering_sales = EXCLUDED.catering_sales,
            total_gross_sales = EXCLUDED.total_gross_sales,
            discounts = EXCLUDED.discounts,
            total_net_sales = EXCLUDED.total_net_sales,
            tips_collected = EXCLUDED.tips_collected,
            cash_payments = EXCLUDED.cash_payments,
            card_payments = EXCLUDED.card_payments,
            transaction_count = EXCLUDED.transaction_count,
            customer_count = EXCLUDED.customer_count
        `, [
          rev.date, rev.food_sales, rev.beverage_sales, rev.alcohol_sales, rev.catering_sales,
          rev.total_gross_sales, rev.discounts, rev.total_net_sales,
          rev.tips_collected, rev.cash_payments, rev.card_payments,
          rev.transaction_count, rev.customer_count
        ]);
        revenueCount++;
      } catch (e) {
        // Skip errors
      }
    }
    console.log(`   Created ${revenueCount} daily revenue records\n`);
    
    // Seed accounts payable
    console.log('📤 Seeding accounts payable...');
    const payables = generateAccountsPayable(vendorIds);
    let apCount = 0;
    for (const ap of payables) {
      try {
        await query(`
          INSERT INTO accounts_payable (vendor_id, invoice_number, invoice_date, due_date, amount, amount_paid, status, terms)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING
        `, [ap.vendor_id, ap.invoice_number, ap.invoice_date, ap.due_date, ap.amount, ap.amount_paid, ap.status, ap.terms]);
        apCount++;
      } catch (e) {
        // Skip
      }
    }
    console.log(`   Created ${apCount} accounts payable records\n`);
    
    // Seed accounts receivable
    console.log('📥 Seeding accounts receivable...');
    const receivables = generateAccountsReceivable();
    let arCount = 0;
    for (const ar of receivables) {
      try {
        await query(`
          INSERT INTO accounts_receivable (customer_name, invoice_number, invoice_date, due_date, amount, amount_received, status, service_type, description)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING
        `, [ar.customer_name, ar.invoice_number, ar.invoice_date, ar.due_date, ar.amount, ar.amount_received, ar.status, ar.service_type, ar.description]);
        arCount++;
      } catch (e) {
        // Skip
      }
    }
    console.log(`   Created ${arCount} accounts receivable records\n`);
    
    console.log('═══════════════════════════════════════════');
    console.log('✅ Accounting data seed complete!');
    console.log('═══════════════════════════════════════════');
    console.log(`
Summary:
  👥 Employees: ${employeeIds.length}
  🏦 Bank Accounts: ${bankAccounts.length}
  💰 Expenses: ${expenseCount}
  💵 Payroll Records: ${payrollCount}
  📊 Daily Revenue: ${revenueCount} days
  📤 Accounts Payable: ${apCount}
  📥 Accounts Receivable: ${arCount}
    `);
    
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run
seed();

