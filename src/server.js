require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

// CORS - hozircha barcha originlarga ruxsat beramiz
// (Fastorika va AdminFastorika faqat HTTP API dan foydalanadi, cookie yo'q)
app.use(cors());
app.options('*', cors());
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
