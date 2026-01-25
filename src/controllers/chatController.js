const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Socket.io instance ni olish uchun helper
const getIO = (req) => req.app.get('io');

// User uchun chat olish yoki yaratish
exports.getOrCreateChat = async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const io = getIO(req);

    if (!userId) {
      return res.status(400).json({ error: 'userId majburiy' });
    }

    // Mavjud chatni topish
    let chat = await Chat.findOne({ userId, status: { $ne: 'closed' } });
    let isNew = false;

    // Yangi chat yaratish
    if (!chat) {
      chat = await Chat.create({
        userId,
        userName: userName || 'Mijoz',
        status: 'waiting'
      });
      isNew = true;

      // Hamma adminlarga yangi chat haqida xabar (Socket.io)
      io.to('admins').emit('new-chat', {
        chat: chat.toObject()
      });
    }

    res.json({ success: true, chat, isNew });
  } catch (error) {
    console.error('getOrCreateChat xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// User chatlarini olish
exports.getUserChats = async (req, res) => {
  try {
    const { userId } = req.params;

    const chats = await Chat.find({ userId })
      .sort({ lastMessageAt: -1 });

    res.json({ success: true, chats });
  } catch (error) {
    console.error('getUserChats xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Admin uchun barcha kutilayotgan chatlar (assign qilinmagan)
// isSuperAdmin=true bo'lsa hamma chatlarni ko'rsatadi (locked larni ham)
exports.getWaitingChats = async (req, res) => {
  try {
    const { adminId, isSuperAdmin } = req.query;

    let query = {
      status: 'waiting',
      assignedAdminId: null
    };

    // Agar super admin bo'lmasa - faqat lock qilinmagan yoki o'zi lock qilgan chatlarni ko'rsin
    if (!isSuperAdmin || isSuperAdmin === 'false') {
      query.$or = [
        { isLocked: false },
        { isLocked: { $exists: false } },
        { isLocked: null },
        { lockedByAdminId: adminId }
      ];
    }

    console.log('[getWaitingChats] Query:', JSON.stringify(query));
    const chats = await Chat.find(query).sort({ lastMessageAt: -1 });
    console.log('[getWaitingChats] Found chats:', chats.length);

    res.json({ success: true, chats });
  } catch (error) {
    console.error('getWaitingChats xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Admin uchun o'z chatlari
exports.getAdminChats = async (req, res) => {
  try {
    const { adminId } = req.params;

    const chats = await Chat.find({
      assignedAdminId: adminId,
      status: { $ne: 'closed' }
    }).sort({ lastMessageAt: -1 });

    res.json({ success: true, chats });
  } catch (error) {
    console.error('getAdminChats xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Chatni adminga biriktirish
exports.assignChat = async (req, res) => {
  try {
    const { chatId, adminId, adminName } = req.body;
    const io = getIO(req);

    if (!chatId || !adminId) {
      return res.status(400).json({ error: 'chatId va adminId majburiy' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat topilmadi' });
    }

    // Chat allaqachon biriktirilganmi tekshirish
    if (chat.assignedAdminId && chat.assignedAdminId !== adminId) {
      return res.status(400).json({
        error: 'Chat boshqa adminga biriktirilgan',
        assignedTo: chat.assignedAdminName
      });
    }

    chat.assignedAdminId = adminId;
    chat.assignedAdminName = adminName || 'Admin';
    chat.status = 'active';
    await chat.save();

    // Hamma adminlarga xabar - chat olib qo'yildi (Socket.io)
    io.to('admins').emit('chat-taken', {
      chatId: chat._id,
      adminId,
      adminName: chat.assignedAdminName
    });

    // Userga xabar - admin qo'shildi (Socket.io)
    io.to(`user-${chat.userId}`).emit('admin-joined', {
      chatId: chat._id,
      adminName: chat.assignedAdminName
    });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('assignChat xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Chat xabarlarini olish
exports.getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    console.log('[getChatMessages] chatId:', chatId);

    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    console.log('[getChatMessages] Found messages count:', messages.length);

    const total = await Message.countDocuments({ chatId });

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('getChatMessages xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Yangi xabar yuborish
exports.sendMessage = async (req, res) => {
  try {
    const { chatId, senderId, senderType, senderName, content, messageType, fileUrl } = req.body;
    const io = getIO(req);

    if (!senderId || !senderType || !content) {
      return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmagan' });
    }

    let chat;

    // Agar chatId yo'q bo'lsa va user yuborayotgan bo'lsa - yangi chat yaratish
    if (!chatId && senderType === 'user') {
      chat = await Chat.findOne({ userId: senderId, status: { $ne: 'closed' } });

      if (!chat) {
        chat = await Chat.create({
          userId: senderId,
          userName: senderName || 'Mijoz',
          status: 'waiting'
        });

        // Hamma adminlarga yangi chat haqida xabar
        io.to('admins').emit('new-chat', {
          chat: chat.toObject()
        });
      }
    } else {
      chat = await Chat.findById(chatId);
    }

    if (!chat) {
      return res.status(404).json({ error: 'Chat topilmadi' });
    }

    // Xabarni saqlash
    const message = await Message.create({
      chatId: chat._id,
      senderId,
      senderType,
      senderName: senderName || (senderType === 'user' ? 'Mijoz' : 'Admin'),
      content,
      messageType: messageType || 'text',
      fileUrl
    });

    // Chat ni yangilash
    chat.lastMessage = content.substring(0, 100);
    chat.lastMessageAt = new Date();
    if (senderType === 'user') {
      chat.unreadCount += 1;
    }
    await chat.save();

    // Xabarni chatga yuborish (Socket.io)
    io.to(`chat-${chat._id}`).emit('new-message', {
      message: message.toObject()
    });

    // Notification yuborish
    if (senderType === 'user') {
      // Agar chat assigned bo'lsa - faqat shu adminga
      if (chat.assignedAdminId) {
        io.to(`admin-${chat.assignedAdminId}`).emit('message-notification', {
          chatId: chat._id,
          message: message.toObject(),
          chat: chat.toObject()
        });
      } else {
        // Hamma adminlarga (waiting chat)
        io.to('admins').emit('message-notification', {
          chatId: chat._id,
          message: message.toObject(),
          chat: chat.toObject()
        });
      }
    } else {
      // Admin xabar yozsa - userga
      io.to(`user-${chat.userId}`).emit('message-notification', {
        chatId: chat._id,
        message: message.toObject()
      });
    }

    res.json({ success: true, message, chat });
  } catch (error) {
    console.error('sendMessage xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Typing status yuborish
exports.sendTyping = async (req, res) => {
  try {
    const { chatId, userId, userName, isTyping } = req.body;
    const io = getIO(req);

    if (!chatId) {
      return res.status(400).json({ error: 'chatId majburiy' });
    }

    io.to(`chat-${chatId}`).emit('typing', {
      userId,
      userName,
      isTyping
    });

    res.json({ success: true });
  } catch (error) {
    console.error('sendTyping xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Xabarlarni o'qilgan deb belgilash
exports.markAsRead = async (req, res) => {
  try {
    const { chatId, readerId, readerType } = req.body;
    const io = getIO(req);

    // Qarama-qarshi tomonning xabarlarini o'qilgan deb belgilash
    const senderType = readerType === 'admin' ? 'user' : 'admin';

    await Message.updateMany(
      { chatId, senderType, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    // Unread count ni 0 ga tushirish (agar admin o'qigan bo'lsa)
    if (readerType === 'admin') {
      await Chat.findByIdAndUpdate(chatId, { unreadCount: 0 });
    }

    // Socket.io orqali xabar berish
    io.to(`chat-${chatId}`).emit('messages-read', {
      chatId,
      readerId,
      readerType
    });

    res.json({ success: true });
  } catch (error) {
    console.error('markAsRead xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// User online/offline status
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId, online } = req.body;
    const io = getIO(req);

    // Chatni yangilash
    const chat = await Chat.findOneAndUpdate(
      { userId, status: { $ne: 'closed' } },
      { userOnline: online },
      { new: true }
    );

    if (chat) {
      // Adminlarga xabar berish
      if (chat.assignedAdminId) {
        io.to(`admin-${chat.assignedAdminId}`).emit('user-status', {
          chatId: chat._id,
          userId,
          online
        });
      } else {
        io.to('admins').emit('user-status', {
          chatId: chat._id,
          userId,
          online
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('updateUserStatus xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Chatni yopish
exports.closeChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const io = getIO(req);

    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { status: 'closed' },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat topilmadi' });
    }

    // Socket.io orqali xabar berish
    io.to(`chat-${chatId}`).emit('chat-closed', { chatId });
    io.to(`user-${chat.userId}`).emit('chat-closed', { chatId });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('closeChat xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Chatni boshqa adminga o'tkazish
exports.transferChat = async (req, res) => {
  try {
    const { chatId, fromAdminId, toAdminId, toAdminName } = req.body;
    const io = getIO(req);

    const chat = await Chat.findByIdAndUpdate(
      chatId,
      {
        assignedAdminId: toAdminId,
        assignedAdminName: toAdminName
      },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat topilmadi' });
    }

    // Eski adminga xabar
    io.to(`admin-${fromAdminId}`).emit('chat-transferred-out', {
      chatId,
      toAdminName
    });

    // Yangi adminga xabar
    io.to(`admin-${toAdminId}`).emit('chat-transferred-in', {
      chat: chat.toObject()
    });

    // Userga xabar
    io.to(`user-${chat.userId}`).emit('admin-changed', {
      chatId,
      adminName: toAdminName
    });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('transferChat xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Chatni qulflash (toggle yoqish - boshqa adminlarga ko'rinmasin + assign qilish)
exports.lockChat = async (req, res) => {
  try {
    const { chatId, adminId, adminName } = req.body;
    const io = getIO(req);

    if (!chatId || !adminId) {
      return res.status(400).json({ error: 'chatId va adminId majburiy' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat topilmadi' });
    }

    // Allaqachon boshqa admin lock qilgan yoki assign qilganmi tekshirish
    if (chat.assignedAdminId && chat.assignedAdminId !== adminId) {
      return res.status(400).json({
        error: 'Chat boshqa adminga biriktirilgan',
        assignedTo: chat.assignedAdminName
      });
    }

    // Lock qilish + Assign qilish
    chat.isLocked = true;
    chat.lockedByAdminId = adminId;
    chat.lockedByAdminName = adminName || 'Admin';
    chat.assignedAdminId = adminId;
    chat.assignedAdminName = adminName || 'Admin';
    chat.status = 'active';
    await chat.save();

    // Hamma adminlarga xabar - chat qulflandi (ularning listidan o'chadi)
    io.to('admins').emit('chat-locked', {
      chatId: chat._id,
      lockedByAdminId: adminId,
      lockedByAdminName: chat.lockedByAdminName,
      chat: chat.toObject()
    });

    // Userga xabar - admin qo'shildi
    io.to(`user-${chat.userId}`).emit('admin-joined', {
      chatId: chat._id,
      adminName: chat.assignedAdminName
    });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('lockChat xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Chatni ochish (toggle o'chirish - hamma adminlarga ko'rinsin + unassign qilish)
exports.unlockChat = async (req, res) => {
  try {
    const { chatId, adminId, isSuperAdmin } = req.body;
    const io = getIO(req);

    if (!chatId) {
      return res.status(400).json({ error: 'chatId majburiy' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat topilmadi' });
    }

    // Faqat o'zi assign qilgan admin yoki super admin ochishi mumkin
    if (chat.assignedAdminId !== adminId && !isSuperAdmin) {
      return res.status(403).json({
        error: 'Siz bu chatni ocha olmaysiz',
        assignedTo: chat.assignedAdminName
      });
    }

    // Unlock qilish + Unassign qilish
    chat.isLocked = false;
    chat.lockedByAdminId = null;
    chat.lockedByAdminName = null;
    chat.assignedAdminId = null;
    chat.assignedAdminName = null;
    chat.status = 'waiting';
    await chat.save();

    // Hamma adminlarga xabar - chat ochildi (ularning listiga qaytadi)
    console.log('[unlockChat] Triggering chat-unlocked event for chat:', chat._id);
    io.to('admins').emit('chat-unlocked', {
      chatId: chat._id,
      chat: chat.toObject()
    });
    console.log('[unlockChat] Event triggered successfully');

    res.json({ success: true, chat });
  } catch (error) {
    console.error('unlockChat xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Super admin uchun - barcha chatlar (locked ham)
exports.getAllChats = async (req, res) => {
  try {
    const { status } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const chats = await Chat.find(query).sort({ lastMessageAt: -1 });

    res.json({ success: true, chats });
  } catch (error) {
    console.error('getAllChats xatosi:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
};
