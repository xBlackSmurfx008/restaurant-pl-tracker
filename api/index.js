const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('../server/db');

const app = express();

// CORS - Allow all origins in production (or specify your Vercel domain)
// Update with your actual Vercel domain after deployment
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      // In production, you might want to be more restrictive
      // For now, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes - Core Restaurant Operations
app.use('/api/vendors', require('../server/routes/vendors'));
app.use('/api/ingredients', require('../server/routes/ingredients'));
app.use('/api/menu-items', require('../server/routes/menuItems'));
app.use('/api/sales', require('../server/routes/sales'));

// Routes - Accounting & Finance
app.use('/api/expenses', require('../server/routes/expenses'));
app.use('/api/reports', require('../server/routes/reports'));
app.use('/api/tax', require('../server/routes/tax'));
app.use('/api/payroll', require('../server/routes/payroll'));
app.use('/api/accounting', require('../server/routes/accounting'));

// Routes - Other
app.use('/api/uploads', require('../server/routes/uploads'));
app.use('/api/mappings', require('../server/routes/mappings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Restaurant Accounting & P&L System API is running',
    version: '2.0.0',
    features: ['accounting', 'expenses', 'payroll', 'tax-prep', 'reports', 'pnl'],
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export for Vercel serverless
module.exports = app;

