import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, UserAccount } from '../types';
import { getColorsForString } from '../utils/storage';

interface ChatWindowProps {
  messages: ChatMessage[];
  onlineCount: number;
  currentUser: UserAccount;
  onSendMessage: (text: string) => void;
  onSendEmoji: (emoji: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  onlineCount,
  onSendMessage,
  onSendEmoji,
}) => {
  const [inputText, setInputText] = useState('');
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 160;
    if (isNearBottom || messages.length <= 1) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;
    onSendMessage(clean);
    setInputText('');
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  return (
    <div className="sidebar-area">
      {/* 1. Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>Чат комнаты</span>
        </div>
        <div className="users-count">
          {onlineCount} онлайн
        </div>
      </div>

      {/* 2. Messages List (Fully independent scroll) */}
      <div ref={chatMessagesRef} className="chat-messages">
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#777777', fontSize: '0.8rem', fontStyle: 'italic' }}>
            Здесь пока тихо. Напишите первое сообщение или отправьте реакцию!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-wrapper ${msg.isSelf ? 'self' : 'other'}`}
            >
              {/* Avatar container */}
              <div className="message-avatar-container">
                {msg.isHost && (
                  <svg className="avatar-crown" viewBox="0 0 24 24">
                    <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z" />
                  </svg>
                )}
                <div
                  className="message-avatar"
                  style={{
                    background: msg.avatar
                      ? `url('${msg.avatar}') center/cover`
                      : getColorsForString(msg.sender),
                  }}
                >
                  {!msg.avatar && msg.sender.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Message content box */}
              <div className="message-content-box">
                <div className="message-sender">
                  {msg.isSelf ? 'Вы' : msg.sender} •{' '}
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <div className="message-bubble">
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* 3. Emoji selection bar */}
      <div className="emoji-bar-container">
        {['👍', '😂', '❤️', '😮', '😢', '🔥', '🎉'].map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSendEmoji(emoji)}
            className="emoji-btn"
            title={`Реакция ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* 4. Chat Form */}
      <form onSubmit={handleSubmit} className="chat-form">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Напишите сообщение..."
          autoComplete="off"
          className="chat-input"
        />
        <button type="submit" className="btn-chat-send">
          Отправить
        </button>
      </form>
    </div>
  );
};
