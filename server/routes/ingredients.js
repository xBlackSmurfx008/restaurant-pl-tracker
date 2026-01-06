const express = require('express');
const router = express.Router();
const db = require('../db');
const { calculateCostPerUnit, suggestConversion } = require('../utils/calculations');

// Get all ingredients with vendor info
router.get('/', async (req, res) => {
  try {
    const ingredients = await db.promisify.all(`
      SELECT 
        i.*,
        v.name as vendor_name,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_usage_unit
      FROM ingredients i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      ORDER BY i.name
    `);
    res.json(ingredients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single ingredient
router.get('/:id', async (req, res) => {
  try {
    const ingredient = await db.promisify.get(`
      SELECT 
        i.*,
        v.name as vendor_name,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_usage_unit
      FROM ingredients i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.id = ?
    `, [req.params.id]);
    
    if (!ingredient) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create ingredient
router.post('/', async (req, res) => {
  try {
    const { vendor_id, name, purchase_price, purchase_unit, usage_unit, unit_conversion_factor, yield_percent } = req.body;
    
    if (!name || !purchase_price || !purchase_unit || !usage_unit || !unit_conversion_factor) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (unit_conversion_factor <= 0) {
      return res.status(400).json({ error: 'Conversion factor must be greater than 0' });
    }

    const result = await db.promisify.run(
      `INSERT INTO ingredients 
       (vendor_id, name, purchase_price, purchase_unit, usage_unit, unit_conversion_factor, yield_percent) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        vendor_id || null,
        name,
        purchase_price,
        purchase_unit,
        usage_unit,
        unit_conversion_factor,
        yield_percent || 1.0
      ]
    );

    const ingredient = await db.promisify.get(`
      SELECT 
        i.*,
        v.name as vendor_name,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_usage_unit
      FROM ingredients i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.id = $1
    `, [result.id]);

    res.status(201).json(ingredient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suggest conversion factor
router.post('/suggest-conversion', (req, res) => {
  try {
    const { purchase_unit, usage_unit } = req.body;
    
    if (!purchase_unit || !usage_unit) {
      return res.status(400).json({ error: 'Both purchase_unit and usage_unit are required' });
    }

    const factor = suggestConversion(purchase_unit, usage_unit);
    
    if (factor === null) {
      return res.json({ 
        suggested: false, 
        message: 'No automatic conversion found. Please enter the conversion factor manually.' 
      });
    }

    res.json({ 
      suggested: true, 
      conversion_factor: factor,
      message: `There are ${factor} ${usage_unit} in 1 ${purchase_unit}. Correct?`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update ingredient
router.put('/:id', async (req, res) => {
  try {
    const { vendor_id, name, purchase_price, purchase_unit, usage_unit, unit_conversion_factor, yield_percent } = req.body;
    
    // Update last_price_update if price changed
    const oldIngredient = await db.promisify.get('SELECT purchase_price FROM ingredients WHERE id = $1', [req.params.id]);
    const priceChanged = oldIngredient && parseFloat(oldIngredient.purchase_price) !== parseFloat(purchase_price);

    await db.promisify.run(
      `UPDATE ingredients 
       SET vendor_id = $1, name = $2, purchase_price = $3, purchase_unit = $4, 
           usage_unit = $5, unit_conversion_factor = $6, yield_percent = $7,
           last_price_update = CASE WHEN $8 THEN CURRENT_DATE ELSE last_price_update END
       WHERE id = $9`,
      [
        vendor_id,
        name,
        purchase_price,
        purchase_unit,
        usage_unit,
        unit_conversion_factor,
        yield_percent || 1.0,
        priceChanged ? 1 : 0,
        req.params.id
      ]
    );

    const ingredient = await db.promisify.get(`
      SELECT 
        i.*,
        v.name as vendor_name,
        (i.purchase_price / (i.unit_conversion_factor * i.yield_percent)) as cost_per_usage_unit
      FROM ingredients i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (!ingredient) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete ingredient
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.promisify.run('DELETE FROM ingredients WHERE id = $1', [req.params.id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    
    res.json({ message: 'Ingredient deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ingredients that need price updates (Price Watch Alert)
router.get('/alerts/price-watch', async (req, res) => {
  try {
    const daysThreshold = req.query.days || 30;
    const ingredients = await db.promisify.all(`
      SELECT 
        i.*,
        v.name as vendor_name,
        (CURRENT_DATE - i.last_price_update)::integer as days_since_update
      FROM ingredients i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE (CURRENT_DATE - i.last_price_update)::integer >= $1
      ORDER BY days_since_update DESC
    `, [daysThreshold]);
    
    res.json(ingredients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

