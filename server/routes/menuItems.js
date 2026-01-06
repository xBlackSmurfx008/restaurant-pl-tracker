const express = require('express');
const router = express.Router();
const db = require('../db');
const { calculatePlateCost, calculateProfitability, calculateLaborCost } = require('../utils/calculations');

// Get all menu items with calculated costs
router.get('/', async (req, res) => {
  try {
    const menuItems = await db.promisify.all(`
      SELECT 
        m.*,
        COUNT(DISTINCT r.id) as ingredient_count
      FROM menu_items m
      LEFT JOIN recipe_map r ON m.id = r.menu_item_id
      GROUP BY m.id
      ORDER BY m.name
    `);

    // Calculate plate cost and profitability for each item
    const itemsWithCosts = await Promise.all(menuItems.map(async (item) => {
      const recipeItems = await db.promisify.all(`
        SELECT 
          r.quantity_used,
          (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_unit
        FROM recipe_map r
        JOIN ingredients i ON r.ingredient_id = i.id
        WHERE r.menu_item_id = $1
      `, [item.id]);

      const plateCost = calculatePlateCost(recipeItems, item.q_factor || 0);
      const laborCost = calculateLaborCost(item.estimated_prep_time_minutes || 0);
      const profitability = calculateProfitability(item.selling_price || 0, plateCost, laborCost);

      // Ensure plateCost is a valid number
      const safePlateCost = isNaN(plateCost) ? 0 : parseFloat(Number(plateCost).toFixed(2));

      return {
        ...item,
        plate_cost: safePlateCost,
        ...profitability
      };
    }));

    res.json(itemsWithCosts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single menu item with full recipe details
router.get('/:id', async (req, res) => {
  try {
    const menuItem = await db.promisify.get('SELECT * FROM menu_items WHERE id = $1', [req.params.id]);
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Get recipe ingredients
    const recipeItems = await db.promisify.all(`
      SELECT 
        r.id,
        r.quantity_used,
        i.id as ingredient_id,
        i.name as ingredient_name,
        i.usage_unit,
        i.purchase_price,
        i.unit_conversion_factor,
        i.yield_percent,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_unit,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) * r.quantity_used as line_cost
      FROM recipe_map r
      JOIN ingredients i ON r.ingredient_id = i.id
      WHERE r.menu_item_id = $1
      ORDER BY i.name
    `, [req.params.id]);

    const plateCost = calculatePlateCost(recipeItems, menuItem.q_factor || 0);
    const laborCost = calculateLaborCost(menuItem.estimated_prep_time_minutes || 0);
    const profitability = calculateProfitability(menuItem.selling_price || 0, plateCost, laborCost);

    // Ensure all values are valid numbers
    const safePlateCost = isNaN(plateCost) ? 0 : parseFloat(Number(plateCost).toFixed(2));
    const safeLaborCost = isNaN(laborCost) ? 0 : parseFloat(Number(laborCost).toFixed(2));

    res.json({
      ...menuItem,
      recipe: recipeItems || [],
      plate_cost: safePlateCost,
      laborCost: safeLaborCost,
      primeCost: profitability.primeCost,
      primeCostPercent: profitability.primeCostPercent,
      netProfit: profitability.netProfit,
      ...profitability
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create menu item
router.post('/', async (req, res) => {
  try {
    const { name, selling_price, q_factor, target_cost_percent, estimated_prep_time_minutes } = req.body;
    
    if (!name || !selling_price) {
      return res.status(400).json({ error: 'Name and selling price are required' });
    }

    const result = await db.promisify.run(
      'INSERT INTO menu_items (name, selling_price, q_factor, target_cost_percent, estimated_prep_time_minutes) VALUES ($1, $2, $3, $4, $5)',
      [name, selling_price, q_factor || 0, target_cost_percent || 35.0, estimated_prep_time_minutes || 0]
    );

    const menuItem = await db.promisify.get('SELECT * FROM menu_items WHERE id = $1', [result.id]);
    res.status(201).json(menuItem);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Menu item name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update menu item
router.put('/:id', async (req, res) => {
  try {
    const { name, selling_price, q_factor, target_cost_percent, estimated_prep_time_minutes } = req.body;
    
    await db.promisify.run(
      'UPDATE menu_items SET name = $1, selling_price = $2, q_factor = $3, target_cost_percent = $4, estimated_prep_time_minutes = $5 WHERE id = $6',
      [name, selling_price, q_factor || 0, target_cost_percent || 35.0, estimated_prep_time_minutes || 0, req.params.id]
    );

    const menuItem = await db.promisify.get('SELECT * FROM menu_items WHERE id = $1', [req.params.id]);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete menu item
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.promisify.run('DELETE FROM menu_items WHERE id = $1', [req.params.id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add ingredient to recipe
router.post('/:id/recipe', async (req, res) => {
  try {
    const { ingredient_id, quantity_used } = req.body;
    
    if (!ingredient_id || quantity_used === undefined) {
      return res.status(400).json({ error: 'Ingredient ID and quantity are required' });
    }

    const result = await db.promisify.run(
      `INSERT INTO recipe_map (menu_item_id, ingredient_id, quantity_used) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (menu_item_id, ingredient_id) 
       DO UPDATE SET quantity_used = EXCLUDED.quantity_used`,
      [req.params.id, ingredient_id, quantity_used]
    );

    const recipeItem = await db.promisify.get(`
      SELECT 
        r.*,
        i.name as ingredient_name,
        i.usage_unit,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_unit
      FROM recipe_map r
      JOIN ingredients i ON r.ingredient_id = i.id
      WHERE r.menu_item_id = $1 AND r.ingredient_id = $2
    `, [req.params.id, ingredient_id]);

    res.status(201).json(recipeItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove ingredient from recipe
router.delete('/:id/recipe/:recipeId', async (req, res) => {
  try {
    const result = await db.promisify.run(
      'DELETE FROM recipe_map WHERE id = $1 AND menu_item_id = $2',
      [req.params.recipeId, req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Recipe item not found' });
    }
    
    res.json({ message: 'Ingredient removed from recipe' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

