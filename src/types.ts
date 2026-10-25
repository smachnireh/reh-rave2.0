export type VideoPlatform = 'youtube' | 'vk';

export interface UserStats {
  youtubeTimeSeconds: number; // Общее время в YouTube комнатах (в секундах)
  vkTimeSeconds: number;      // Общее время в VK комнатах (в секундах)
  sessionsCount: number;      // Количество созданных/посещенных комнат
  messagesCount: number;      // Отправлено сообщений
  reactionsCount: number;     // Запущено реакций
  lastActive: number;         // Timestamp
}

export interface HistoryItem {
  id: string;
  title: string;
  platform: VideoPlatform;
  videoId: string;
  roomCode: string;
  timestamp: number;
}

export interface UserAccount {
  id: string;
  email: string;
  nickname: string;
  avatar: string;             // base64 or empty
  provider: 'gmail' | 'email' | 'guest';
  passwordHash?: string;
  createdAt: number;
  stats: UserStats;
  history: HistoryItem[];
}

export interface ChatMessage {
  id: string;
  sender: string;
  avatar: string;
  text: string;
  timestamp: number;
  isHost?: boolean;
  isSelf?: boolean;
}

export interface SyncPacket {
  type: 'INITIAL_STATE' | 'CHAT_MESSAGE' | 'EMOJI_REACTION' | 'PROFILE_UPDATE' | 'VIDEO_LOAD' | 'VIDEO_SYNC';
  payload: any;
}
