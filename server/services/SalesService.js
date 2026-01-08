/**
 * Sales Service - Business logic for sales
 */
const { serviceLogger } = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { calculateTimeBasedPL, calculateLaborCost } = require('../utils/calculations');

class SalesService {
  /**
   * @param {import('../repositories/SalesRepository')} salesRepo
   * @param {import('../repositories/MenuItemRepository')} menuItemRepo
   */
  constructor(salesRepo, menuItemRepo) {
    this.salesRepo = salesRepo;
    this.menuItemRepo = menuItemRepo;
    this.logger = serviceLogger.child({ service: 'sales' });
  }

  /**
   * Get sales with menu item info
   * @param {Object} filters
   */
  async getAll(filters = {}) {
    return this.salesRepo.findWithMenuItems(filters);
  }

  /**
   * Get sales for a specific date
   * @param {string} date
   */
  async getByDate(date) {
    return this.salesRepo.findByDate(date);
  }

  /**
   * Get single sale record by ID
   * @param {number} id
   */
  async getById(id) {
    const sale = await this.salesRepo.findById(id);
    if (!sale) {
      throw new NotFoundError('Sales record');
    }
    return sale;
  }

  /**
   * Save daily sales (bulk upsert)
   * @param {string} date
   * @param {Array} sales
   */
  async saveDailySales(date, sales) {
    await this.salesRepo.transaction(async (client) => {
      for (const sale of sales) {
        if (sale.quantity_sold > 0) {
          await client.query(
            `INSERT INTO sales_log (date, menu_item_id, quantity_sold) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (date, menu_item_id) 
             DO UPDATE SET quantity_sold = EXCLUDED.quantity_sold`,
            [date, sale.menu_item_id, sale.quantity_sold]
          );
        } else {
          await client.query(
            'DELETE FROM sales_log WHERE date = $1 AND menu_item_id = $2',
            [date, sale.menu_item_id]
          );
        }
      }
    });

    this.logger.info({ date, count: sales.length }, 'Daily sales saved');

    // Calculate and return daily profit
    const profit = await this.calculateDailyProfit(date);
    return { date, daily_profit: profit };
  }

  /**
   * Create or update single sales record
   * @param {Object} data
   */
  async upsertSale(data) {
    const { date, menu_item_id, quantity_sold } = data;

    // Verify menu item exists
    const menuItem = await this.menuItemRepo.findById(menu_item_id);
    if (!menuItem) {
      throw new NotFoundError('Menu Item');
    }

    const sale = await this.salesRepo.upsert(date, menu_item_id, quantity_sold);
    this.logger.info({ date, menuItemId: menu_item_id }, 'Sale upserted');

    return sale
      ? { ...sale, menu_item_name: menuItem.name, selling_price: menuItem.selling_price }
      : null;
  }

  /**
   * Add to existing sales quantity
   * @param {Object} data
   */
  async addSale(data) {
    const { date, menu_item_id, quantity_sold } = data;

    if (quantity_sold <= 0) {
      throw new ValidationError('quantity_sold must be positive');
    }

    const menuItem = await this.menuItemRepo.findById(menu_item_id);
    if (!menuItem) {
      throw new NotFoundError('Menu Item');
    }

    const sale = await this.salesRepo.addQuantity(date, menu_item_id, quantity_sold);
    this.logger.info({ date, menuItemId: menu_item_id, quantity: quantity_sold }, 'Sale added');

    return { ...sale, menu_item_name: menuItem.name, selling_price: menuItem.selling_price };
  }

  /**
   * Update a sales record
   * @param {number} id
   * @param {number} quantitySold
   */
  async update(id, quantitySold) {
    const sale = await this.salesRepo.update(id, { quantity_sold: quantitySold });
    if (!sale) {
      throw new NotFoundError('Sales record');
    }

    const menuItem = await this.menuItemRepo.findById(sale.menu_item_id);
    return { ...sale, menu_item_name: menuItem?.name, selling_price: menuItem?.selling_price };
  }

  /**
   * Delete a sales record
   * @param {number} id
   */
  async delete(id) {
    await this.salesRepo.deleteOrFail(id, 'Sales record');
    this.logger.info({ saleId: id }, 'Sale deleted');
  }

