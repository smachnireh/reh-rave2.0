import React, { useState, useRef } from 'react';
import { UserAccount } from '../types';
import { saveCurrentUser, getColorsForString, formatDurationRu, setActiveUserId, getAllAccounts } from '../utils/storage';
import { X, Camera, Check, LogOut, Users, BarChart3, Shield } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onUserChange: (user: UserAccount) => void;
  onOpenStats: () => void;
  onOpenAuth: () => void;
  onNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  onOpenStats,
  onOpenAuth,
  onNotification,
}) => {
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process file upload & resize via canvas
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 120;
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let srcX = 0;
        let srcY = 0;
        let srcWidth = img.width;
        let srcHeight = img.height;

        if (img.width > img.height) {
          srcWidth = img.height;
          srcX = (img.width - img.height) / 2;
        } else if (img.height > img.width) {
          srcHeight = img.width;
          srcY = (img.height - img.width) / 2;
        }

        ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, maxSize, maxSize);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setAvatar(compressedBase64);
        onNotification('Аватар выбран', 'info');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const cleanNick = nickname.trim().substring(0, 18);
    if (!cleanNick) {
      onNotification('Никнейм не может быть пустым', 'error');
      return;
    }

    const updated: UserAccount = {
      ...currentUser,
      nickname: cleanNick,
      avatar: avatar,
    };

    saveCurrentUser(updated);
    onUserChange(updated);
    onNotification('Профиль успешно обновлен', 'success');
    onClose();
  };

  const handleLogout = () => {
    // Switch to first other account or create fresh guest
    const accounts = getAllAccounts();
    const other = accounts.find(a => a.id !== currentUser.id);
    if (other) {
      setActiveUserId(other.id);
      onUserChange(other);
      onNotification(`Вы вышли из аккаунта. Переключено на: ${other.nickname}`, 'info');
    } else {
      setActiveUserId(null);
      // will create fresh guest
      window.location.reload();
    }
    onClose();
  };

  const totalTime = (currentUser.stats.youtubeTimeSeconds || 0) + (currentUser.stats.vkTimeSeconds || 0);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h3 className="font-bold text-white text-base">Настройки профиля</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex flex-col items-center text-center">
          {/* Avatar Click to Upload */}
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div
              className="w-24 h-24 rounded-full border-2 border-white/20 group-hover:border-white transition-all overflow-hidden flex items-center justify-center text-3xl font-extrabold text-white shadow-xl"
              style={{
                background: avatar ? `url('${avatar}') center/cover` : getColorsForString(nickname || 'R'),
              }}
            >
              {!avatar && (nickname ? nickname.charAt(0).toUpperCase() : 'R')}
            </div>

            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <p className="text-xs text-neutral-400 -mt-2">
            Нажмите на фото, чтобы загрузить аватарку с устройства
          </p>

          {/* Nickname Input */}
          <div className="w-full text-left space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Никнейм в комнатах
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={18}
              placeholder="Введите имя..."
              className="w-full bg-[#181818] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Provider badge */}
          <div className="w-full bg-neutral-900/60 border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-neutral-300 font-medium">
                {currentUser.provider === 'gmail'
                  ? 'Авторизован через Gmail'
                  : currentUser.provider === 'email'
                  ? 'Email аккаунт'
                  : 'Гостевой аккаунт'}
              </span>
            </div>
            {currentUser.email ? (
              <span className="text-neutral-400 font-mono text-[11px] truncate max-w-[120px]">
                {currentUser.email}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="text-white underline font-semibold text-[11px] cursor-pointer"
              >
                Привязать почту
              </button>
            )}
          </div>

          {/* Watch Time Summary & Stats Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenStats();
            }}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 flex items-center justify-between text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
                  Общее время в комнатах
                </div>
                <div className="text-[11px] text-neutral-400">
                  YouTube + VK: {formatDurationRu(totalTime)}
                </div>
              </div>
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-white transition-colors">
              Подробнее →
            </span>
          </button>

          {/* Actions */}
          <div className="w-full flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-black bg-white hover:bg-neutral-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              Сохранить
            </button>
          </div>

          {/* Account Switching / Logout */}
          <div className="w-full pt-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              Сменить аккаунт
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
