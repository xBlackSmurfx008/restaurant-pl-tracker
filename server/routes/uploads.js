/**
 * Upload/Document Routes
 * Supports both PostgreSQL storage (default) and Supabase storage (optional)
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const supabase = require('../utils/supabase');
const { asyncHandler, NotFoundError, BadRequestError } = require('../utils/errors');
const { validateBody, validateId } = require('../middleware');
const {
  createUploadSchema,
  completeUploadSchema,
  attachDocumentSchema,
} = require('../schemas/upload.schema');

// Check if we should use Supabase or PostgreSQL for storage
const useSupabase = supabase.isConfigured();

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
 * Create upload record (and signed URL if using Supabase)
 */
router.post('/create', validateBody(createUploadSchema), asyncHandler(async (req, res) => {
  const { original_filename, mime_type, vendor_id } = req.body;
  const objectPath = generateObjectPath(original_filename);

  if (useSupabase) {
    // Supabase storage path
    const bucket = supabase.getBucket();
    const result = await db.promisify.run(`
      INSERT INTO documents (vendor_id, bucket, object_path, original_filename, mime_type, upload_status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
    `, [vendor_id, bucket, objectPath, original_filename, mime_type]);

    const signedData = await supabase.createSignedUploadUrl(objectPath);

    res.status(201).json({
      document_id: result.id,
      upload_url: signedData.signedUrl,
      token: signedData.token,
      path: signedData.path,
      object_path: objectPath,
      storage_type: 'supabase'
    });
  } else {
    // PostgreSQL storage path - return endpoint for direct upload
    const result = await db.promisify.run(`
      INSERT INTO documents (vendor_id, bucket, object_path, original_filename, mime_type, upload_status)
      VALUES ($1, 'local', $2, $3, $4, 'pending')
    `, [vendor_id, objectPath, original_filename, mime_type]);

    res.status(201).json({
      document_id: result.id,
      upload_url: `/api/uploads/data/${result.id}`,
      object_path: objectPath,
      storage_type: 'database'
    });
  }
}));

/**
 * PUT /api/uploads/data/:id
 * Upload file data directly to PostgreSQL (for database storage mode)
 */
router.put('/data/:id', validateId, asyncHandler(async (req, res) => {
  const documentId = req.params.id;
  
  // Get document record
  const document = await db.promisify.get('SELECT * FROM documents WHERE id = $1', [documentId]);
  if (!document) {
    throw new NotFoundError('Document');
  }
  
  if (document.upload_status === 'completed') {
    throw new BadRequestError('Document already uploaded');
  }

  // Get the raw body as buffer
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const fileBuffer = Buffer.concat(chunks);
  
  // Convert to base64 for storage
  const base64Data = fileBuffer.toString('base64');
  const sizeBytes = fileBuffer.length;
  
  // Calculate SHA256
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // Store in database
  await db.promisify.run(`
    UPDATE documents SET 
      file_data = $1,
      size_bytes = $2,
      sha256 = $3,
      upload_status = 'completed',
      uploaded_at = CURRENT_TIMESTAMP
    WHERE id = $4
  `, [base64Data, sizeBytes, sha256, documentId]);

  res.json({
    success: true,
    document_id: documentId,
    size_bytes: sizeBytes,
    sha256
  });
}));

/**
 * POST /api/uploads/complete
 * Mark upload as complete (for Supabase uploads)
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

  // Check if stored in database or Supabase
  if (document.file_data) {
    // Serve from database - return data URL
    const dataUrl = `data:${document.mime_type};base64,${document.file_data}`;
    
    res.json({
      document_id: document.id,
      original_filename: document.original_filename,
      mime_type: document.mime_type,
      size_bytes: document.size_bytes,
      download_url: dataUrl,
      storage_type: 'database'
    });
  } else if (useSupabase) {
    // Serve from Supabase
    const signedUrl = await supabase.createSignedDownloadUrl(document.object_path);

    res.json({
      document_id: document.id,
      original_filename: document.original_filename,
      mime_type: document.mime_type,
      download_url: signedUrl,
      expires_in: 3600,
      storage_type: 'supabase'
    });
  } else {
    throw new BadRequestError('Document file not found');
  }
}));

/**
 * GET /api/uploads/file/:id
 * Serve actual file binary (for database storage)
 */
router.get('/file/:id', validateId, asyncHandler(async (req, res) => {
  const document = await db.promisify.get('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  if (!document) {throw new NotFoundError('Document');}

  if (document.upload_status !== 'completed') {
    throw new BadRequestError('Document upload is not complete');
  }

  if (!document.file_data) {
    throw new BadRequestError('Document file not stored in database');
  }

  // Convert base64 back to buffer
  const fileBuffer = Buffer.from(document.file_data, 'base64');
  
  // Set headers for file download
  res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${document.original_filename}"`);
  res.setHeader('Content-Length', fileBuffer.length);
  
  res.send(fileBuffer);
}));

// ============================================
// DELETE
// ============================================

router.delete('/:id', validateId, asyncHandler(async (req, res) => {
  const document = await db.promisify.get('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  if (!document) {throw new NotFoundError('Document');}

  // Delete from Supabase storage if applicable
  if (document.upload_status === 'completed' && !document.file_data && useSupabase) {
    try {
      await supabase.deleteObject(document.object_path);
    } catch (err) {
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
  // Always configured - either Supabase or PostgreSQL storage
  const configured = true;
  const storageType = useSupabase ? 'supabase' : 'database';
  const bucket = useSupabase ? supabase.getBucket() : 'local';

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
    storage_type: storageType,
    bucket: bucket,
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
