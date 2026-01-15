require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

// CORS konfiguratsiyasi
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  process.env.FRONTEND_ORIGIN,
  process.env.ADMIN_FRONTEND_ORIGIN
].filter(Boolean);

const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultAllowedOrigins;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
