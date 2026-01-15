/**
 * React Hook - Chat Pusher client
 *
 * Foydalanish:
 *
 * User uchun:
 * const { messages, sendMessage, setTyping, isConnected } = useChatPusher({
 *   serverUrl: 'http://localhost:5000',
 *   pusherKey: 'your_pusher_key',
 *   pusherCluster: 'eu',
 *   userId: 'user123',
 *   userName: 'Ali',
 *   userType: 'user'
 * });
 *
 * Admin uchun:
 * const {
 *   waitingChats,
 *   assignedChats,
 *   takeChat,
 *   lockChat,
 *   unlockChat,
 *   messages,
 *   sendMessage
 * } = useChatPusher({
 *   serverUrl: 'http://localhost:5000',
 *   pusherKey: 'your_pusher_key',
 *   pusherCluster: 'eu',
 *   userId: 'admin456',
 *   userName: 'Admin Nodira',
 *   userType: 'admin',
 *   isSuperAdmin: false // yoki true
 * });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Pusher from 'pusher-js';

export const useChatPusher = ({
  serverUrl,
  pusherKey,
  pusherCluster = 'eu',
  userId,
  userName,
  userType = 'user', // 'user' yoki 'admin'
  isSuperAdmin = false // Super admin barcha chatlarni ko'radi
}) => {
  const pusherRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  // Admin uchun
  const [waitingChats, setWaitingChats] = useState([]);
  const [assignedChats, setAssignedChats] = useState([]);

  // Chat info
  const [chatInfo, setChatInfo] = useState(null);
  const [adminJoined, setAdminJoined] = useState(false);

  // Subscribed channels
  const subscribedChannels = useRef(new Set());

  // API call helper
  const apiCall = useCallback(async (endpoint, method = 'GET', body = null) => {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (body) options.body = JSON.stringify(body);

      const response = await fetch(`${serverUrl}/api${endpoint}`, options);
      return await response.json();
    } catch (error) {
      console.error('API xatosi:', error);
      return { success: false, error: error.message };
    }
  }, [serverUrl]);

  // Subscribe to channel
  const subscribeToChannel = useCallback((channelName, events) => {
    if (!pusherRef.current || subscribedChannels.current.has(channelName)) return;

    const channel = pusherRef.current.subscribe(channelName);
    subscribedChannels.current.add(channelName);

    Object.entries(events).forEach(([eventName, handler]) => {
      channel.bind(eventName, handler);
    });

    return channel;
  }, []);

  // Unsubscribe from channel
  const unsubscribeFromChannel = useCallback((channelName) => {
    if (!pusherRef.current || !subscribedChannels.current.has(channelName)) return;

    pusherRef.current.unsubscribe(channelName);
    subscribedChannels.current.delete(channelName);
  }, []);

  // Pusher ulanish
  useEffect(() => {
    if (!pusherKey || !userId) return;

    // Pusher instance yaratish
    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      forceTLS: true
    });

    pusherRef.current = pusher;

    // Connection state
    pusher.connection.bind('connected', () => {
      console.log('Pusher ulandi');
      setIsConnected(true);

      // User online status yuborish
      apiCall('/status', 'POST', { userId, online: true });
    });

    pusher.connection.bind('disconnected', () => {
      console.log('Pusher uzildi');
      setIsConnected(false);
    });

    pusher.connection.bind('error', (error) => {
      console.error('Pusher xatosi:', error);
      setIsConnected(false);
    });

    // ============ ADMIN CHANNELS ============
    if (userType === 'admin') {
      // Admins channel - hamma adminlarga umumiy
      subscribeToChannel('admins', {
        'new-chat': (data) => {
          // Yangi chat qo'shish (lock qilinmagan bo'lsa yoki super admin bo'lsa)
          if (!data.chat.isLocked || isSuperAdmin) {
            setWaitingChats(prev => [data.chat, ...prev]);
          }
        },
        'chat-taken': (data) => {
          setWaitingChats(prev => prev.filter(c => c._id !== data.chatId));
        },
        'chat-locked': (data) => {
          // Agar boshqa admin lock qilgan bo'lsa - listdan o'chirish
          if (data.lockedByAdminId !== userId && !isSuperAdmin) {
            setWaitingChats(prev => prev.filter(c => c._id !== data.chatId));
          } else {
            // O'zimiz lock qilgan yoki super admin - yangilash
            setWaitingChats(prev =>
              prev.map(c => c._id === data.chatId ? {
                ...c,
                isLocked: true,
                lockedByAdminId: data.lockedByAdminId,
                lockedByAdminName: data.lockedByAdminName
              } : c)
            );
          }
        },
        'chat-unlocked': (data) => {
          // Chat ochildi - listga qaytarish
          const existingChat = waitingChats.find(c => c._id === data.chatId);
          if (!existingChat) {
            setWaitingChats(prev => [data.chat, ...prev]);
          } else {
            setWaitingChats(prev =>
              prev.map(c => c._id === data.chatId ? data.chat : c)
            );
          }
        },
        'message-notification': (data) => {
          setWaitingChats(prev =>
            prev.map(c => c._id === data.chatId ? { ...c, ...data.chat } : c)
          );
        },
        'user-status': (data) => {
          setWaitingChats(prev =>
            prev.map(c => c._id === data.chatId ? { ...c, userOnline: data.online } : c)
          );
          setAssignedChats(prev =>
            prev.map(c => c._id === data.chatId ? { ...c, userOnline: data.online } : c)
          );
        }
      });

      // Admin personal channel
      subscribeToChannel(`admin-${userId}`, {
        'message-notification': (data) => {
          setAssignedChats(prev =>
            prev.map(c => c._id === data.chatId ? { ...c, ...data.chat } : c)
          );
        },
        'user-status': (data) => {
          setAssignedChats(prev =>
            prev.map(c => c._id === data.chatId ? { ...c, userOnline: data.online } : c)
          );
        },
        'chat-transferred-in': (data) => {
          setAssignedChats(prev => [data.chat, ...prev]);
        },
        'chat-transferred-out': (data) => {
          setAssignedChats(prev => prev.filter(c => c._id !== data.chatId));
          if (currentChatId === data.chatId) {
            setCurrentChatId(null);
            setMessages([]);
          }
        }
      });

      // Dastlabki chatlarni olish
      const waitingParams = `?adminId=${userId}&isSuperAdmin=${isSuperAdmin}`;
      apiCall(`/chats/waiting${waitingParams}`).then(data => {
        if (data.success) setWaitingChats(data.chats);
      });
      apiCall(`/chats/admin/${userId}`).then(data => {
        if (data.success) setAssignedChats(data.chats);
      });
    }

    // ============ USER CHANNEL ============
    if (userType === 'user') {
      subscribeToChannel(`user-${userId}`, {
        'admin-joined': (data) => {
          setAdminJoined(true);
          setChatInfo(prev => prev ? { ...prev, assignedAdminName: data.adminName } : null);
        },
        'admin-changed': (data) => {
          setChatInfo(prev => prev ? { ...prev, assignedAdminName: data.adminName } : null);
        },
        'message-notification': (data) => {
          // Agar joriy chatda bo'lmasa notification
          if (data.chatId !== currentChatId) {
            // Notification trigger
          }
        },
        'chat-closed': (data) => {
          if (currentChatId === data.chatId) {
            setCurrentChatId(null);
            setMessages([]);
            setChatInfo(null);
          }
        }
      });
    }

    // Cleanup
    return () => {
      // User offline status yuborish
      apiCall('/status', 'POST', { userId, online: false });

      // Hamma channellardan chiqish
      subscribedChannels.current.forEach(channel => {
        pusher.unsubscribe(channel);
      });
      subscribedChannels.current.clear();

      pusher.disconnect();
    };
  }, [pusherKey, pusherCluster, userId, userType, isSuperAdmin, apiCall, subscribeToChannel]);

  // Chat channel ga subscribe qilish
  useEffect(() => {
    if (!currentChatId || !pusherRef.current) return;

    const channelName = `chat-${currentChatId}`;

    subscribeToChannel(channelName, {
      'new-message': (data) => {
        setMessages(prev => [...prev, data.message]);
      },
      'typing': (data) => {
        if (data.userId !== userId) {
          setTypingUsers(prev => ({
            ...prev,
            [currentChatId]: data.isTyping ? { userId: data.userId, userName: data.userName } : null
          }));
        }
      },
      'messages-read': (data) => {
        setMessages(prev =>
          prev.map(m => ({ ...m, isRead: true }))
        );
      },
      'chat-closed': () => {
        setCurrentChatId(null);
        setMessages([]);
        setChatInfo(null);
      }
    });

    return () => {
      unsubscribeFromChannel(channelName);
    };
  }, [currentChatId, userId, subscribeToChannel, unsubscribeFromChannel]);

  // Chatga qo'shilish
  const joinChat = useCallback(async (chatId) => {
    setCurrentChatId(chatId);

    // Chat info ni o'rnatish
    const chat = waitingChats.find(c => c._id === chatId) || assignedChats.find(c => c._id === chatId);
    if (chat) {
      setChatInfo(chat);
    }

    // Xabarlarni olish
    const data = await apiCall(`/messages/${chatId}`);
    if (data.success) {
      setMessages(data.messages);
    }
  }, [apiCall, waitingChats, assignedChats]);

  // User uchun chat ochish/yaratish
  const startChat = useCallback(async () => {
    if (userType !== 'user') return null;

    const data = await apiCall('/chats', 'POST', { userId, userName });

    if (data.success) {
      const chat = data.chat;
      setCurrentChatId(chat._id);
      setChatInfo(chat);

      // Xabarlarni olish
      const messagesData = await apiCall(`/messages/${chat._id}`);
      if (messagesData.success) {
        setMessages(messagesData.messages);
      }

      return chat;
    }
    return null;
  }, [apiCall, userId, userName, userType]);

  // Admin - chatni olish (assign qilish)
  const takeChat = useCallback(async (chatId) => {
    if (userType !== 'admin') return;

    const data = await apiCall('/chats/assign', 'POST', {
      chatId,
      adminId: userId,
      adminName: userName
    });

    if (data.success) {
      // Waiting dan assigned ga o'tkazish
      setWaitingChats(prev => prev.filter(c => c._id !== chatId));
      setAssignedChats(prev => [data.chat, ...prev.filter(c => c._id !== chatId)]);
      setChatInfo(data.chat);

      // Chatga qo'shilish
      await joinChat(chatId);
    }

    return data;
  }, [apiCall, userId, userName, userType, joinChat]);

  // Chatni qulflash (toggle yoqish)
  const lockChat = useCallback(async (chatId) => {
    if (userType !== 'admin') return;

    const targetChatId = chatId || currentChatId;
    const data = await apiCall('/chats/lock', 'POST', {
      chatId: targetChatId,
      adminId: userId,
      adminName: userName
    });

    if (data.success) {
      // Local state yangilash
      setWaitingChats(prev =>
        prev.map(c => c._id === targetChatId ? {
          ...c,
          isLocked: true,
          lockedByAdminId: userId,
          lockedByAdminName: userName
        } : c)
      );
      if (chatInfo && chatInfo._id === targetChatId) {
        setChatInfo(prev => ({ ...prev, isLocked: true, lockedByAdminId: userId, lockedByAdminName: userName }));
      }
    }

    return data;
  }, [apiCall, userId, userName, userType, currentChatId, chatInfo]);

  // Chatni ochish (toggle o'chirish)
  const unlockChat = useCallback(async (chatId) => {
    if (userType !== 'admin') return;

    const targetChatId = chatId || currentChatId;
    const data = await apiCall('/chats/unlock', 'POST', {
      chatId: targetChatId,
      adminId: userId,
      isSuperAdmin
    });

    if (data.success) {
      // Local state yangilash
      setWaitingChats(prev =>
        prev.map(c => c._id === targetChatId ? {
          ...c,
          isLocked: false,
          lockedByAdminId: null,
          lockedByAdminName: null
        } : c)
      );
      if (chatInfo && chatInfo._id === targetChatId) {
        setChatInfo(prev => ({ ...prev, isLocked: false, lockedByAdminId: null, lockedByAdminName: null }));
      }
    }

    return data;
  }, [apiCall, userId, isSuperAdmin, userType, currentChatId, chatInfo]);

  // Xabar yuborish
  const sendMessage = useCallback(async (content, messageType = 'text', fileUrl = null) => {
    if (!content.trim()) return;

    const data = await apiCall('/messages', 'POST', {
      chatId: currentChatId,
      senderId: userId,
      senderType: userType,
      senderName: userName,
      content: content.trim(),
      messageType,
      fileUrl
    });

    if (data.success && data.chat) {
      setChatInfo(data.chat);
      if (!currentChatId) {
        setCurrentChatId(data.chat._id);
      }
    }

    return data;
  }, [apiCall, currentChatId, userId, userName, userType]);

  // Typing status
  const setTyping = useCallback(async (isTyping) => {
    if (!currentChatId) return;

    await apiCall('/messages/typing', 'POST', {
      chatId: currentChatId,
      userId,
      userName,
      isTyping
    });
  }, [apiCall, currentChatId, userId, userName]);

  // Xabarlarni o'qilgan deb belgilash
  const markAsRead = useCallback(async () => {
    if (!currentChatId) return;

    await apiCall('/messages/read', 'POST', {
      chatId: currentChatId,
      readerId: userId,
      readerType: userType
    });
  }, [apiCall, currentChatId, userId, userType]);

  // Chatni yopish (admin)
  const closeChat = useCallback(async (chatId) => {
    if (userType !== 'admin') return;

    const targetChatId = chatId || currentChatId;
    const data = await apiCall(`/chats/${targetChatId}/close`, 'PATCH');

    if (data.success) {
      setAssignedChats(prev => prev.filter(c => c._id !== targetChatId));
      setWaitingChats(prev => prev.filter(c => c._id !== targetChatId));
      if (currentChatId === targetChatId) {
        setCurrentChatId(null);
        setMessages([]);
        setChatInfo(null);
      }
    }

    return data;
  }, [apiCall, currentChatId, userType]);

  // Chatni transfer qilish (admin)
  const transferChat = useCallback(async (chatId, toAdminId, toAdminName) => {
    if (userType !== 'admin') return;

    const data = await apiCall('/chats/transfer', 'POST', {
      chatId,
      fromAdminId: userId,
      toAdminId,
      toAdminName
    });

    if (data.success) {
      setAssignedChats(prev => prev.filter(c => c._id !== chatId));
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
        setChatInfo(null);
      }
    }

    return data;
  }, [apiCall, userId, userType, currentChatId]);

  // Current chat typing
  const currentTyping = typingUsers[currentChatId] || null;

  return {
    // Connection
    isConnected,

    // Chat
    currentChatId,
    chatInfo,
    messages,
    typingUsers,
    currentTyping,
    adminJoined,

    // Admin only
    waitingChats,
    assignedChats,
    isSuperAdmin,

    // Actions
    joinChat,
    startChat,
    takeChat,
    lockChat,
    unlockChat,
    sendMessage,
    setTyping,
    markAsRead,
    closeChat,
    transferChat
  };
};

export default useChatPusher;
