/**
 * Vendor Routes - Thin controller layer
 */
const express = require('express');
const router = express.Router();

const { pool } = require('../db');
const { VendorRepository } = require('../repositories');
const { VendorService } = require('../services');
const { asyncHandler } = require('../utils/errors');
const { validateBody, validateId } = require('../middleware');
const { createVendorSchema, updateVendorSchema } = require('../schemas/vendor.schema');

// Initialize service
const vendorRepo = new VendorRepository(pool);
const vendorService = new VendorService(vendorRepo);

/**
 * GET /api/vendors
 * Get all vendors
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const vendors = await vendorService.getAll();
    res.json(vendors);
  })
);

/**
 * GET /api/vendors/:id
 * Get vendor by ID
 */
router.get(
  '/:id',
  validateId,
  asyncHandler(async (req, res) => {
    const vendor = await vendorService.getById(req.params.id);
    res.json(vendor);
  })
);

/**
 * POST /api/vendors
 * Create a new vendor
 */
router.post(
  '/',
  validateBody(createVendorSchema),
  asyncHandler(async (req, res) => {
    const vendor = await vendorService.create(req.body);
    res.status(201).json(vendor);
  })
);

/**
 * PUT /api/vendors/:id
 * Update a vendor
 */
router.put(
  '/:id',
  validateId,
  validateBody(updateVendorSchema),
  asyncHandler(async (req, res) => {
    const vendor = await vendorService.update(req.params.id, req.body);
    res.json(vendor);
  })
);

/**
 * DELETE /api/vendors/:id
 * Delete a vendor
 */
router.delete(
  '/:id',
  validateId,
  asyncHandler(async (req, res) => {
    await vendorService.delete(req.params.id);
    res.json({ success: true, message: 'Vendor deleted successfully' });
  })
);

module.exports = router;
