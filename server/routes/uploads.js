const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const supabase = require('../utils/supabase');

/**
 * Generate unique object path for uploads
 */
function generateObjectPath(originalFilename) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const ext = originalFilename.includes('.') 
    ? originalFilename.split('.').pop().toLowerCase() 
    : 'bin';
  return `receipts/${year}/${month}/${uuid}.${ext}`;
}

/**
 * POST /api/uploads/create
 * Create a document record and return a signed upload URL
 * 
 * Body: { original_filename, mime_type, vendor_id? }
 * Returns: { document_id, upload_url, object_path }
 */
router.post('/create', async (req, res) => {
  try {
    if (!supabase.isConfigured()) {
      return res.status(503).json({ 
        error: 'Document uploads not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' 
      });
    }

    const { original_filename, mime_type, vendor_id } = req.body;

    if (!original_filename || !mime_type) {
      return res.status(400).json({ error: 'original_filename and mime_type are required' });
    }

    const objectPath = generateObjectPath(original_filename);
    const bucket = supabase.getBucket();

    // Create document record with pending status
    const result = await db.promisify.run(
      `INSERT INTO documents (vendor_id, bucket, object_path, original_filename, mime_type, upload_status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [vendor_id || null, bucket, objectPath, original_filename, mime_type]
    );

    // Generate signed upload URL
    const signedData = await supabase.createSignedUploadUrl(objectPath);

    res.status(201).json({
      document_id: result.id,
      upload_url: signedData.signedUrl,
      token: signedData.token,
      path: signedData.path,
      object_path: objectPath
    });
  } catch (error) {
    console.error('Upload create error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/uploads/complete
 * Mark a document as uploaded and optionally attach to an expense
 * 
 * Body: { document_id, size_bytes?, sha256?, expense_id? }
 */
router.post('/complete', async (req, res) => {
  try {
    const { document_id, size_bytes, sha256, expense_id } = req.body;

    if (!document_id) {
      return res.status(400).json({ error: 'document_id is required' });
    }

    // Update document status
    await db.promisify.run(
      `UPDATE documents 
       SET upload_status = 'uploaded', 
           size_bytes = COALESCE($1, size_bytes),
           sha256 = COALESCE($2, sha256)
       WHERE id = $3`,
      [size_bytes || null, sha256 || null, document_id]
    );

    // Attach to expense if provided
    if (expense_id) {
      await db.promisify.run(
        `INSERT INTO expense_documents (expense_id, document_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [expense_id, document_id]
      );
    }

    const document = await db.promisify.get(
      'SELECT * FROM documents WHERE id = $1',
      [document_id]
    );

    res.json({ 
      success: true, 
      document,
      attached_to_expense: expense_id ? true : false
    });
  } catch (error) {
    console.error('Upload complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/uploads/attach
 * Attach an existing document to an expense
 * 
 * Body: { document_id, expense_id }
 */
router.post('/attach', async (req, res) => {
  try {
    const { document_id, expense_id } = req.body;

    if (!document_id || !expense_id) {
      return res.status(400).json({ error: 'document_id and expense_id are required' });
    }

    await db.promisify.run(
      `INSERT INTO expense_documents (expense_id, document_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [expense_id, document_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Attach error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/uploads/download/:id
 * Get a signed download URL for a document
 */
router.get('/download/:id', async (req, res) => {
  try {
    if (!supabase.isConfigured()) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const document = await db.promisify.get(
      'SELECT * FROM documents WHERE id = $1',
      [req.params.id]
    );

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.upload_status !== 'uploaded') {
      return res.status(400).json({ error: 'Document not yet uploaded' });
    }

    const downloadUrl = await supabase.createSignedDownloadUrl(document.object_path);

    res.json({
      download_url: downloadUrl,
      original_filename: document.original_filename,
      mime_type: document.mime_type,
      size_bytes: document.size_bytes
    });
  } catch (error) {
    console.error('Download URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/uploads/:id
 * Delete a document (from DB and storage)
 */
router.delete('/:id', async (req, res) => {
  try {
    const document = await db.promisify.get(
      'SELECT * FROM documents WHERE id = $1',
      [req.params.id]
    );

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from storage if configured and uploaded
    if (supabase.isConfigured() && document.upload_status === 'uploaded') {
      try {
        await supabase.deleteObject(document.object_path);
      } catch (storageError) {
        console.error('Storage delete warning:', storageError.message);
        // Continue with DB delete even if storage fails
      }
    }

    // Delete from database (cascades to expense_documents)
    await db.promisify.run('DELETE FROM documents WHERE id = $1', [req.params.id]);

    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/uploads/status
 * Check if uploads are configured
 */
router.get('/status', (req, res) => {
  res.json({
    configured: supabase.isConfigured(),
    bucket: supabase.getBucket()
  });
});

module.exports = router;

