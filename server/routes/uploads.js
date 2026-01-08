/**
 * Upload/Document Routes
 * Updated with centralized error handling and validation
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const supabase = require('../utils/supabase');
const { asyncHandler, NotFoundError, BadRequestError, ServiceUnavailableError } = require('../utils/errors');
const { validateBody, validateId } = require('../middleware');
const {
  createUploadSchema,
  completeUploadSchema,
  attachDocumentSchema,
} = require('../schemas/upload.schema');

/**
 * Generate unique object path for storage
 */
function generateObjectPath(originalFilename) {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  const ext = originalFilename.split('.').pop()?.toLowerCase() || 'bin';
  return `documents/${timestamp}-${randomBytes}.${ext}`;
}

// ============================================
// UPLOAD WORKFLOW
// ============================================

/**
 * POST /api/uploads/create
 * Create signed upload URL
 */
router.post('/create', validateBody(createUploadSchema), asyncHandler(async (req, res) => {
  if (!supabase.isConfigured()) {
    throw new ServiceUnavailableError('File uploads are not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const { original_filename, mime_type, vendor_id } = req.body;
  const objectPath = generateObjectPath(original_filename);
  const bucket = supabase.getBucket();

  // Create document record
  const result = await db.promisify.run(`
    INSERT INTO documents (vendor_id, bucket, object_path, original_filename, mime_type, upload_status)
    VALUES ($1, $2, $3, $4, $5, 'pending')
  `, [vendor_id, bucket, objectPath, original_filename, mime_type]);

  // Create signed upload URL
  const signedData = await supabase.createSignedUploadUrl(objectPath);

  res.status(201).json({
    document_id: result.id,
    upload_url: signedData.signedUrl,
    token: signedData.token,
    path: signedData.path,
    object_path: objectPath
  });
}));

/**
 * POST /api/uploads/complete
 * Mark upload as complete
 */
router.post('/complete', validateBody(completeUploadSchema), asyncHandler(async (req, res) => {
  const { document_id, expense_id, size_bytes, sha256 } = req.body;

  await db.promisify.run(`
    UPDATE documents SET 
      upload_status = 'completed',
      size_bytes = $1,
      sha256 = $2,
      uploaded_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `, [size_bytes, sha256, document_id]);

  // Link to expense if provided
  if (expense_id) {
    await db.promisify.run(`
      INSERT INTO expense_documents (expense_id, document_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [expense_id, document_id]);
  }

  const document = await db.promisify.get('SELECT * FROM documents WHERE id = $1', [document_id]);

  res.json({
    success: true,
    document,
    linked_expense_id: expense_id || null
  });
}));

/**
 * POST /api/uploads/attach
 * Attach document to expense
 */
router.post('/attach', validateBody(attachDocumentSchema), asyncHandler(async (req, res) => {
  const { document_id, expense_id } = req.body;

  // Verify document exists
  const document = await db.promisify.get('SELECT * FROM documents WHERE id = $1', [document_id]);
  if (!document) {throw new NotFoundError('Document');}

  // Verify expense exists
  const expense = await db.promisify.get('SELECT id FROM expenses WHERE id = $1', [expense_id]);
  if (!expense) {throw new NotFoundError('Expense');}

  await db.promisify.run(`
    INSERT INTO expense_documents (expense_id, document_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `, [expense_id, document_id]);

  res.json({
    success: true,
    message: 'Document attached to expense',
    document_id,
    expense_id
  });
}));

// ============================================
// DOWNLOAD
// ============================================

router.get('/download/:id', validateId, asyncHandler(async (req, res) => {
  const document = await db.promisify.get('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  if (!document) {throw new NotFoundError('Document');}

  if (document.upload_status !== 'completed') {
    throw new BadRequestError('Document upload is not complete');
  }

  if (!supabase.isConfigured()) {
    throw new ServiceUnavailableError('File downloads are not configured');
  }

  const signedUrl = await supabase.createSignedDownloadUrl(document.object_path);

  res.json({
    document_id: document.id,
    original_filename: document.original_filename,
    mime_type: document.mime_type,
    download_url: signedUrl,
    expires_in: 3600
  });
}));

// ============================================
// DELETE
// ============================================

router.delete('/:id', validateId, asyncHandler(async (req, res) => {
  const document = await db.promisify.get('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  if (!document) {throw new NotFoundError('Document');}

  // Delete from storage if uploaded
  if (document.upload_status === 'completed' && supabase.isConfigured()) {
    try {
      await supabase.deleteObject(document.object_path);
    } catch (err) {
      // Log but don't fail if storage delete fails
      console.warn('Failed to delete from storage:', err.message);
    }
  }

  // Delete from database (will cascade to expense_documents)
  await db.promisify.run('DELETE FROM documents WHERE id = $1', [req.params.id]);

  res.json({
    success: true,
    message: 'Document deleted'
  });
}));

// ============================================
// STATUS
// ============================================

router.get('/status', asyncHandler(async (req, res) => {
  const configured = supabase.isConfigured();
  const bucket = supabase.getBucket();

  const stats = await db.promisify.get(`
    SELECT 
      COUNT(*) as total_documents,
      COUNT(CASE WHEN upload_status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN upload_status = 'pending' THEN 1 END) as pending,
      COALESCE(SUM(size_bytes), 0) as total_size_bytes
    FROM documents
  `);

  res.json({
    configured,
    bucket: configured ? bucket : null,
    stats: {
      total_documents: parseInt(stats?.total_documents) || 0,
      completed: parseInt(stats?.completed) || 0,
      pending: parseInt(stats?.pending) || 0,
      total_size_mb: stats?.total_size_bytes 
        ? (parseFloat(stats.total_size_bytes) / (1024 * 1024)).toFixed(2) 
        : '0.00'
    }
  });
}));

module.exports = router;
