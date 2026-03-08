require('dotenv').config();

const express = require('express');
const cors = require('cors');

const searchRoutes = require('./routes/search');
const itemsRoutes = require('./routes/items');
const virtualModelRoutes = require('./routes/virtualModel');
const ebayNotificationsRoutes = require('./routes/ebayNotifications');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'thrift-scout-backend',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    ebay: !!process.env.EBAY_APP_ID,
    airtable: !!process.env.AIRTABLE_API_KEY,
    fal: !!process.env.FAL_API_KEY,
  });
});

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/search', searchRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/virtual-model', virtualModelRoutes);
app.use('/api/ebay/notifications', ebayNotificationsRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message || err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Thrift Scout backend running on port ${PORT}`);
});

module.exports = app;
