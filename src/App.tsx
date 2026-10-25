/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { UserAccount, ChatMessage, VideoPlatform, SyncPacket } from './types';
import {
  getCurrentUser,
  saveCurrentUser,
  addWatchTime,
  incrementStat,
  formatDurationRu,
  getColorsForString,
} from './utils/storage';
import { parseVideoUrl, PRESET_VIDEOS } from './utils/videoHelpers';
import { VideoPlayer } from './components/VideoPlayer';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { StatsModal } from './components/StatsModal';
import { ChatWindow } from './components/ChatWindow';
import {
  PlayCircle,
  Tv,
  Copy,
  Check,
  LogOut,
  Send,
  BarChart3,
  User,
  Plus,
  LogIn,
  Crown,
  Sparkles,
  Link as LinkIcon,
  Clock,
  ShieldCheck,
  RefreshCw,
  Users
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  left: number;
}

export default function App() {
  // Current user state
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => getCurrentUser());

  // Navigation view: 'menu' | 'room'
  const [currentView, setCurrentView] = useState<'menu' | 'room'>('menu');
  const [roomPlatform, setRoomPlatform] = useState<VideoPlatform>('youtube');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [createdBoxCode, setCreatedBoxCode] = useState<string | null>(null);

  // Video State (starts empty, without automatic Rickroll or VK clip)
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const [vkOid, setVkOid] = useState<string>('');
  const [vkId, setVkId] = useState<string>('');
  const [vkHash, setVkHash] = useState<string | undefined>(undefined);
  const [videoInputUrl, setVideoInputUrl] = useState<string>('');

  // Peer & WebRTC State
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const activeConnRef = useRef<DataConnection | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [incomingSync, setIncomingSync] = useState<{
    action: 'play' | 'pause' | 'seek';
    time: number;
    timestamp: number;
  } | null>(null);

  // Chat & Reactions
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false);

  // Notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Session Time Counter
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const watchTimerRef = useRef<number | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const copyRoomCode = (code: string) => {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopiedCode(true);
        showToast(`Код ${code} скопирован в буфер!`, 'success');
        setTimeout(() => setCopiedCode(false), 2000);
      },
      () => {
        showToast('Не удалось скопировать', 'error');
      }
    );
  };

  // Ambient Glow Palettes
  const ambientPalettes = [
    { orb1: '#ef4444', orb2: '#3b82f6' }, // YouTube Red & Cool Blue
    { orb1: '#3b82f6', orb2: '#06b6d4' }, // VK Blue & Cyan
    { orb1: '#8b5cf6', orb2: '#ec4899' }, // Neon Purple & Pink
    { orb1: '#10b981', orb2: '#f59e0b' }, // Emerald & Amber
  ];
  const [ambientIdx, setAmbientIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAmbientIdx((prev) => (prev + 1) % ambientPalettes.length);
    }, 14000);
    return () => clearInterval(interval);
  }, []);

  // Track room watch time every second
  useEffect(() => {
    if (currentView === 'room') {
      watchTimerRef.current = window.setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
        addWatchTime(currentUser.id, roomPlatform, 1);
        setCurrentUser((prev) => {
          const updated = { ...prev };
          if (roomPlatform === 'youtube') {
            updated.stats.youtubeTimeSeconds = (updated.stats.youtubeTimeSeconds || 0) + 1;
          } else {
            updated.stats.vkTimeSeconds = (updated.stats.vkTimeSeconds || 0) + 1;
          }
          return updated;
        });
      }, 1000);
    } else {
      if (watchTimerRef.current) {
        clearInterval(watchTimerRef.current);
        watchTimerRef.current = null;
      }
      setSessionSeconds(0);
    }

    return () => {
      if (watchTimerRef.current) {
        clearInterval(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    };
  }, [currentView, roomPlatform, currentUser.id]);

  // Clean peer connections
  const cleanupConnections = () => {
    connectionsRef.current.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    connectionsRef.current = [];

    if (activeConnRef.current) {
      try {
        activeConnRef.current.close();
      } catch {}
      activeConnRef.current = null;
    }

    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {}
      peerRef.current = null;
    }
  };

  // Broadcast WebRTC data packets
  const broadcastPacket = (packet: SyncPacket, excludeConn?: DataConnection) => {
    if (isHost) {
      connectionsRef.current.forEach((conn) => {
        if (conn.open && conn !== excludeConn) {
          conn.send(packet);
        }
      });
    } else {
      if (activeConnRef.current && activeConnRef.current.open) {
        activeConnRef.current.send(packet);
      }
    }
  };

  // Handle incoming data
  const handleIncomingPacket = (packet: SyncPacket, sourceConn: DataConnection) => {
    if (!packet || !packet.type) return;

    switch (packet.type) {
      case 'INITIAL_STATE':
        if (!isHost) {
          setRoomPlatform(packet.payload.platform || 'youtube');
          setCurrentVideoId(packet.payload.videoId);
          if (packet.payload.vkOid) setVkOid(packet.payload.vkOid);
          if (packet.payload.vkId) setVkId(packet.payload.vkId);
          if (packet.payload.vkHash) setVkHash(packet.payload.vkHash);

          if (packet.payload.time) {
            setIncomingSync({
              action: packet.payload.isPlaying ? 'play' : 'pause',
              time: packet.payload.time,
              timestamp: Date.now(),
            });
          }
          showToast('Синхронизировано с организатором', 'success');
        }
        break;

      case 'CHAT_MESSAGE':
        setChatMessages((prev) => [
          ...prev,
          {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            sender: packet.payload.sender,
            avatar: packet.payload.avatar,
            text: packet.payload.text,
            timestamp: packet.payload.timestamp,
            isHost: packet.payload.isHost,
            isSelf: false,
          },
        ]);
        if (isHost) broadcastPacket(packet, sourceConn);
        break;

      case 'EMOJI_REACTION':
        spawnFloatingEmoji(packet.payload.emoji);
        if (isHost) broadcastPacket(packet, sourceConn);
        break;

      case 'VIDEO_LOAD':
        setRoomPlatform(packet.payload.platform || 'youtube');
        setCurrentVideoId(packet.payload.videoId);
        if (packet.payload.vkOid) setVkOid(packet.payload.vkOid);
        if (packet.payload.vkId) setVkId(packet.payload.vkId);
        if (packet.payload.vkHash) setVkHash(packet.payload.vkHash);

        showToast(
          `${packet.payload.sender || 'Участник'} загрузил видео (${packet.payload.platform === 'vk' ? 'VK Видео' : 'YouTube'})`,
          'info'
        );
        if (isHost) broadcastPacket(packet, sourceConn);
        break;

      case 'VIDEO_SYNC':
        setIncomingSync({
          action: packet.payload.action,
          time: packet.payload.time,
          timestamp: Date.now(),
        });
        if (isHost) broadcastPacket(packet, sourceConn);
        break;

      case 'PROFILE_UPDATE':
        // Update username metadata
        // @ts-ignore
        sourceConn.username = packet.payload.newNick;
        // @ts-ignore
        sourceConn.avatar = packet.payload.avatar;
        if (isHost) broadcastPacket(packet, sourceConn);
        break;
    }
  };

  // Spawn floating reaction emoji
  const spawnFloatingEmoji = (emoji: string) => {
    const id = 'emoji_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const left = Math.floor(Math.random() * 65) + 15; // 15% - 80%
    setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 2400);
  };

  const handleSendEmoji = (emoji: string) => {
    spawnFloatingEmoji(emoji);
    incrementStat(currentUser.id, 'reactionsCount', 1);
    setCurrentUser((prev) => ({
      ...prev,
      stats: { ...prev.stats, reactionsCount: (prev.stats.reactionsCount || 0) + 1 },
    }));

    broadcastPacket({
      type: 'EMOJI_REACTION',
      payload: { emoji, sender: currentUser.nickname },
    });
  };

  // Generate 6-char room code
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // 1. Action: Create Room
  const handleCreateRoom = (platform: VideoPlatform) => {
    cleanupConnections();
    setRoomPlatform(platform);

    const code = generateCode();
    setRoomCode(code);
    setIsHost(true);
    setCreatedBoxCode(code);

    const peer = new Peer('ravereh-' + code);
    peerRef.current = peer;

    peer.on('open', () => {
      showToast(`Комната создана! Код: ${code}`, 'success');
      copyRoomCode(code);
      setCurrentView('room');
      setOnlineCount(1);
      incrementStat(currentUser.id, 'sessionsCount', 1);

      // Start with empty video so user can choose cleanly
      setCurrentVideoId('');
      setVkOid('');
      setVkId('');
      setVkHash(undefined);

      peer.on('connection', (conn) => {
        // @ts-ignore
        conn.username = conn.metadata?.nickname || 'Зритель';
        // @ts-ignore
        conn.avatar = conn.metadata?.avatar || '';

        connectionsRef.current.push(conn);
        setOnlineCount(connectionsRef.current.length + 1);

        conn.on('open', () => {
          showToast(`${(conn as any).username} присоединился к сессии`, 'info');

          // Send current state to newly joined guest
          conn.send({
            type: 'INITIAL_STATE',
            payload: {
              platform: roomPlatform,
              videoId: currentVideoId,
              vkOid: vkOid,
              vkId: vkId,
              vkHash: vkHash,
              isPlaying: false,
              time: 0,
            },
          });
        });

        conn.on('data', (data: any) => {
          handleIncomingPacket(data, conn);
        });

        conn.on('close', () => {
          connectionsRef.current = connectionsRef.current.filter((c) => c !== conn);
          setOnlineCount(connectionsRef.current.length + 1);
          showToast(`${(conn as any).username} вышел из комнаты`, 'info');
        });
      });
    });

    peer.on('error', (err) => {
      console.error(err);
      if (err.type === 'unavailable-id') {
        showToast('Код комнаты уже занят, повторите попытку', 'error');
      } else {
        showToast('Ошибка подключения к сети PeerJS', 'error');
      }
    });
  };

  // 2. Action: Join Room
  const handleJoinRoom = () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      showToast('Введите 6-значный код комнаты', 'error');
      return;
    }

    cleanupConnections();
    setIsHost(false);
    setRoomCode(code);

    const peer = new Peer();
    peerRef.current = peer;

    const timeout = setTimeout(() => {
      showToast('Превышено время ожидания комнаты', 'error');
    }, 10000);

    peer.on('open', () => {
      const conn = peer.connect('ravereh-' + code, {
        metadata: {
          nickname: currentUser.nickname,
          avatar: currentUser.avatar,
        },
      });
      activeConnRef.current = conn;

      conn.on('open', () => {
        clearTimeout(timeout);
        showToast(`Вы присоединились к комнате ${code}!`, 'success');
        setCurrentView('room');
        setOnlineCount(2);
        incrementStat(currentUser.id, 'sessionsCount', 1);

        conn.on('data', (data: any) => {
          handleIncomingPacket(data, conn);
        });

        conn.on('close', () => {
          showToast('Организатор закрыл комнату', 'info');
          setCurrentView('menu');
          cleanupConnections();
        });
      });
    });

    peer.on('error', (err) => {
      clearTimeout(timeout);
      console.error(err);
      if (err.type === 'peer-unavailable') {
        showToast('Комната с таким кодом не найдена', 'error');
      } else {
        showToast('Не удалось подключиться: ' + err.message, 'error');
      }
    });
  };

  // Leave room
  const handleLeaveRoom = () => {
    cleanupConnections();
    setCurrentView('menu');
    setChatMessages([]);
    showToast('Вы вышли из комнаты', 'info');
  };

  // Load new video inside room
  const handleLoadVideo = (urlInput: string) => {
    const clean = urlInput.trim();
    if (!clean) {
      showToast('Вставьте ссылку на видео', 'error');
      return;
    }

    const parsed = parseVideoUrl(clean, roomPlatform);
    if (!parsed) {
      showToast('Не удалось распознать ссылку YouTube или VK Видео', 'error');
      return;
    }

    setRoomPlatform(parsed.platform);
    setCurrentVideoId(parsed.id);
    if (parsed.oid) setVkOid(parsed.oid);
    if (parsed.vkId) setVkId(parsed.vkId);
    if (parsed.hash) setVkHash(parsed.hash);

    setVideoInputUrl('');
    showToast(
      `Загружено видео ${parsed.platform === 'vk' ? 'VK Видео' : 'YouTube'}!`,
      'success'
    );

    // Broadcast to room
    broadcastPacket({
      type: 'VIDEO_LOAD',
      payload: {
        platform: parsed.platform,
        videoId: parsed.id,
        vkOid: parsed.oid,
        vkId: parsed.vkId,
        vkHash: parsed.hash,
        sender: currentUser.nickname,
      },
    });
  };

  // Sync Video actions (play/pause/seek)
  const handleSyncAction = (action: 'play' | 'pause' | 'seek', time: number) => {
    broadcastPacket({
      type: 'VIDEO_SYNC',
      payload: { action, time, sender: currentUser.nickname },
    });
  };

  // Send Chat message
  const handleSendMessage = (text: string) => {
    const timestamp = Date.now();
    const newMsg: ChatMessage = {
      id: 'msg_' + timestamp + '_' + Math.random().toString(36).substring(2, 5),
      sender: currentUser.nickname,
      avatar: currentUser.avatar,
      text: text,
      timestamp: timestamp,
      isHost: isHost,
      isSelf: true,
    };

    setChatMessages((prev) => [...prev, newMsg]);
    incrementStat(currentUser.id, 'messagesCount', 1);

    broadcastPacket({
      type: 'CHAT_MESSAGE',
      payload: {
        sender: currentUser.nickname,
        avatar: currentUser.avatar,
        text: text,
        timestamp: timestamp,
        isHost: isHost,
      },
    });
  };

  const totalWatchTime = (currentUser.stats.youtubeTimeSeconds || 0) + (currentUser.stats.vkTimeSeconds || 0);

  return (
    <div className={`flex flex-col bg-[#0a0a0a] text-[#e0e0e0] font-sans relative selection:bg-white/20 ${currentView === 'room' ? 'h-screen lg:overflow-hidden overflow-y-auto' : 'min-h-screen'}`}>
      {/* Dynamic Ambient Background Glow Orbs */}
      <div
        className="fixed -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none opacity-20 transition-all duration-1000 z-0"
        style={{ background: ambientPalettes[ambientIdx].orb1 }}
      />
      <div
        className="fixed -bottom-32 -left-32 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none opacity-15 transition-all duration-1000 z-0"
        style={{ background: ambientPalettes[ambientIdx].orb2 }}
      />

      {/* Toast Notifications */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl border text-xs sm:text-sm font-medium shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-10 duration-200 ${
              toast.type === 'success'
                ? 'bg-neutral-900/90 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-neutral-900/90 border-red-500/40 text-red-200'
                : 'bg-neutral-900/90 border-white/20 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* TOP HEADER */}
      <header className="h-14 border-b border-white/10 bg-[#111111]/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-tight text-lg text-white">rave reh</span>
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest pl-3 border-l border-white/10 hidden sm:inline">
              YouTube & VK Видео
            </span>
          </div>

          {/* Watch Time Quick Indicators */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-white/10 text-xs">
            <button
              onClick={() => setIsStatsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/40 transition-colors cursor-pointer"
              title="Общее время в комнатах YouTube"
            >
              <PlayCircle className="w-3.5 h-3.5 text-red-400" />
              <span>YT: {formatDurationRu(currentUser.stats.youtubeTimeSeconds || 0)}</span>
            </button>
            <button
              onClick={() => setIsStatsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/40 border border-blue-500/30 text-blue-300 hover:bg-blue-900/40 transition-colors cursor-pointer"
              title="Общее время в комнатах VK Видео"
            >
              <Tv className="w-3.5 h-3.5 text-blue-400" />
              <span>VK: {formatDurationRu(currentUser.stats.vkTimeSeconds || 0)}</span>
            </button>
          </div>
        </div>

        {/* User Profile Action & Auth Button */}
        <div className="flex items-center gap-2">
          {/* Stats Button */}
          <button
            onClick={() => setIsStatsOpen(true)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Открыть подробную статистику"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          {/* User Account Dropdown / Badge */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2.5 py-1 px-2.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 transition-colors cursor-pointer group"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden shadow-sm"
              style={{
                background: currentUser.avatar
                  ? `url('${currentUser.avatar}') center/cover`
                  : getColorsForString(currentUser.nickname),
              }}
            >
              {!currentUser.avatar && currentUser.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden xs:block">
              <div className="text-xs font-semibold text-white group-hover:text-amber-200 transition-colors leading-none flex items-center gap-1">
                {currentUser.nickname}
                {currentUser.provider === 'gmail' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                )}
              </div>
              <div className="text-[10px] text-neutral-400 leading-tight">
                {currentUser.provider === 'gmail' ? 'Gmail' : currentUser.provider === 'email' ? 'Email' : 'Гость'}
              </div>
            </div>
          </button>

          {/* If guest, show quick button to Login / Register */}
          {currentUser.provider === 'guest' && (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              Войти
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 flex flex-col max-w-[1440px] w-full mx-auto p-3 sm:p-5 z-10 ${currentView === 'room' ? 'h-[calc(100vh-3.5rem)] lg:overflow-hidden' : ''}`}>
        {/* VIEW 1: MAIN MENU */}
        {currentView === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center py-6">
            <div className="w-full max-w-md bg-[#0d0d0d]/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
              {/* Header Title */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-neutral-300 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Синхронный видеоплеер без задержек
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">rave reh</h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  Совместный просмотр видео со стопроцентной синхронностью через WebRTC
                </p>
              </div>

              {/* Account Quick Status Alert */}
              <div
                onClick={() => (currentUser.provider === 'guest' ? setIsAuthOpen(true) : setIsProfileOpen(true))}
                className="mb-6 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                    style={{
                      background: currentUser.avatar
                        ? `url('${currentUser.avatar}') center/cover`
                        : getColorsForString(currentUser.nickname),
                    }}
                  >
                    {!currentUser.avatar && currentUser.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      {currentUser.nickname}
                      {currentUser.provider === 'gmail' && (
                        <span className="text-[10px] bg-red-500/20 text-red-300 px-1 py-0.2 rounded font-mono">
                          Gmail
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Общее время: {formatDurationRu(totalWatchTime)}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-white/80 hover:text-white">
                  {currentUser.provider === 'guest' ? 'Сохранить аккаунт →' : 'Профиль →'}
                </span>
              </div>

              {/* Created Room Box if was created */}
              {createdBoxCode && (
                <div className="mb-5 bg-neutral-900/90 border border-white/20 border-dashed rounded-xl p-4 text-center animate-in fade-in">
                  <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
                    Ваша комната создана
                  </div>
                  <div className="flex items-center justify-center gap-3 my-2">
                    <span className="font-mono text-2xl font-extrabold text-white tracking-widest">
                      {createdBoxCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyRoomCode(createdBoxCode)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white text-white hover:text-black font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode ? 'Скопировано' : 'Копировать'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentView('room')}
                    className="w-full mt-2 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Перейти в комнату
                  </button>
                </div>
              )}

              {/* Create Room Buttons: YouTube & VK Video */}
              <div className="space-y-2.5 mb-5">
                <button
                  type="button"
                  onClick={() => handleCreateRoom('youtube')}
                  className="w-full py-3 px-4 bg-white hover:bg-neutral-200 text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.99] cursor-pointer"
                >
                  <PlayCircle className="w-5 h-5 text-red-600" />
                  Создать YouTube комнату
                </button>

                <button
                  type="button"
                  onClick={() => handleCreateRoom('vk')}
                  className="w-full py-3 px-4 bg-[#2787f5] hover:bg-[#1f74d6] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.99] cursor-pointer"
                >
                  <Tv className="w-5 h-5 text-white" />
                  Создать VK Видео комнату
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <span className="relative bg-[#0d0d0d] px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  или подключитесь по коду
                </span>
              </div>

              {/* Join Room Form */}
              <div className="space-y-3">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="Введите 6-значный код (например: 7KF4X2)"
                  maxLength={6}
                  className="w-full bg-[#181818] border border-white/15 focus:border-white rounded-xl px-4 py-3 text-center font-mono text-base font-bold text-white tracking-widest uppercase outline-none transition-colors"
                />

                <button
                  type="button"
                  onClick={handleJoinRoom}
                  className="w-full py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-xl text-sm border border-white/10 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  Присоединиться к комнате
                </button>
              </div>

              {/* Quick Demo Presets */}
              <div className="mt-6 pt-5 border-t border-white/5">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 text-center">
                  Быстрый старт с тестовым видео
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentVideoId('jfKfPfyJRdk');
                      handleCreateRoom('youtube');
                    }}
                    className="p-2 rounded-lg bg-neutral-900/60 hover:bg-white/10 border border-white/5 text-left text-neutral-300 hover:text-white transition-colors cursor-pointer truncate"
                  >
                    🎵 Lofi Beats (YouTube)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentVideoId('-22822305_456241984');
                      setVkOid('-22822305');
                      setVkId('456241984');
                      handleCreateRoom('vk');
                    }}
                    className="p-2 rounded-lg bg-neutral-900/60 hover:bg-white/10 border border-white/5 text-left text-neutral-300 hover:text-white transition-colors cursor-pointer truncate"
                  >
                    📺 VK Видео Клип
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: ROOM VIEW */}
        {currentView === 'room' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-4 sm:gap-6 h-full min-h-0 lg:overflow-hidden">
            {/* Left: Video Player & Controls */}
            <div className="flex flex-col gap-3 min-w-0 h-full lg:overflow-hidden">
              {/* Room Topbar */}
              <div className="bg-[#111111]/90 border border-white/10 rounded-xl p-3 sm:px-4 flex items-center justify-between flex-wrap gap-2 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold">
                      Код:
                    </span>
                    <button
                      type="button"
                      onClick={() => copyRoomCode(roomCode)}
                      className="font-mono text-sm font-extrabold text-white bg-white/10 hover:bg-white hover:text-black px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Нажмите для копирования"
                    >
                      {roomCode}
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Active Platform indicator pill */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold">
                    {roomPlatform === 'youtube' ? (
                      <>
                        <PlayCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-white">YouTube</span>
                      </>
                    ) : (
                      <>
                        <Tv className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-white">VK Видео</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Session Live Watch Timer */}
                  <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-mono bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>{formatDurationRu(sessionSeconds)}</span>
                  </div>

                  {/* Leave room */}
                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="py-1 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 hover:text-red-100 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Выйти
                  </button>
                </div>
              </div>

              {/* Video Player Box with Floating Emoji Overlay */}
              <div className="relative flex-1 min-h-[260px] lg:min-h-0 overflow-hidden">
                <VideoPlayer
                  platform={roomPlatform}
                  videoId={currentVideoId}
                  vkOid={vkOid}
                  vkId={vkId}
                  vkHash={vkHash}
                  isHost={isHost}
                  onSyncAction={handleSyncAction}
                  incomingSync={incomingSync}
                  onSelectPreset={handleLoadVideo}
                />

                {/* Floating flying emoji particles container */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                  {floatingEmojis.map((e) => (
                    <div
                      key={e.id}
                      className="absolute bottom-6 text-3xl sm:text-4xl animate-bounce select-none transition-all duration-1000"
                      style={{
                        left: `${e.left}%`,
                        transform: 'translateY(-180px) scale(1.4)',
                        opacity: 0,
                        transition: 'transform 2.2s ease-out, opacity 2.2s ease-out',
                      }}
                    >
                      {e.emoji}
                    </div>
                  ))}
                </div>
              </div>

              {/* Video Loader Input Row */}
              <div className="bg-[#111111]/90 border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={videoInputUrl}
                    onChange={(e) => setVideoInputUrl(e.target.value)}
                    placeholder="Вставьте ссылку на YouTube (видео / Shorts) или VK Видео..."
                    className="w-full bg-[#181818] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-white/30"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLoadVideo(videoInputUrl);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleLoadVideo(videoInputUrl)}
                  className="py-2 px-5 bg-white hover:bg-neutral-200 text-black font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Загрузить видео
                </button>
              </div>

              {/* Quick Preset Video Selector buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-neutral-400">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider shrink-0">
                  Пресеты:
                </span>
                <button
                  type="button"
                  onClick={() => handleLoadVideo('https://www.youtube.com/watch?v=jfKfPfyJRdk')}
                  className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300 hover:text-white shrink-0 cursor-pointer"
                >
                  🎵 Lofi YouTube
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadVideo('https://www.youtube.com/watch?v=4xDzrJKXOOY')}
                  className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300 hover:text-white shrink-0 cursor-pointer"
                >
                  🌆 Synthwave Chill
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadVideo('https://vk.com/video-22822305_456241984')}
                  className="px-2.5 py-1 rounded-md bg-blue-950/40 hover:bg-blue-900/40 border border-blue-500/30 text-blue-300 hover:text-white shrink-0 cursor-pointer"
                >
                  📺 VK Видео Шоу
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadVideo('https://vk.com/video-28363549_456239106')}
                  className="px-2.5 py-1 rounded-md bg-blue-950/40 hover:bg-blue-900/40 border border-blue-500/30 text-blue-300 hover:text-white shrink-0 cursor-pointer"
                >
                  🎤 VK Клип
                </button>
              </div>
            </div>

            {/* Right: Separate Chat Window */}
            <ChatWindow
              messages={chatMessages}
              onlineCount={onlineCount}
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
              onSendEmoji={handleSendEmoji}
            />
          </div>
        )}
      </main>

      {/* FOOTER */}
      {currentView !== 'room' && (
        <footer className="py-2.5 px-4 text-center text-[11px] text-neutral-500 border-t border-white/5 shrink-0">
          rave reh • Синхронный плеер YouTube & VK Видео • Локальное сохранение аккаунтов без серверов
        </footer>
      )}

      {/* MODALS */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onUserChange={(updated) => {
          setCurrentUser(updated);
          broadcastPacket({
            type: 'PROFILE_UPDATE',
            payload: { newNick: updated.nickname, avatar: updated.avatar },
          });
        }}
        onNotification={showToast}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onUserChange={(updated) => {
          setCurrentUser(updated);
          broadcastPacket({
            type: 'PROFILE_UPDATE',
            payload: { newNick: updated.nickname, avatar: updated.avatar },
          });
        }}
        onOpenStats={() => setIsStatsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onNotification={showToast}
      />

      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
