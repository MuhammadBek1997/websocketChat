const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Chat ID
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  // Yuboruvchi ID (userId yoki adminId)
  senderId: {
    type: String,
    required: true
  },
  // Yuboruvchi turi
  senderType: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  // Yuboruvchi ismi
  senderName: {
    type: String,
    default: ''
  },
  // Xabar matni
  content: {
    type: String,
    required: true
  },
  // Xabar turi
  messageType: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  },
  // Fayl URL (agar fayl bo'lsa)
  fileUrl: {
    type: String,
    default: null
  },
  // O'qilganmi
  isRead: {
    type: Boolean,
    default: false
  },
  // O'qilgan vaqt
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indekslar
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });

module.exports = mongoose.model('Message', messageSchema);
