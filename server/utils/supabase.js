const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client with service role key (server-side only)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || 'receipts';

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('✅ Supabase Storage configured');
} else {
  console.log('⚠️  Supabase not configured - document uploads disabled');
  console.log('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
}

/**
 * Generate a signed upload URL for direct client upload
 * @param {string} objectPath - path within bucket (e.g., "receipts/2026/01/uuid.pdf")
 * @param {number} expiresIn - seconds until URL expires (default 5 min)
 */
async function createSignedUploadUrl(objectPath, expiresIn = 300) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(objectPath, expiresIn);
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Generate a signed download URL
 * @param {string} objectPath - path within bucket
 * @param {number} expiresIn - seconds until URL expires (default 1 hour)
 */
async function createSignedDownloadUrl(objectPath, expiresIn = 3600) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresIn);
  
  if (error) {
    throw error;
  }
  
  return data.signedUrl;
}

/**
 * Delete an object from storage
 * @param {string} objectPath - path within bucket
 */
async function deleteObject(objectPath) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }
  
  const { error } = await supabase.storage
    .from(bucket)
    .remove([objectPath]);
  
  if (error) {
    throw error;
  }
}

/**
 * Check if Supabase is configured
 */
function isConfigured() {
  return supabase !== null;
}

/**
 * Get the bucket name
 */
function getBucket() {
  return bucket;
}

module.exports = {
  createSignedUploadUrl,
  createSignedDownloadUrl,
  deleteObject,
  isConfigured,
  getBucket
};

