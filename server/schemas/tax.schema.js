/**
 * Tax validation schemas
 */
const { z } = require('zod');
const { optionalString } = require('./common');

const taxYearParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

const exportTypes = ['expenses', 'schedule-c', '1099-vendors'];

const exportParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  type: z.enum(exportTypes),
});

const documentTypes = ['schedule_c', 'quarterly_estimate', '1099_nec', 'w2', 'expense_report', 'other'];
const documentStatuses = ['draft', 'final', 'filed', 'amended'];

const saveTaxDocumentSchema = z.object({
  tax_year: z.coerce.number().int().min(2000).max(2100),
  document_type: z.enum(documentTypes),
  document_name: z.string().min(1).max(255),
  file_path: optionalString.transform(v => v || null),
  status: z.enum(documentStatuses).optional().default('draft'),
  notes: optionalString.transform(v => v || null),
});

module.exports = {
  taxYearParamSchema,
  exportParamSchema,
  saveTaxDocumentSchema,
  exportTypes,
  documentTypes,
  documentStatuses,
};

