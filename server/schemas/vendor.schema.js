/**
 * Vendor validation schemas
 */
const { z } = require('zod');
const { nonEmptyString, optionalString, email, phone } = require('./common');

const createVendorSchema = z.object({
  name: nonEmptyString.max(255),
  account_number: optionalString.transform(v => v || null),
  contact_person: optionalString.transform(v => v || null),
  phone: phone.transform(v => v || null),
  email: email.transform(v => v || null),
  delivery_days: optionalString.transform(v => v || null),
});

const updateVendorSchema = createVendorSchema.partial();

module.exports = {
  createVendorSchema,
  updateVendorSchema,
};

