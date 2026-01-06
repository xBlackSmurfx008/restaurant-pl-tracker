const express = require('express');
const router = express.Router();
const db = require('../db');
const { calculateTimeBasedPL, calculatePlateCost, calculateLaborCost } = require('../utils/calculations');

// Get sales log with date range filter
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT 
        s.*,
        m.name as menu_item_name,
        m.selling_price
      FROM sales_log s
      JOIN menu_items m ON s.menu_item_id = m.id
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date && end_date) {
      query += ` WHERE s.date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(start_date, end_date);
      paramIndex += 2;
    } else if (start_date) {
      query += ` WHERE s.date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex += 1;
    } else if (end_date) {
      query += ` WHERE s.date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex += 1;
    }

    query += ' ORDER BY s.date DESC, m.name';

    const sales = await db.promisify.all(query, params);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sales for a specific date
router.get('/date/:date', async (req, res) => {
  try {
    const sales = await db.promisify.all(`
      SELECT 
        s.*,
        m.name as menu_item_name,
        m.selling_price
      FROM sales_log s
      JOIN menu_items m ON s.menu_item_id = m.id
      WHERE s.date = $1
      ORDER BY m.name
    `, [req.params.date]);
    
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create or update daily sales (bulk)
router.post('/daily', async (req, res) => {
  try {
    const { date, sales } = req.body; // sales is array of {menu_item_id, quantity_sold}
    
    if (!date || !Array.isArray(sales)) {
      return res.status(400).json({ error: 'Date and sales array are required' });
    }

    // Use transaction for atomicity
    await db.transaction(async (client) => {
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
          // Remove entry if quantity is 0
          await client.query(
            'DELETE FROM sales_log WHERE date = $1 AND menu_item_id = $2',
            [date, sale.menu_item_id]
          );
        }
      }
    });
    
    // Calculate and return daily profit
    try {
      const profit = await calculateDailyProfit(date);
      res.status(201).json({ 
        message: 'Sales saved successfully',
        daily_profit: profit
      });
    } catch (error) {
      res.status(201).json({ message: 'Sales saved successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a single sales record (manual entry - replaces existing)
router.post('/', async (req, res) => {
  try {
    const { date, menu_item_id, quantity_sold } = req.body;
    
    if (!date || !menu_item_id || quantity_sold === undefined) {
      return res.status(400).json({ error: 'Date, menu_item_id, and quantity_sold are required' });
    }

    const result = await db.query(
      `INSERT INTO sales_log (date, menu_item_id, quantity_sold) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (date, menu_item_id) 
       DO UPDATE SET quantity_sold = EXCLUDED.quantity_sold
       RETURNING *`,
      [date, menu_item_id, quantity_sold]
    );

    const sale = result.rows[0];
    const menuItem = await db.promisify.get('SELECT name, selling_price FROM menu_items WHERE id = $1', [menu_item_id]);
    
    res.status(201).json({
      ...sale,
      menu_item_name: menuItem?.name,
      selling_price: menuItem?.selling_price
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add sales to existing quantity (increments if exists, creates if not)
router.post('/add', async (req, res) => {
  try {
    const { date, menu_item_id, quantity_sold } = req.body;
    
    if (!date || !menu_item_id || quantity_sold === undefined || quantity_sold <= 0) {
      return res.status(400).json({ error: 'Date, menu_item_id, and positive quantity_sold are required' });
    }

    const result = await db.query(
      `INSERT INTO sales_log (date, menu_item_id, quantity_sold) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (date, menu_item_id) 
       DO UPDATE SET quantity_sold = sales_log.quantity_sold + EXCLUDED.quantity_sold
       RETURNING *`,
      [date, menu_item_id, quantity_sold]
    );

    const sale = result.rows[0];
    const menuItem = await db.promisify.get('SELECT name, selling_price FROM menu_items WHERE id = $1', [menu_item_id]);
    
    res.status(201).json({
      ...sale,
      menu_item_name: menuItem?.name,
      selling_price: menuItem?.selling_price
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a single sales record
router.put('/:id', async (req, res) => {
  try {
    const { quantity_sold } = req.body;
    
    if (quantity_sold === undefined) {
      return res.status(400).json({ error: 'quantity_sold is required' });
    }

    const result = await db.query(
      'UPDATE sales_log SET quantity_sold = $1 WHERE id = $2 RETURNING *',
      [quantity_sold, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sales record not found' });
    }

    const sale = result.rows[0];
    const menuItem = await db.promisify.get('SELECT name, selling_price FROM menu_items WHERE id = $1', [sale.menu_item_id]);
    
    res.json({
      ...sale,
      menu_item_name: menuItem?.name,
      selling_price: menuItem?.selling_price
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a single sales record
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM sales_log WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sales record not found' });
    }
    
    res.json({ message: 'Sales record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate daily profit
async function calculateDailyProfit(date) {
  const sales = await db.promisify.all(`
    SELECT 
      s.quantity_sold,
      m.selling_price,
      m.id as menu_item_id
    FROM sales_log s
    JOIN menu_items m ON s.menu_item_id = m.id
    WHERE s.date = $1
  `, [date]);

  // Get plate costs for each menu item
  const salesWithCosts = await Promise.all(sales.map(async (sale) => {
    const recipeItems = await db.promisify.all(`
      SELECT 
        r.quantity_used,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_unit
      FROM recipe_map r
      JOIN ingredients i ON r.ingredient_id = i.id
      WHERE r.menu_item_id = $1
    `, [sale.menu_item_id]);

    const menuItem = await db.promisify.get('SELECT q_factor FROM menu_items WHERE id = $1', [sale.menu_item_id]);
    const plateCost = calculatePlateCost(recipeItems, menuItem?.q_factor || 0);

    return {
      quantity_sold: sale.quantity_sold,
      selling_price: sale.selling_price,
      plate_cost: plateCost
    };
  }));

  const pl = calculateTimeBasedPL(salesWithCosts);
  return pl.netProfit;
}

// Get dashboard analytics
router.get('/analytics', async (req, res) => {
  try {
    const { period } = req.query; // 'today', 'week', 'month', 'quarter', 'year', 'ytd'
    
    let dateFilter = '';
    const params = [];
    const now = new Date();

    switch (period) {
      case 'today':
        dateFilter = "s.date = CURRENT_DATE";
        break;
      case 'week':
        dateFilter = "s.date >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "s.date >= DATE_TRUNC('month', CURRENT_DATE)::DATE";
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        dateFilter = "s.date >= $1";
        params.push(quarterStart.toISOString().split('T')[0]);
        break;
      case 'year':
        // Previous full calendar year (Jan 1 -> Dec 31 of last year)
        dateFilter = "s.date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')::DATE AND s.date < DATE_TRUNC('year', CURRENT_DATE)::DATE";
        break;
      case 'ytd':
        // Current year-to-date (Jan 1 -> today)
        dateFilter = "s.date >= DATE_TRUNC('year', CURRENT_DATE)::DATE";
        break;
      default:
        dateFilter = "s.date >= CURRENT_DATE - INTERVAL '30 days'"; // Default to last 30 days
    }

    // Get all sales in period
    const sales = await db.promisify.all(`
      SELECT 
        s.quantity_sold,
        m.selling_price,
        m.id as menu_item_id,
        m.name as menu_item_name
      FROM sales_log s
      JOIN menu_items m ON s.menu_item_id = m.id
      WHERE ${dateFilter}
    `, params);

    // Calculate plate costs and aggregate
    const salesWithCosts = await Promise.all(sales.map(async (sale) => {
      const recipeItems = await db.promisify.all(`
        SELECT 
          r.quantity_used,
          (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_unit
        FROM recipe_map r
        JOIN ingredients i ON r.ingredient_id = i.id
        WHERE r.menu_item_id = $1
      `, [sale.menu_item_id]);

      const menuItem = await db.promisify.get('SELECT q_factor, estimated_prep_time_minutes FROM menu_items WHERE id = $1', [sale.menu_item_id]);
      const plateCost = calculatePlateCost(recipeItems, menuItem?.q_factor || 0);
      const laborCost = calculateLaborCost(menuItem?.estimated_prep_time_minutes || 0);
      const primeCost = plateCost + laborCost;

      return {
        menu_item_id: sale.menu_item_id,
        menu_item_name: sale.menu_item_name,
        quantity_sold: sale.quantity_sold,
        selling_price: sale.selling_price,
        plate_cost: plateCost,
        labor_cost: laborCost,
        prime_cost: primeCost,
        revenue: sale.quantity_sold * sale.selling_price,
        cogs: sale.quantity_sold * plateCost,
        labor_cogs: sale.quantity_sold * laborCost,
        total_cogs: sale.quantity_sold * primeCost,
        gross_profit: (sale.quantity_sold * sale.selling_price) - (sale.quantity_sold * plateCost),
        net_profit: (sale.quantity_sold * sale.selling_price) - (sale.quantity_sold * primeCost)
      };
    }));

    // Aggregate totals (using net profit for calculations)
    const totals = calculateTimeBasedPL(salesWithCosts.map(s => ({
      quantity_sold: s.quantity_sold,
      selling_price: s.selling_price,
      plate_cost: s.prime_cost // Use prime cost for net profit calculation
    })));
    
    // Add labor cost breakdown to totals
    const totalLaborCost = salesWithCosts.reduce((sum, s) => sum + s.labor_cogs, 0);
    const totalFoodCost = salesWithCosts.reduce((sum, s) => sum + s.cogs, 0);
    totals.totalLaborCost = parseFloat(totalLaborCost.toFixed(2));
    totals.totalFoodCost = parseFloat(totalFoodCost.toFixed(2));
    totals.primeCostPercent = totals.totalRevenue > 0 
      ? parseFloat(((totals.totalCOGS / totals.totalRevenue) * 100).toFixed(2))
      : 0;

    // Group by menu item for breakdown
    const itemBreakdown = salesWithCosts.reduce((acc, sale) => {
      const key = sale.menu_item_id;
      if (!acc[key]) {
        acc[key] = {
          menu_item_id: sale.menu_item_id,
          menu_item_name: sale.menu_item_name,
          quantity_sold: 0,
          revenue: 0,
          cogs: 0,
          labor_cogs: 0,
          total_cogs: 0,
          gross_profit: 0,
          net_profit: 0
        };
      }
      acc[key].quantity_sold += sale.quantity_sold;
      acc[key].revenue += sale.revenue;
      acc[key].cogs += sale.cogs;
      acc[key].labor_cogs += sale.labor_cogs;
      acc[key].total_cogs += sale.total_cogs;
      acc[key].gross_profit += sale.gross_profit;
      acc[key].net_profit += sale.net_profit;
      return acc;
    }, {});

    const breakdown = Object.values(itemBreakdown)
      .map(item => ({
        ...item,
        revenue: parseFloat(item.revenue.toFixed(2)),
        cogs: parseFloat(item.cogs.toFixed(2)),
        labor_cogs: parseFloat(item.labor_cogs.toFixed(2)),
        total_cogs: parseFloat(item.total_cogs.toFixed(2)),
        gross_profit: parseFloat(item.gross_profit.toFixed(2)),
        net_profit: parseFloat(item.net_profit.toFixed(2)),
        profit: parseFloat(item.net_profit.toFixed(2)), // For backward compatibility
        food_cost_percent: item.revenue > 0 ? parseFloat(((item.cogs / item.revenue) * 100).toFixed(2)) : 0,
        prime_cost_percent: item.revenue > 0 ? parseFloat(((item.total_cogs / item.revenue) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.net_profit - a.net_profit);

    res.json({
      period,
      totals,
      breakdown
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

