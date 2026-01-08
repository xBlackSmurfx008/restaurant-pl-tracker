const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware - CORS with proper configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes - Core Restaurant Operations
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/menu-items', require('./routes/menuItems'));
app.use('/api/sales', require('./routes/sales'));

// Routes - Accounting & Finance
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/tax', require('./routes/tax'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/accounting', require('./routes/accounting'));

// Routes - Other
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/mappings', require('./routes/mappings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Restaurant Accounting & P&L System API is running',
    version: '2.0.0',
    features: ['accounting', 'expenses', 'payroll', 'tax-prep', 'reports', 'pnl']
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

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error('Please free the port or change PORT in .env file');
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  if (db.pool) {
    await db.pool.end();
    console.log('Database connections closed');
  }
  process.exit(0);
});

