const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// User routes
router.post('/chats', asyncHandler(chatController.getOrCreateChat));
router.get('/chats/user/:userId', chatController.getUserChats);

// Admin routes
router.get('/chats/waiting', chatController.getWaitingChats);
router.get('/chats/admin/:adminId', chatController.getAdminChats);
router.get('/chats/all', chatController.getAllChats); // Super admin uchun
router.post('/chats/assign', chatController.assignChat);
router.post('/chats/transfer', chatController.transferChat);
router.post('/chats/lock', chatController.lockChat);
router.post('/chats/unlock', chatController.unlockChat);
router.patch('/chats/:chatId/close', chatController.closeChat);

// Message routes
router.get('/messages/:chatId', chatController.getChatMessages);
router.post('/messages', chatController.sendMessage);
router.post('/messages/read', chatController.markAsRead);
router.post('/messages/typing', chatController.sendTyping);

// Status routes
router.post('/status', chatController.updateUserStatus);

module.exports = router;
