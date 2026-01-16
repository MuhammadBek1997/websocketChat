require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

// CORS - hozircha barcha originlarga ruxsat beramiz
// (Fastorika va AdminFastorika faqat HTTP API dan foydalanadi, cookie yo'q)
app.use(cors());
// Har bir javobga CORS headerlarini qo'shish (preflight va xatolarda ham)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Ensure DB connection before API routes (for Vercel serverless)
app.use('/api', async (req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error('DB ulanish xatosi:', err);
    res.status(500).json({ error: 'Database ulanish xatosi' });
  }
});

// API Routes
app.use('/api', chatRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Chat API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/*'
    }
  });
});

// MongoDB ulanish va serverni ishga tushirish
const PORT = process.env.PORT || 5000;

const isVercel = !!process.env.VERCEL;
let dbPromise;
const ensureDb = () => {
  if (!dbPromise) dbPromise = connectDB();
  return dbPromise;
};

if (isVercel) {
  ensureDb();
  module.exports = app;
} else {
  ensureDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Server ishga tushdi: http://localhost:${PORT}`);
      console.log(`Pusher real-time ulangan`);
    });
  }).catch((err) => {
    console.error('Server ishga tushmadi:', err);
    process.exit(1);
  });
}

// Export for Vercel
// Global error handler - CORS headerlari saqlansin
app.use((err, req, res, next) => {
  console.error('Global xato:', err.message, err.stack);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Server xatosi' });
});
