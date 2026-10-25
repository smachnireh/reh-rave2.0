import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, UserAccount } from '../types';
import { getColorsForString } from '../utils/storage';
import { Send } from 'lucide-react';

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

  // Auto-scroll to bottom only if user was already near bottom
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 140;
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
    <div className="flex flex-col bg-[#0a0a0a]/70 backdrop-blur-[24px] border border-white/[0.08] rounded-[12px] overflow-hidden h-full max-h-full relative shadow-[0_12px_32px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.02)] min-h-[440px] lg:min-h-0">
      {/* 1. Sidebar Header */}
      <div className="px-4 py-3.5 border-b border-white/[0.05] flex justify-between items-center bg-[#111111]/40 shrink-0">
        <div className="text-[0.75rem] font-semibold text-[#888888] uppercase tracking-[0.05em] flex items-center gap-2">
          <span>Чат комнаты</span>
        </div>
        <div className="bg-white/[0.08] text-[#e0e0e0] text-[0.75rem] font-bold px-[0.45rem] py-[0.15rem] rounded-[4px] border border-white/[0.05]">
          {onlineCount} онлайн
        </div>
      </div>

      {/* 2. Messages List (Fully independent scroll) */}
      <div
        ref={chatMessagesRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-[1.1rem] relative overflow-x-hidden focus:outline-none overscroll-contain"
      >
        {messages.length === 0 ? (
          <div className="my-auto text-center text-[#777777] text-xs italic">
            Здесь пока нет сообщений. Напишите что-нибудь!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-3 max-w-[90%] animate-in fade-in duration-200 ${
                msg.isSelf ? 'self-end flex-row-reverse' : 'self-start flex-row'
              }`}
            >
              {/* Rounded avatar container */}
              <div className="relative flex items-center justify-center shrink-0">
                {msg.isHost && (
                  <svg
                    className="absolute -top-[10px] left-1/2 w-[14px] h-[14px] fill-[#ffb703] drop-shadow-[0_0_4px_rgba(255,183,3,0.6)] -translate-x-1/2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z" />
                  </svg>
                )}
                <div
                  className="w-9 h-9 rounded-full border-[1.5px] border-white/12 flex items-center justify-center text-[0.75rem] font-bold text-white uppercase overflow-hidden select-none bg-cover bg-center"
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
              <div className={`flex flex-col gap-[0.15rem] ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                <div
                  className={`text-[0.725rem] text-[#888888] font-bold uppercase tracking-[0.05em] select-none ${
                    msg.isSelf ? 'mr-[0.15rem]' : 'ml-[0.15rem]'
                  }`}
                >
                  {msg.isSelf ? 'Вы' : msg.sender} •{' '}
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <div
                  className={`text-[0.875rem] leading-[1.4] px-[0.85rem] py-[0.55rem] rounded-[14px] break-words shadow-[0_4px_12px_rgba(0,0,0,0.12)] ${
                    msg.isSelf
                      ? 'bg-white/14 text-white border border-white/6 rounded-br-[3px]'
                      : 'bg-white/6 text-white border border-white/3 rounded-bl-[3px]'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* 3. Emoji selection bar */}
      <div className="flex justify-around p-[0.45rem] bg-[#111111]/35 border-t border-b border-white/[0.04] gap-1 select-none shrink-0">
        {['👍', '😂', '❤️', '😮', '😢', '🔥', '🎉'].map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSendEmoji(emoji)}
            className="bg-transparent border-0 text-[1.15rem] cursor-pointer outline-none px-[0.35rem] py-[0.15rem] hover:scale-125 active:scale-90 transition-transform"
            title={`Реакция ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* 4. Chat form */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-[0.85rem] border-t border-white/[0.05] bg-[#111111]/40 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Напишите сообщение..."
          autoComplete="off"
          className="flex-1 bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-[4px] px-3 py-[0.45rem] text-white text-[0.875rem] outline-none transition-colors"
        />
        <button
          type="submit"
          className="bg-white/10 hover:bg-white/18 text-white border border-white/[0.05] rounded-[4px] px-[0.85rem] py-[0.45rem] text-[0.85rem] font-semibold cursor-pointer transition-colors shrink-0 flex items-center justify-center"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
