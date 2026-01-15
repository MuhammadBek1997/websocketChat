/**
 * Admin Chat Component - React Example (Pusher)
 *
 * Admin panel uchun chat komponenti
 * - Kutilayotgan chatlar ro'yxati
 * - Biriktirilgan chatlar
 * - Chat oynasi
 */

import React, { useState, useEffect, useRef } from 'react';
import { useChatPusher } from '../useChatPusher';

const AdminChat = ({
  adminId,
  adminName,
  serverUrl = 'http://localhost:5000',
  pusherKey,
  pusherCluster = 'eu'
}) => {
  const [messageInput, setMessageInput] = useState('');
  const [activeTab, setActiveTab] = useState('waiting'); // 'waiting' | 'assigned'
  const [isTypingTimeout, setIsTypingTimeout] = useState(null);
  const messagesEndRef = useRef(null);

  const {
    isConnected,
    currentChatId,
    messages,
    chatInfo,
    currentTyping,
    waitingChats,
    assignedChats,
    joinChat,
    takeChat,
    sendMessage,
    setTyping,
    markAsRead,
    closeChat
  } = useChatPusher({
    serverUrl,
    pusherKey,
    pusherCluster,
    userId: adminId,
    userName: adminName,
    userType: 'admin'
  });

  // Scrollni pastga tushirish
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Xabarlarni o'qilgan deb belgilash
  useEffect(() => {
    if (messages.length > 0 && currentChatId) {
      markAsRead();
    }
  }, [messages, currentChatId, markAsRead]);

  // Chatni olish
  const handleTakeChat = async (chat) => {
    await takeChat(chat._id);
    setActiveTab('assigned');
  };

  // Assigned chatni ochish
  const handleOpenChat = (chat) => {
    joinChat(chat._id);
  };

  // Xabar yuborish
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    await sendMessage(messageInput);
    setMessageInput('');
    setTyping(false);
  };

  // Typing indicator
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    setTyping(true);

    if (isTypingTimeout) {
      clearTimeout(isTypingTimeout);
    }

    const timeout = setTimeout(() => {
      setTyping(false);
    }, 2000);

    setIsTypingTimeout(timeout);
  };

  // Vaqtni formatlash
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Sanani formatlash
  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();

    if (d.toDateString() === today.toDateString()) {
      return formatTime(date);
    }
    return d.toLocaleDateString('uz-UZ', {
      day: '2-digit',
      month: '2-digit'
    }) + ' ' + formatTime(date);
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        {/* Header */}
        <div style={styles.sidebarHeader}>
          <h3 style={styles.sidebarTitle}>Chat Panel</h3>
          <span style={{
            ...styles.statusDot,
            backgroundColor: isConnected ? '#4CAF50' : '#f44336'
          }} />
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'waiting' ? styles.activeTab : {})
            }}
            onClick={() => setActiveTab('waiting')}
          >
            Kutilayotgan ({waitingChats.length})
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'assigned' ? styles.activeTab : {})
            }}
            onClick={() => setActiveTab('assigned')}
          >
            Mening ({assignedChats.length})
          </button>
        </div>

        {/* Chat list */}
        <div style={styles.chatList}>
          {activeTab === 'waiting' && waitingChats.map((chat) => (
            <div
              key={chat._id}
              style={styles.chatItem}
              onClick={() => handleTakeChat(chat)}
            >
              <div style={styles.chatItemHeader}>
                <span style={styles.chatUserName}>{chat.userName}</span>
                <span style={{
                  ...styles.onlineStatus,
                  backgroundColor: chat.userOnline ? '#4CAF50' : '#9e9e9e'
                }} />
              </div>
              <p style={styles.chatPreview}>{chat.lastMessage || 'Yangi chat'}</p>
              <div style={styles.chatMeta}>
                <span>{formatDate(chat.lastMessageAt)}</span>
                {chat.unreadCount > 0 && (
                  <span style={styles.unreadBadge}>{chat.unreadCount}</span>
                )}
              </div>
            </div>
          ))}

          {activeTab === 'assigned' && assignedChats.map((chat) => (
            <div
              key={chat._id}
              style={{
                ...styles.chatItem,
                ...(currentChatId === chat._id ? styles.activeChatItem : {})
              }}
              onClick={() => handleOpenChat(chat)}
            >
              <div style={styles.chatItemHeader}>
                <span style={styles.chatUserName}>{chat.userName}</span>
                <span style={{
                  ...styles.onlineStatus,
                  backgroundColor: chat.userOnline ? '#4CAF50' : '#9e9e9e'
                }} />
              </div>
              <p style={styles.chatPreview}>{chat.lastMessage || 'Xabar yo\'q'}</p>
              <div style={styles.chatMeta}>
                <span>{formatDate(chat.lastMessageAt)}</span>
                {chat.unreadCount > 0 && (
                  <span style={styles.unreadBadge}>{chat.unreadCount}</span>
                )}
              </div>
            </div>
          ))}

          {activeTab === 'waiting' && waitingChats.length === 0 && (
            <p style={styles.emptyText}>Kutilayotgan chat yo'q</p>
          )}

          {activeTab === 'assigned' && assignedChats.length === 0 && (
            <p style={styles.emptyText}>Sizga biriktirilgan chat yo'q</p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={styles.chatArea}>
        {currentChatId ? (
          <>
            {/* Chat header */}
            <div style={styles.chatHeader}>
              <div>
                <h4 style={styles.chatTitle}>{chatInfo?.userName || 'Mijoz'}</h4>
                <span style={styles.chatStatus}>
                  {chatInfo?.userOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <button
                style={styles.closeButton}
                onClick={() => closeChat(currentChatId)}
              >
                Chatni yopish
              </button>
            </div>

            {/* Messages */}
            <div style={styles.messagesContainer}>
              {messages.map((message, index) => (
                <div
                  key={message._id || index}
                  style={{
                    ...styles.messageWrapper,
                    justifyContent: message.senderType === 'admin' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      ...styles.message,
                      ...(message.senderType === 'admin' ? styles.adminMessage : styles.userMessage)
                    }}
                  >
                    <p style={styles.messageContent}>{message.content}</p>
                    <span style={styles.messageTime}>
                      {formatTime(message.createdAt)}
                      {message.senderType === 'admin' && (
                        <span style={styles.readStatus}>
                          {message.isRead ? ' ✓✓' : ' ✓'}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {currentTyping && (
                <div style={styles.typingIndicator}>
                  {currentTyping.userName} yozmoqda...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} style={styles.inputContainer}>
              <input
                type="text"
                value={messageInput}
                onChange={handleInputChange}
                placeholder="Xabar yozing..."
                style={styles.input}
              />
              <button
                type="submit"
                style={styles.sendButton}
                disabled={!messageInput.trim()}
              >
                Yuborish
              </button>
            </form>
          </>
        ) : (
          <div style={styles.noChat}>
            <p>Chatni tanlang</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    height: '600px',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    overflow: 'hidden',
    fontFamily: 'Arial, sans-serif'
  },
  sidebar: {
    width: '300px',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column'
  },
  sidebarHeader: {
    padding: '15px',
    backgroundColor: '#1976D2',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '18px'
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e0e0e0'
  },
  tab: {
    flex: 1,
    padding: '12px',
    border: 'none',
    background: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#666'
  },
  activeTab: {
    borderBottom: '2px solid #1976D2',
    color: '#1976D2',
    fontWeight: 'bold'
  },
  chatList: {
    flex: 1,
    overflowY: 'auto'
  },
  chatItem: {
    padding: '12px 15px',
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  activeChatItem: {
    backgroundColor: '#e3f2fd'
  },
  chatItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  chatUserName: {
    fontWeight: 'bold',
    fontSize: '14px'
  },
  onlineStatus: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  chatPreview: {
    margin: '0 0 4px 0',
    fontSize: '13px',
    color: '#666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  chatMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '11px',
    color: '#999'
  },
  unreadBadge: {
    backgroundColor: '#f44336',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '10px',
    fontSize: '11px'
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: '20px'
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fafafa'
  },
  chatHeader: {
    padding: '15px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chatTitle: {
    margin: 0,
    fontSize: '16px'
  },
  chatStatus: {
    fontSize: '12px',
    color: '#666'
  },
  closeButton: {
    padding: '8px 16px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  messagesContainer: {
    flex: 1,
    padding: '15px',
    overflowY: 'auto',
    backgroundColor: '#f5f5f5'
  },
  messageWrapper: {
    display: 'flex',
    marginBottom: '10px'
  },
  message: {
    maxWidth: '70%',
    padding: '10px 15px',
    borderRadius: '18px'
  },
  adminMessage: {
    backgroundColor: '#1976D2',
    color: 'white',
    borderBottomRightRadius: '4px'
  },
  userMessage: {
    backgroundColor: 'white',
    color: '#333',
    borderBottomLeftRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  messageContent: {
    margin: 0,
    fontSize: '14px',
    wordWrap: 'break-word'
  },
  messageTime: {
    fontSize: '10px',
    opacity: 0.7,
    marginTop: '4px',
    display: 'block',
    textAlign: 'right'
  },
  readStatus: {
    marginLeft: '4px'
  },
  typingIndicator: {
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
    padding: '5px 0'
  },
  inputContainer: {
    display: 'flex',
    padding: '10px',
    backgroundColor: 'white',
    borderTop: '1px solid #e0e0e0'
  },
  input: {
    flex: 1,
    padding: '10px 15px',
    border: '1px solid #e0e0e0',
    borderRadius: '20px',
    outline: 'none',
    fontSize: '14px'
  },
  sendButton: {
    marginLeft: '10px',
    padding: '10px 20px',
    backgroundColor: '#1976D2',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  noChat: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999'
  }
};

export default AdminChat;
