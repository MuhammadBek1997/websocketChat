# Fastorika Chat Server v2.0.0


## 📁 Proyekt Strukturasi

```
websocket-chat/
├── src/
│   ├── server.js           # Express + Socket.io server
│   ├── config/
│   │   └── db.js           # MongoDB connection
│   ├── controllers/
│   │   └── chatController.js  # Chat logic (Socket.io events)
│   ├── models/
│   │   ├── Chat.js         # Chat model
│   │   └── Message.js      # Message model
│   └── routes/
│       └── chatRoutes.js   # REST API routes
├── Dockerfile              # Production Docker image
├── docker-compose.yml      # Local development
├── .dockerignore           # Docker ignore rules
├── .env.example            # Environment variables template
├── package.json            # Dependencies
└── README.md               # Siz o'qiyotgan fayl
```

---

## 🚀 Quick Start (Local Development)

### 1. Dependencies o'rnatish
```bash
cd websocket-chat
npm install
```

### 2. Environment sozlash
```bash
cp .env.example .env
# .env faylni oching va MONGODB_URI ni to'ldiring
```

### 3. Server ishga tushirish
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server `http://localhost:3001` da ishga tushadi.

---

## 🐳 Docker bilan ishga tushirish

### Local Docker (development)
```bash
# Image build qilish
docker build -t fastorika-chat .

# Container ishga tushirish
docker run -p 3001:3001 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e CORS_ORIGIN="*" \
  fastorika-chat
```

### Docker Compose bilan
```bash
# .env faylni to'ldiring, keyin:
docker-compose up -d

# Loglarni ko'rish
docker-compose logs -f chat-server

# To'xtatish
docker-compose down
```

---

## 🚂 Railway ga Deploy qilish

### 1. Railway proyekt yaratish
1. [railway.app](https://railway.app) ga kiring
2. **New Project** → **Deploy from GitHub repo**
3. `websocket-chat` repo ni tanlang

### 2. Environment Variables sozlash
Railway dashboard → Variables bo'limida:

| Variable      | Value                                              |
|---------------|----------------------------------------------------|
| `NODE_ENV`    | `production`                                       |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/db`   |
| `CORS_ORIGIN` | `https://fastorika.vercel.app,https://adminfastorika.vercel.app` |

> **Note**: `PORT` ni Railway o'zi avtomatik sozlaydi

### 3. Deploy
Railway avtomatik Dockerfile ni topib build qiladi. Deploy tugagach:
- **HTTP API**: `https://your-app.up.railway.app`
- **WebSocket**: `wss://your-app.up.railway.app`

### 4. Health check
```bash
curl https://your-app.up.railway.app/health
```
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": 3600,
  "websocket": "active",
  "connections": 5
}
```

---

## 🔌 WebSocket Connection

### Frontend (User) dan ulanish
```javascript
import { io } from 'socket.io-client';

const socket = io('wss://your-app.up.railway.app', {
  transports: ['websocket', 'polling']
});

// User sifatida qo'shilish
socket.emit('join-user', {
  userId: 'user-123',
  userName: 'John'
});

// Chatga qo'shilish
socket.emit('join-chat', { chatId: 'chat-abc' });

// Xabar kelganda
socket.on('new-message', (data) => {
  console.log('Yangi xabar:', data.message);
});

// Typing indikator
socket.on('typing', (data) => {
  console.log(`${data.userName} yozmoqda...`);
});
```

### Admin panel dan ulanish
```javascript
const socket = io('wss://your-app.up.railway.app', {
  transports: ['websocket', 'polling']
});

// Admin sifatida qo'shilish
socket.emit('join-admin', {
  adminId: 'admin-456',
  adminName: 'Admin Ali',
  isSuperAdmin: true
});

// Yangi chat kelganda
socket.on('new-chat', (data) => {
  console.log('Yangi chat:', data.chat);
});

