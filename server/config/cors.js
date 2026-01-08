/**
 * CORS configuration
 */
const { isDev } = require('./index');

// Allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// Add Vercel URLs in production
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.NEXT_PUBLIC_VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.NEXT_PUBLIC_VERCEL_URL}`);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (isDev) {
      return callback(null, true);
    }
    
    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In production, be more permissive for now (can tighten later with auth)
    // This allows the deployed frontend to work
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

module.exports = {
  corsOptions,
  allowedOrigins,
};

