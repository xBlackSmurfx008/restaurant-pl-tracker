/**
 * Upload/Document validation schemas
 */
const { z } = require('zod');
const { id, optionalId, nonEmptyString, money } = require('./common');

const mimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

const createUploadSchema = z.object({
  original_filename: nonEmptyString.max(255),
  mime_type: z.string().refine(
    (val) => mimeTypes.includes(val) || val.startsWith('image/'),
    { message: 'Unsupported file type' }
  ),
  vendor_id: optionalId.transform(v => v || null),
});

const completeUploadSchema = z.object({
  document_id: id,
  expense_id: optionalId.transform(v => v || null),
  size_bytes: z.coerce.number().int().nonnegative().optional().nullable(),
  sha256: z.string().optional().nullable(),
});

const attachDocumentSchema = z.object({
  document_id: id,
  expense_id: id,
});

module.exports = {
  createUploadSchema,
  completeUploadSchema,
  attachDocumentSchema,
  mimeTypes,
};

