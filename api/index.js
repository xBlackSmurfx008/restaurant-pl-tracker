/**
 * Vercel serverless entry point
 * Uses the same app factory as the local server
 */
const createApp = require('../server/app');

// Create and export the Express app for Vercel
module.exports = createApp();
