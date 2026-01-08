/**
 * Vendor Service - Business logic for vendors
 */
const { serviceLogger } = require('../utils/logger');
const { NotFoundError, ConflictError } = require('../utils/errors');

class VendorService {
  /**
   * @param {import('../repositories/VendorRepository')} vendorRepo
   */
  constructor(vendorRepo) {
    this.vendorRepo = vendorRepo;
    this.logger = serviceLogger.child({ service: 'vendor' });
  }

  /**
   * Get all vendors
   */
  async getAll() {
    return this.vendorRepo.findAll();
  }

  /**
   * Get vendor by ID
   * @param {number} id
   */
  async getById(id) {
    const vendor = await this.vendorRepo.findById(id);
    if (!vendor) {
      throw new NotFoundError('Vendor');
    }
    return vendor;
  }

  /**
   * Create a new vendor
   * @param {Object} data
   */
  async create(data) {
    // Check for duplicate name
    const existing = await this.vendorRepo.findByName(data.name);
    if (existing) {
      throw new ConflictError(`Vendor "${data.name}" already exists`);
    }

    const vendor = await this.vendorRepo.create(data);
    this.logger.info({ vendorId: vendor.id, name: vendor.name }, 'Vendor created');
    return vendor;
  }

  /**
   * Update a vendor
   * @param {number} id
   * @param {Object} data
   */
  async update(id, data) {
    // Check vendor exists
    await this.getById(id);

    // Check for duplicate name if name is being changed
    if (data.name) {
      const existing = await this.vendorRepo.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Vendor "${data.name}" already exists`);
      }
    }

    const vendor = await this.vendorRepo.update(id, data);
    this.logger.info({ vendorId: id }, 'Vendor updated');
    return vendor;
  }

  /**
   * Delete a vendor
   * @param {number} id
   */
  async delete(id) {
    await this.vendorRepo.deleteOrFail(id, 'Vendor');
    this.logger.info({ vendorId: id }, 'Vendor deleted');
  }

  /**
   * Get vendors needing 1099 forms
   * @param {number} year
   * @param {number} threshold
   */
  async getVendorsFor1099(year, threshold = 600) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    return this.vendorRepo.findVendorsFor1099(startDate, endDate, threshold);
  }
}

module.exports = VendorService;