// Xabar notification
socket.on('message-notification', (data) => {
  console.log('Yangi xabar:', data.message);
});
```

---

## 📡 Socket.io Events

### Client → Server (emit)

| Event          | Data                                    | Tavsif                    |
|----------------|-----------------------------------------|---------------------------|
| `join-user`    | `{ userId, userName }`                  | User sifatida qo'shilish  |
| `join-admin`   | `{ adminId, adminName, isSuperAdmin }`  | Admin sifatida qo'shilish |
| `join-chat`    | `{ chatId }`                            | Chatga qo'shilish         |
| `leave-chat`   | `{ chatId }`                            | Chatdan chiqish           |
| `typing`       | `{ chatId, userId, userName, isTyping }` | Typing indikator         |
| `mark-read`    | `{ chatId, readerId, readerType }`      | O'qilgan deb belgilash    |

### Server → Client (on)

| Event                | Data                                   | Tavsif                      |
|----------------------|----------------------------------------|-----------------------------|
| `new-message`        | `{ message }`                          | Yangi xabar keldi           |
| `new-chat`           | `{ chat }`                             | Yangi chat yaratildi        |
| `chat-taken`         | `{ chatId, adminId, adminName }`       | Chat admin tomonidan olindi |
| `admin-joined`       | `{ chatId, adminName }`                | Admin chatga qo'shildi      |
| `typing`             | `{ chatId, userId, userName, isTyping }` | Kimdir yozmoqda          |
| `messages-read`      | `{ chatId, readerId, readerType }`     | Xabarlar o'qildi            |
| `user-status`        | `{ userId, online }`                   | User online/offline         |
| `chat-closed`        | `{ chatId }`                           | Chat yopildi                |
| `chat-locked`        | `{ chatId, chat, ... }`                | Chat qulflandi              |
| `chat-unlocked`      | `{ chatId, chat }`                     | Chat ochildi                |
| `message-notification` | `{ chatId, message, chat? }`         | Xabar notification          |

---

## 🔗 REST API Endpoints

### Chat Routes
```
POST   /api/chats              - Yangi chat yaratish
GET    /api/chats/user/:userId - User chatlarini olish
GET    /api/chats/waiting      - Kutilayotgan chatlar (admin)
GET    /api/chats/admin/:id    - Admin chatlari
GET    /api/chats/all          - Barcha chatlar (super admin)
POST   /api/chats/assign       - Chatni adminga biriktirish
POST   /api/chats/transfer     - Chatni boshqa adminga o'tkazish
POST   /api/chats/lock         - Chatni qulflash
POST   /api/chats/unlock       - Chatni ochish
PATCH  /api/chats/:chatId/close - Chatni yopish
```

### Message Routes
```
GET    /api/messages/:chatId   - Chat xabarlari
POST   /api/messages           - Xabar yuborish
POST   /api/messages/read      - O'qilgan deb belgilash
POST   /api/messages/typing    - Typing status
```

### Status Routes
```
POST   /api/status             - User online/offline status
GET    /health                 - Health check
```

---

## 🧪 WebSocket Test qilish

### Postman bilan
1. Postman → New → WebSocket Request
2. URL: `wss://your-app.up.railway.app/socket.io/?EIO=4&transport=websocket`
3. Connect

### websocat bilan (CLI)
```bash
# Install
cargo install websocat

# Connect
websocat "wss://your-app.up.railway.app/socket.io/?EIO=4&transport=websocket"
```

### Browser Console da
```javascript
const socket = io('wss://your-app.up.railway.app');
socket.on('connect', () => console.log('Connected:', socket.id));
socket.emit('join-user', { userId: 'test-123', userName: 'Test' });
```

---

## 🔧 Troubleshooting

### WebSocket ulanmayapti
1. CORS_ORIGIN to'g'ri sozlanganmi tekshiring
2. `wss://` (HTTPS uchun) yoki `ws://` (HTTP uchun) ishlatayapsizmi
3. Railway logs ni tekshiring: `railway logs`

### MongoDB ulanish xatosi
1. MongoDB Atlas da IP whitelist: `0.0.0.0/0` (anywhere)
2. Connection string to'g'riligini tekshiring
3. Database user username/password

### Xabarlar real-time kelmayapti
1. `join-chat` event yuborilganmi
2. Socket connected holatdami: `socket.connected`
3. Server logs: Docker container logs

---

## 📊 Monitoring

### Railway Dashboard
- **Metrics**: CPU, Memory, Network
- **Logs**: Real-time server logs
- **Deployments**: Deploy history

### Application Health
```bash
# Health endpoint
curl https://your-app.up.railway.app/health

# Active connections
# Response: { "connections": N }
```

---

## 🔐 Security Notes

- **Non-root user**: Docker container non-root user bilan ishlaydi
- **CORS**: Production da aniq originlar ko'rsating
- **MongoDB**: Atlas da IP whitelist sozlang
- **Environment**: Secrets ni faqat environment variables orqali bering

---

## 📝 Changelog

### v2.0.0 (2024)
- ✅ Pusher dan Socket.io ga migration
- ✅ Docker support qo'shildi
- ✅ Railway deployment ready
- ✅ Graceful shutdown
- ✅ Health check endpoint
- ✅ Non-root Docker user
- ✅ Multi-stage Docker build

### v1.x (Legacy)
- Pusher cloud service
- Vercel serverless deployment

---

## 🤝 Support

Savollar bo'lsa, GitHub Issues oching yoki team bilan bog'laning.
