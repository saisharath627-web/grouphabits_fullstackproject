require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const goalRoutes = require('./routes/goals');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Allow all origins by default so Render works immediately without needing CLIENT_URL
const rawClientUrl = (process.env.CLIENT_URL || '*').trim();
const allowedOrigin = rawClientUrl === '*' ? '*' : rawClientUrl.replace(/\/+$/, '');

app.use(
  cors({
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  })
);

app.use(express.json({ limit: '10kb' }));

// Root & health check routes so visiting the Render URL directly confirms it is live
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'StrideTogether API is running.'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Group Goals & Activity Routes
app.use('/api/goals', goalRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.'
  });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('FATAL ERROR: MONGO_URI environment variable is missing.');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully.');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });