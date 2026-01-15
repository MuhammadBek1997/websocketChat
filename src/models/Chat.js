const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  // Mijoz ID (asosiy backenddan keladi)
  userId: {
    type: String,
    required: true,
    index: true
  },
  // Mijoz haqida ma'lumot (ixtiyoriy)
  userName: {
    type: String,
    default: 'Mijoz'
  },
  // Chatni olgan admin ID (null bo'lsa hamma admin ko'radi)
  assignedAdminId: {
    type: String,
    default: null,
    index: true
  },
  // Admin ismi
  assignedAdminName: {
    type: String,
    default: null
  },
  // Chat holati: 'waiting' - kutilmoqda, 'active' - faol, 'closed' - yopilgan
  status: {
    type: String,
    enum: ['waiting', 'active', 'closed'],
    default: 'waiting',
    index: true
  },
  // Oxirgi xabar vaqti
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  // Oxirgi xabar matni (preview uchun)
  lastMessage: {
    type: String,
    default: ''
  },
  // O'qilmagan xabarlar soni (admin uchun)
  unreadCount: {
    type: Number,
    default: 0
  },
  // Mijoz online mi
  userOnline: {
    type: Boolean,
    default: false
  },
  // Chat qulflangan (toggle yoqilgan - faqat shu admin ko'radi)
  isLocked: {
    type: Boolean,
    default: false
  },
  // Qulfni qo'ygan admin ID
  lockedByAdminId: {
    type: String,
    default: null
  },
  // Qulfni qo'ygan admin ismi
  lockedByAdminName: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indekslar
chatSchema.index({ status: 1, assignedAdminId: 1 });
chatSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
