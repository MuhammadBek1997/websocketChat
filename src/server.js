require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const httpServer = createServer(app);

// Socket.io server - CORS sozlamalari bilan
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN === '*'
      ? '*'
      : (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()),
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Railway/Docker uchun transport sozlamalari
  transports: ['websocket', 'polling'],
  // Ping timeout (connection alive check)
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.io instance ni global qilish (controller dan foydalanish uchun)
app.set('io', io);

// CORS - hozircha barcha originlarga ruxsat beramiz
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*'
    ? '*'
    : (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()),
  credentials: true
}));

// Har bir javobga CORS headerlarini qo'shish (preflight va xatolarda ham)
app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN === '*' ? '*' : req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
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

// MongoDB ulanish promise
let dbPromise;
const ensureDb = () => {
  if (!dbPromise) dbPromise = connectDB();
  return dbPromise;
};

// Ensure DB connection before API routes
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

// Health check - Railway va Docker uchun muhim
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    uptime: process.uptime(),
    websocket: 'active',
    connections: io.engine.clientsCount || 0
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Fastorika Chat API Server',
    version: '2.0.0',
    transport: 'Socket.io WebSocket',
    endpoints: {
      health: '/health',
      api: '/api/*',
      websocket: 'ws://[host]/socket.io/'
    }
  });
});

// ============================================
// SOCKET.IO EVENT HANDLERS
// ============================================

// Online foydalanuvchilar (userId -> socketId)
const onlineUsers = new Map();
// Online adminlar (adminId -> socketId)
const onlineAdmins = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket.io] Yangi ulanish: ${socket.id}`);

  // User autentifikatsiya - qaysi chat roomga qo'shilish
  socket.on('join-user', (data) => {
    const { userId, userName } = data;
    if (!userId) return;

    // User socketini saqlash
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    socket.userName = userName;
    socket.userType = 'user';

    // User o'z kanallariga qo'shiladi
    socket.join(`user-${userId}`);

    console.log(`[Socket.io] User qo'shildi: ${userName || userId}`);

    // Admins ga user online bo'lganini xabar berish
    io.to('admins').emit('user-status', {
      userId,
      online: true
    });
  });

  // Admin autentifikatsiya
  socket.on('join-admin', (data) => {
    const { adminId, adminName, isSuperAdmin } = data;
    if (!adminId) return;

    // Admin socketini saqlash
    onlineAdmins.set(adminId, socket.id);
    socket.adminId = adminId;
    socket.adminName = adminName;
    socket.userType = 'admin';
    socket.isSuperAdmin = isSuperAdmin || false;

    // Admin 'admins' kanaliga qo'shiladi (global admin notifications)
    socket.join('admins');
    // Admin o'z shaxsiy kanaliga ham qo'shiladi
    socket.join(`admin-${adminId}`);

    console.log(`[Socket.io] Admin qo'shildi: ${adminName || adminId}`);
  });

  // Chatga qo'shilish (user yoki admin)
  socket.on('join-chat', (data) => {
    const { chatId } = data;
    if (!chatId) return;

    socket.join(`chat-${chatId}`);
    console.log(`[Socket.io] ${socket.userName || socket.adminName || socket.id} chat-${chatId} ga qo'shildi`);
  });

  // Chatdan chiqish
  socket.on('leave-chat', (data) => {
    const { chatId } = data;
    if (!chatId) return;

    socket.leave(`chat-${chatId}`);
    console.log(`[Socket.io] ${socket.userName || socket.adminName || socket.id} chat-${chatId} dan chiqdi`);
  });

  // Typing indikator
  socket.on('typing', (data) => {
    const { chatId, userId, userName, isTyping } = data;
    if (!chatId) return;

    // Chatdagi boshqa barcha foydalanuvchilarga yuborish
    socket.to(`chat-${chatId}`).emit('typing', {
      chatId,
      userId,
      userName,
      isTyping
    });
  });

  // Xabarlar o'qildi
  socket.on('mark-read', (data) => {
    const { chatId, readerId, readerType } = data;
    if (!chatId) return;

    socket.to(`chat-${chatId}`).emit('messages-read', {
      chatId,
      readerId,
      readerType
    });
  });

  // Ulanish uzilganda
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Ulanish uzildi: ${socket.id}`);

    // User offline bo'lsa
    if (socket.userType === 'user' && socket.userId) {
      onlineUsers.delete(socket.userId);

      // Admins ga user offline bo'lganini xabar berish
      io.to('admins').emit('user-status', {
        userId: socket.userId,
        online: false
      });
    }

    // Admin offline bo'lsa
    if (socket.userType === 'admin' && socket.adminId) {
      onlineAdmins.delete(socket.adminId);
    }
  });

  // Ping-pong (connection alive check)
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// ============================================
// SERVER ISHGA TUSHIRISH
// ============================================

const PORT = process.env.PORT || 3001;

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global xato:', err.message, err.stack);
  const origin = process.env.CORS_ORIGIN === '*' ? '*' : req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Server xatosi' });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} signal qabul qilindi. Graceful shutdown...`);

  // Yangi ulanishlarni rad etish
  httpServer.close(() => {
    console.log('HTTP server yopildi');

    // Socket.io ulanishlarini yopish
    io.close(() => {
      console.log('Socket.io ulanishlari yopildi');
      process.exit(0);
    });
  });

  // 10 sekunddan keyin majburiy chiqish
  setTimeout(() => {
    console.error('Graceful shutdown timeout, majburiy chiqish...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Server ishga tushirish
ensureDb().then(() => {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`  Fastorika Chat Server v2.0.0`);
    console.log(`========================================`);
    console.log(`  HTTP:      http://0.0.0.0:${PORT}`);
    console.log(`  WebSocket: ws://0.0.0.0:${PORT}`);
    console.log(`  Health:    http://0.0.0.0:${PORT}/health`);
    console.log(`  Transport: Socket.io (WebSocket + Polling)`);
    console.log(`========================================\n`);
  });
}).catch((err) => {
  console.error('Server ishga tushmadi:', err);
  process.exit(1);
});

// Export for testing
module.exports = { app, httpServer, io };
