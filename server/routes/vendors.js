const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all vendors
router.get('/', async (req, res) => {
  try {
    const vendors = await db.promisify.all('SELECT * FROM vendors ORDER BY name');
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single vendor
router.get('/:id', async (req, res) => {
  try {
    const vendor = await db.promisify.get('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create vendor
router.post('/', async (req, res) => {
  try {
    const { name, account_number, contact_person, phone, email, delivery_days } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const result = await db.promisify.run(
      'INSERT INTO vendors (name, account_number, contact_person, phone, email, delivery_days) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, account_number || null, contact_person || null, phone || null, email || null, delivery_days || null]
    );

    const vendor = await db.promisify.get('SELECT * FROM vendors WHERE id = $1', [result.id]);
    res.status(201).json(vendor);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Vendor name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update vendor
router.put('/:id', async (req, res) => {
  try {
    const { name, account_number, contact_person, phone, email, delivery_days } = req.body;
    
    await db.promisify.run(
      'UPDATE vendors SET name = $1, account_number = $2, contact_person = $3, phone = $4, email = $5, delivery_days = $6 WHERE id = $7',
      [name, account_number, contact_person, phone, email, delivery_days, req.params.id]
    );

    const vendor = await db.promisify.get('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete vendor
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.promisify.run('DELETE FROM vendors WHERE id = $1', [req.params.id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

