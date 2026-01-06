const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

class ApiService {
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
}

const apiService = new ApiService();
export default apiService;

