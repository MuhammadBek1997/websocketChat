/**
 * User Chat Component - React Example (Pusher)
 *
 * Mijoz tomondan chat komponenti
 */

import React, { useState, useEffect, useRef } from 'react';
import { useChatPusher } from '../useChatPusher';

const UserChat = ({
  userId,
  userName,
  serverUrl = 'http://localhost:5000',
  pusherKey,
  pusherCluster = 'eu'
}) => {
  const [messageInput, setMessageInput] = useState('');
  const [isTypingTimeout, setIsTypingTimeout] = useState(null);
  const messagesEndRef = useRef(null);

  const {
    isConnected,
    messages,
    chatInfo,
    currentTyping,
    startChat,
    sendMessage,
    setTyping,
    markAsRead
  } = useChatPusher({
    serverUrl,
    pusherKey,
    pusherCluster,
    userId,
    userName,
    userType: 'user'
  });

  // Chat boshlash
  useEffect(() => {
    if (isConnected) {
      startChat();
    }
  }, [isConnected, startChat]);

  // Scrollni pastga tushirish
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Xabarlarni o'qilgan deb belgilash
  useEffect(() => {
    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages, markAsRead]);

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

    // Typing boshlanganini yuborish
    setTyping(true);

    // Timeout tozalash va yangisini qo'yish
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

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <h3 style={styles.headerTitle}>Yordam xizmati</h3>
          <span style={{
            ...styles.statusDot,
            backgroundColor: isConnected ? '#4CAF50' : '#f44336'
          }} />
          <span style={styles.statusText}>
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
        {chatInfo?.assignedAdminName && (
          <span style={styles.adminName}>
            Operator: {chatInfo.assignedAdminName}
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {chatInfo?.status === 'waiting' && (
          <div style={styles.waitingMessage}>
            Operator javob berishini kutayapmiz...
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message._id || index}
            style={{
              ...styles.messageWrapper,
              justifyContent: message.senderType === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              style={{
                ...styles.message,
                ...(message.senderType === 'user' ? styles.userMessage : styles.adminMessage)
              }}
            >
              <p style={styles.messageContent}>{message.content}</p>
              <span style={styles.messageTime}>
                {formatTime(message.createdAt)}
                {message.senderType === 'user' && (
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
          disabled={!isConnected}
        />
        <button
          type="submit"
          style={styles.sendButton}
          disabled={!isConnected || !messageInput.trim()}
        >
          Yuborish
        </button>
      </form>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '500px',
    maxWidth: '400px',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    overflow: 'hidden',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    padding: '15px',
    backgroundColor: '#2196F3',
    color: 'white'
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  headerTitle: {
    margin: 0,
    fontSize: '18px'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  statusText: {
    fontSize: '12px'
  },
  adminName: {
    fontSize: '12px',
    opacity: 0.9
  },
  messagesContainer: {
    flex: 1,
    padding: '15px',
    overflowY: 'auto',
    backgroundColor: '#f5f5f5'
  },
  waitingMessage: {
    textAlign: 'center',
    padding: '10px',
    backgroundColor: '#fff3cd',
    borderRadius: '8px',
    marginBottom: '10px',
    fontSize: '14px',
    color: '#856404'
  },
  messageWrapper: {
    display: 'flex',
    marginBottom: '10px'
  },
  message: {
    maxWidth: '80%',
    padding: '10px 15px',
    borderRadius: '18px'
  },
  userMessage: {
    backgroundColor: '#2196F3',
    color: 'white',
    borderBottomRightRadius: '4px'
  },
  adminMessage: {
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
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px'
  }
};

export default UserChat;
