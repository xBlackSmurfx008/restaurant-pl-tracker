const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

class ApiService {
  // ============================================
  // AUTHENTICATION
  // ============================================

  /**
   * Get the stored auth token
   * @returns {string|null} The auth token or null
   */
  getAuthToken() {
    return localStorage.getItem('authToken');
  }

  /**
   * Get the stored user info
   * @returns {object|null} The user object or null
   */
  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this.getAuthToken();
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<object>} Login result with token and user
   */
  async login(email, password) {
    const result = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    
    // Store token and user
    localStorage.setItem('authToken', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    
    return result;
  }

  /**
   * Logout user - invalidates session on server and clears local storage
   * @returns {Promise<void>}
   */
  async logout() {
    const token = this.getAuthToken();
    
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        // Logout should still proceed even if the API call fails
        console.error('Logout API call failed:', error);
      }
    }
    
    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  /**
   * Make an authenticated request (automatically includes auth token)
   * @param {string} endpoint - API endpoint
   * @param {object} options - Fetch options
   * @returns {Promise<any>}
   */
  async authenticatedRequest(endpoint, options = {}) {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    return this.request(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  // ============================================
  // BASE REQUEST
  // ============================================

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      
      // Handle non-JSON responses
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      // Provide more helpful error messages
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Cannot connect to server. Please make sure the backend is running on port 5001.');
      }
      throw error;
    }
  }

  // Vendors
  async getVendors() {
    return this.request('/vendors');
  }

  async getVendor(id) {
    return this.request(`/vendors/${id}`);
  }

  async createVendor(vendor) {
    return this.request('/vendors', { method: 'POST', body: vendor });
  }

  async updateVendor(id, vendor) {
    return this.request(`/vendors/${id}`, { method: 'PUT', body: vendor });
  }

  async deleteVendor(id) {
    return this.request(`/vendors/${id}`, { method: 'DELETE' });
  }

  // Ingredients
  async getIngredients() {
    return this.request('/ingredients');
  }

  async getIngredient(id) {
    return this.request(`/ingredients/${id}`);
  }

  async createIngredient(ingredient) {
    return this.request('/ingredients', { method: 'POST', body: ingredient });
  }

  async updateIngredient(id, ingredient) {
    return this.request(`/ingredients/${id}`, { method: 'PUT', body: ingredient });
  }

  async deleteIngredient(id) {
    return this.request(`/ingredients/${id}`, { method: 'DELETE' });
  }

  async suggestConversion(purchaseUnit, usageUnit) {
    return this.request('/ingredients/suggest-conversion', {
      method: 'POST',
      body: { purchase_unit: purchaseUnit, usage_unit: usageUnit },
    });
  }

  async getPriceWatchAlerts(days = 30) {
    return this.request(`/ingredients/alerts/price-watch?days=${days}`);
  }

  // Menu Items
  async getMenuItems() {
    return this.request('/menu-items');
  }

  async getMenuItem(id) {
    return this.request(`/menu-items/${id}`);
  }

  async createMenuItem(menuItem) {
    return this.request('/menu-items', { method: 'POST', body: menuItem });
  }

  async updateMenuItem(id, menuItem) {
    return this.request(`/menu-items/${id}`, { method: 'PUT', body: menuItem });
  }

  async deleteMenuItem(id) {
    return this.request(`/menu-items/${id}`, { method: 'DELETE' });
  }

  async addIngredientToRecipe(menuItemId, ingredientId, quantity) {
    return this.request(`/menu-items/${menuItemId}/recipe`, {
      method: 'POST',
      body: { ingredient_id: ingredientId, quantity_used: quantity },
    });
  }

  async removeIngredientFromRecipe(menuItemId, recipeId) {
    return this.request(`/menu-items/${menuItemId}/recipe/${recipeId}`, {
      method: 'DELETE',
    });
  }

  // Sales
  async getSales(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/sales${query}`);
  }

  async getSalesByDate(date) {
    return this.request(`/sales/date/${date}`);
  }

  async saveDailySales(date, sales) {
    return this.request('/sales/daily', {
      method: 'POST',
      body: { date, sales },
    });
  }

  // Manual sales entry
  async createSalesRecord(date, menuItemId, quantity) {
    return this.request('/sales', {
      method: 'POST',
      body: { date, menu_item_id: menuItemId, quantity_sold: quantity },
    });
  }

  // Add sales (increments existing quantity)
  async addSales(date, menuItemId, quantity) {
    return this.request('/sales/add', {
      method: 'POST',
      body: { date, menu_item_id: menuItemId, quantity_sold: quantity },
    });
  }

  async updateSalesRecord(id, quantity) {
    return this.request(`/sales/${id}`, {
      method: 'PUT',
      body: { quantity_sold: quantity },
    });
  }

  async deleteSalesRecord(id) {
    return this.request(`/sales/${id}`, {
      method: 'DELETE',
    });
  }

  async getAnalytics(period = 'month') {
    return this.request(`/sales/analytics?period=${period}`);
  }

  // ============================================
  // EXPENSES
  // ============================================
  
  async getExpenses(filters = {}) {
    const params = new URLSearchParams();
    if (filters.start) params.append('start', filters.start);
    if (filters.end) params.append('end', filters.end);
    if (filters.vendor_id) params.append('vendor_id', filters.vendor_id);
    if (filters.category_id) params.append('category_id', filters.category_id);
    if (filters.payment_method) params.append('payment_method', filters.payment_method);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/expenses${query}`);
  }

  async getExpense(id) {
    return this.request(`/expenses/${id}`);
  }

  async createExpense(expense) {
    return this.request('/expenses', { method: 'POST', body: expense });
  }

  async updateExpense(id, expense) {
    return this.request(`/expenses/${id}`, { method: 'PUT', body: expense });
  }

  async deleteExpense(id) {
    return this.request(`/expenses/${id}`, { method: 'DELETE' });
  }

  async getExpenseCategories() {
    return this.request('/expenses/meta/categories');
  }

  async getExpenseSummary(start, end) {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/expenses/meta/summary${query}`);
  }

  async getExpenseDashboard(start, end) {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/expenses/dashboard${query}`);
  }

  async suggestCategory(vendorId, description) {
    return this.request('/expenses/suggest-category', {
      method: 'POST',
      body: { vendor_id: vendorId, description }
    });
  }

  async createExpenseCategory(category) {
    return this.request('/expenses/categories', { method: 'POST', body: category });
  }

  async updateExpenseCategory(id, category) {
    return this.request(`/expenses/categories/${id}`, { method: 'PUT', body: category });
  }

  async getGroupedCategories() {
    return this.request('/expenses/categories/grouped');
  }

  // ============================================
  // EXPENSE LINE ITEMS
  // ============================================

  async getExpenseLineItems(expenseId) {
    return this.request(`/expenses/${expenseId}/line-items`);
  }

  async addExpenseLineItems(expenseId, items) {
    return this.request(`/expenses/${expenseId}/line-items`, {
      method: 'POST',
      body: { items },
    });
  }

  async updateLineItem(id, data) {
    return this.request(`/expenses/line-items/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteLineItem(id) {
    return this.request(`/expenses/line-items/${id}`, { method: 'DELETE' });
  }

  // ============================================
  // DOCUMENT UPLOADS
  // ============================================

  async getUploadStatus() {
    return this.request('/uploads/status');
  }

  async createUpload(originalFilename, mimeType, vendorId = null) {
    return this.request('/uploads/create', {
      method: 'POST',
      body: { original_filename: originalFilename, mime_type: mimeType, vendor_id: vendorId },
    });
  }

  async completeUpload(documentId, expenseId = null, sizeBytes = null) {
    return this.request('/uploads/complete', {
      method: 'POST',
      body: { document_id: documentId, expense_id: expenseId, size_bytes: sizeBytes },
    });
  }

  async attachDocument(documentId, expenseId) {
    return this.request('/uploads/attach', {
      method: 'POST',
      body: { document_id: documentId, expense_id: expenseId },
    });
  }

  async getDownloadUrl(documentId) {
    return this.request(`/uploads/download/${documentId}`);
  }

  async deleteDocument(documentId) {
    return this.request(`/uploads/${documentId}`, { method: 'DELETE' });
  }

  /**
   * Upload a file to storage (PostgreSQL database or Supabase)
   * @param {File} file - the File object to upload
   * @param {number|null} expenseId - optional expense to attach to
   * @param {number|null} vendorId - optional vendor
   * @returns {Promise<object>} - the completed document record
   */
  async uploadFile(file, expenseId = null, vendorId = null) {
    // 1. Create upload record and get upload endpoint
    const uploadData = await this.createUpload(file.name, file.type, vendorId);
    
    let uploadResponse;
    
    if (uploadData.storage_type === 'database') {
      // Upload directly to PostgreSQL via our API
      uploadResponse = await fetch(`${API_BASE_URL}/uploads/data/${uploadData.document_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });
    } else {
      // Upload to Supabase storage via signed URL
      uploadResponse = await fetch(uploadData.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });
    }

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file to storage');
    }

    // 3. Complete the upload and link to expense
    const result = await this.completeUpload(uploadData.document_id, expenseId, file.size);
    return result;
  }

  /**
   * Get the file URL for viewing/downloading
   * @param {number} documentId - Document ID
   * @returns {Promise<string>} - URL to view/download the file
   */
  async getFileUrl(documentId) {
    const downloadData = await this.getDownloadUrl(documentId);
    
    // For database storage, return the direct file endpoint
    if (downloadData.storage_type === 'database') {
      return `${API_BASE_URL}/uploads/file/${documentId}`;
    }
    
    // For Supabase, return the signed URL
    return downloadData.download_url;
  }

  // ============================================
  // VENDOR ITEM MAPPINGS
  // ============================================

  async getMappings(vendorId = null, active = null) {
    const params = new URLSearchParams();
    if (vendorId) params.append('vendor_id', vendorId);
    if (active !== null) params.append('active', active);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/mappings${query}`);
  }

  async getMapping(id) {
    return this.request(`/mappings/${id}`);
  }

  async createMapping(mapping) {
    return this.request('/mappings', { method: 'POST', body: mapping });
  }

  async updateMapping(id, mapping) {
    return this.request(`/mappings/${id}`, { method: 'PUT', body: mapping });
  }

  async deleteMapping(id) {
    return this.request(`/mappings/${id}`, { method: 'DELETE' });
  }

  async applyMappings(expenseId = null, lineItemIds = null) {
    return this.request('/mappings/apply', {
      method: 'POST',
      body: { expense_id: expenseId, line_item_ids: lineItemIds },
    });
  }

  async testMapping(matchType, matchValue, testCode = null, testDescription = null) {
    return this.request('/mappings/test', {
      method: 'POST',
      body: { match_type: matchType, match_value: matchValue, test_code: testCode, test_description: testDescription },
    });
  }

  async getUnmatchedLineItems(expenseId) {
    return this.request(`/mappings/unmatched/${expenseId}`);
  }

  // NOTE: Marketing and recurring expense routes were simplified
  // Use getExpenseCategories() and getExpenseSummary() for category/summary data

  // ============================================
  // REPORTS - P&L AND FINANCIAL
  // ============================================

  async getPnLStatement(startDate, endDate, comparePeriod = null) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (comparePeriod) params.append('compare_period', comparePeriod);
    return this.request(`/reports/pnl?${params.toString()}`);
  }

  async getTaxExpenseReport(filters = {}) {
    const params = new URLSearchParams();
    if (filters.tax_year) params.append('tax_year', filters.tax_year);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/reports/tax-expenses${query}`);
  }

  async getCashFlowReport(startDate, endDate) {
    return this.request(`/reports/cash-flow?start_date=${startDate}&end_date=${endDate}`);
  }

  async getVendorAnalysis(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/reports/vendor-analysis${query}`);
  }

  async getBudgetVsActual(month, year) {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/reports/budget-vs-actual${query}`);
  }

  async getDailySummary(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/reports/daily-summary${query}`);
  }

  // ============================================
  // TAX PREPARATION
  // ============================================

  async getScheduleC(year) {
    return this.request(`/tax/schedule-c/${year}`);
  }

  async getTaxExpenseDetails(year) {
    return this.request(`/tax/expense-report/${year}`);
  }

  async getQuarterlyEstimates(year) {
    return this.request(`/tax/quarterly-estimates/${year}`);
  }

  async get1099Vendors(year) {
    return this.request(`/tax/1099-vendors/${year}`);
  }

  async exportTaxData(year, type) {
    // This returns CSV, handle differently
    const url = `${API_BASE_URL}/tax/export/${year}/${type}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  }

  async getTaxDocuments(year) {
    return this.request(`/tax/documents/${year}`);
  }

  async saveTaxDocument(document) {
    return this.request('/tax/documents', { method: 'POST', body: document });
  }

  // ============================================
  // PAYROLL
  // ============================================

  async getEmployees(activeOnly = true) {
    return this.request(`/payroll/employees?active_only=${activeOnly}`);
  }

  async getEmployee(id) {
    return this.request(`/payroll/employees/${id}`);
  }

  async createEmployee(employee) {
    return this.request('/payroll/employees', { method: 'POST', body: employee });
  }

  async updateEmployee(id, employee) {
    return this.request(`/payroll/employees/${id}`, { method: 'PUT', body: employee });
  }

  async getPayrollRecords(filters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.department) params.append('department', filters.department);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/payroll/records${query}`);
  }

  async createPayrollRecord(record) {
    return this.request('/payroll/records', { method: 'POST', body: record });
  }

  async runPayroll(payPeriodStart, payPeriodEnd, employeeHours, paymentDate = null) {
    return this.request('/payroll/run-payroll', {
      method: 'POST',
      body: { 
        pay_period_start: payPeriodStart, 
        pay_period_end: payPeriodEnd,
        employee_hours: employeeHours,
        payment_date: paymentDate
      }
    });
  }

  async getPayrollByDepartment(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/payroll/summary/department${query}`);
  }

  async getLaborAnalysis(startDate, endDate) {
    return this.request(`/payroll/labor-analysis?start_date=${startDate}&end_date=${endDate}`);
  }

  // ============================================
  // ACCOUNTING - CHART OF ACCOUNTS
  // ============================================

  async getAccounts(accountType = null, activeOnly = true) {
    const params = new URLSearchParams({ active_only: activeOnly });
    if (accountType) params.append('account_type', accountType);
    return this.request(`/accounting/accounts?${params.toString()}`);
  }

  async createAccount(account) {
    return this.request('/accounting/accounts', { method: 'POST', body: account });
  }

  // ============================================
  // ACCOUNTS PAYABLE
  // ============================================

  async getAccountsPayable(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.vendor_id) params.append('vendor_id', filters.vendor_id);
    if (filters.overdue_only) params.append('overdue_only', filters.overdue_only);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/accounting/payables${query}`);
  }

  async createAccountPayable(payable) {
    return this.request('/accounting/payables', { method: 'POST', body: payable });
  }

  async recordAPPayment(id, payment) {
    return this.request(`/accounting/payables/${id}/payment`, { method: 'POST', body: payment });
  }

  async getAPAgingReport() {
    return this.request('/accounting/payables/aging');
  }

  // ============================================
  // ACCOUNTS RECEIVABLE
  // ============================================

  async getAccountsReceivable(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.service_type) params.append('service_type', filters.service_type);
    if (filters.overdue_only) params.append('overdue_only', filters.overdue_only);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/accounting/receivables${query}`);
  }

  async createAccountReceivable(receivable) {
    return this.request('/accounting/receivables', { method: 'POST', body: receivable });
  }

  async recordARPayment(id, payment) {
    return this.request(`/accounting/receivables/${id}/payment`, { method: 'POST', body: payment });
  }

  // ============================================
  // BANK ACCOUNTS & RECONCILIATION
  // ============================================

  async getBankAccounts() {
    return this.request('/accounting/bank-accounts');
  }

  async createBankAccount(account) {
    return this.request('/accounting/bank-accounts', { method: 'POST', body: account });
  }

  async getBankTransactions(accountId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.reconciled !== undefined) params.append('reconciled', filters.reconciled);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/accounting/bank-accounts/${accountId}/transactions${query}`);
  }

  async addBankTransaction(accountId, transaction) {
    return this.request(`/accounting/bank-accounts/${accountId}/transactions`, {
      method: 'POST',
      body: transaction
    });
  }

  async reconcileBankTransactions(accountId, transactionIds, statementBalance, statementDate) {
    return this.request(`/accounting/bank-accounts/${accountId}/reconcile`, {
      method: 'POST',
      body: { 
        transaction_ids: transactionIds, 
        statement_ending_balance: statementBalance,
        statement_date: statementDate
      }
    });
  }

  // ============================================
  // DAILY REVENUE
  // ============================================

  async getDailyRevenue(filters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.limit) params.append('limit', filters.limit);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/accounting/daily-revenue${query}`);
  }

  async saveDailyRevenue(revenue) {
    return this.request('/accounting/daily-revenue', { method: 'POST', body: revenue });
  }

  // ============================================
  // BUSINESS SETTINGS
  // ============================================

  async getBusinessSettings() {
    return this.request('/accounting/settings');
  }

  async updateBusinessSetting(key, value) {
    return this.request(`/accounting/settings/${key}`, { method: 'PUT', body: { value } });
  }

  async updateBusinessSettings(settings) {
    return this.request('/accounting/settings', { method: 'PUT', body: settings });
  }

  // ============================================
  // SYSTEM ADMINISTRATION
  // ============================================

  /**
   * Clear all transactional data while preserving core data
   * (menu items, ingredients, recipes, vendors, chart of accounts, expense categories)
   * @returns {Promise<object>} Result of the clear operation
   */
  async clearAllData() {
    return this.request('/accounting/clear-all-data', { 
      method: 'POST', 
      body: { confirm: 'CLEAR_ALL_DATA' } 
    });
  }
}

const apiService = new ApiService();
export default apiService;