  /**
   * Get analytics for a period - OPTIMIZED (fixes N+1)
   * @param {string} period
   */
  async getAnalytics(period = 'month') {
    const { sql: dateFilter, params } = this.salesRepo.getDateFilter(period);
    const salesWithCosts = await this.salesRepo.findSalesWithCosts(dateFilter, params);

    // Process sales with pre-computed costs
    const processedSales = salesWithCosts.map((sale) => {
      const ingredientCost = parseFloat(sale.ingredient_cost) || 0;
      const qFactor = parseFloat(sale.q_factor) || 0;
      const plateCost = ingredientCost + qFactor;
      const laborCost = calculateLaborCost(sale.estimated_prep_time_minutes || 0);
      const primeCost = plateCost + laborCost;
      const sellingPrice = parseFloat(sale.selling_price) || 0;
      const quantitySold = parseInt(sale.quantity_sold, 10) || 0;

      return {
        menu_item_id: sale.menu_item_id,
        menu_item_name: sale.menu_item_name,
        quantity_sold: quantitySold,
        selling_price: sellingPrice,
        plate_cost: plateCost,
        labor_cost: laborCost,
        prime_cost: primeCost,
        revenue: quantitySold * sellingPrice,
        cogs: quantitySold * plateCost,
        labor_cogs: quantitySold * laborCost,
        total_cogs: quantitySold * primeCost,
        gross_profit: quantitySold * sellingPrice - quantitySold * plateCost,
        net_profit: quantitySold * sellingPrice - quantitySold * primeCost,
      };
    });

    // Aggregate totals
    const totals = calculateTimeBasedPL(
      processedSales.map((s) => ({
        quantity_sold: s.quantity_sold,
        selling_price: s.selling_price,
        plate_cost: s.prime_cost,
      }))
    );

    // Add labor breakdown
    const totalLaborCost = processedSales.reduce((sum, s) => sum + s.labor_cogs, 0);
    const totalFoodCost = processedSales.reduce((sum, s) => sum + s.cogs, 0);
    totals.totalLaborCost = parseFloat(totalLaborCost.toFixed(2));
    totals.totalFoodCost = parseFloat(totalFoodCost.toFixed(2));
    totals.primeCostPercent =
      totals.totalRevenue > 0
        ? parseFloat(((totals.totalCOGS / totals.totalRevenue) * 100).toFixed(2))
        : 0;

    // Group by menu item
    const itemMap = new Map();
    for (const sale of processedSales) {
      const existing = itemMap.get(sale.menu_item_id);
      if (existing) {
        existing.quantity_sold += sale.quantity_sold;
        existing.revenue += sale.revenue;
        existing.cogs += sale.cogs;
        existing.labor_cogs += sale.labor_cogs;
        existing.total_cogs += sale.total_cogs;
        existing.gross_profit += sale.gross_profit;
        existing.net_profit += sale.net_profit;
      } else {
        itemMap.set(sale.menu_item_id, { ...sale });
      }
    }

    const breakdown = Array.from(itemMap.values())
      .map((item) => ({
        ...item,
        revenue: parseFloat(item.revenue.toFixed(2)),
        cogs: parseFloat(item.cogs.toFixed(2)),
        labor_cogs: parseFloat(item.labor_cogs.toFixed(2)),
        total_cogs: parseFloat(item.total_cogs.toFixed(2)),
        gross_profit: parseFloat(item.gross_profit.toFixed(2)),
        net_profit: parseFloat(item.net_profit.toFixed(2)),
        profit: parseFloat(item.net_profit.toFixed(2)),
        food_cost_percent:
          item.revenue > 0 ? parseFloat(((item.cogs / item.revenue) * 100).toFixed(2)) : 0,
        prime_cost_percent:
          item.revenue > 0 ? parseFloat(((item.total_cogs / item.revenue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.net_profit - a.net_profit);

    return { period, totals, breakdown };
  }

  /**
   * Calculate daily profit
   * @param {string} date
   */
  async calculateDailyProfit(date) {
    const { sql, params } = { sql: 's.date = $1', params: [date] };
    const salesWithCosts = await this.salesRepo.findSalesWithCosts(sql, params);

    let totalProfit = 0;
    for (const sale of salesWithCosts) {
      const ingredientCost = parseFloat(sale.ingredient_cost) || 0;
      const qFactor = parseFloat(sale.q_factor) || 0;
      const plateCost = ingredientCost + qFactor;
      const sellingPrice = parseFloat(sale.selling_price) || 0;
      const quantitySold = parseInt(sale.quantity_sold, 10) || 0;

      totalProfit += quantitySold * sellingPrice - quantitySold * plateCost;
    }

    return parseFloat(totalProfit.toFixed(2));
  }
}

module.exports = SalesService;

