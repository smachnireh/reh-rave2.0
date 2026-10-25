import React from 'react';
import { UserAccount } from '../types';
import { formatDurationRu, getColorsForString } from '../utils/storage';
import { X, PlayCircle, Clock, MessageSquare, Flame, Award, Radio, Tv } from 'lucide-react';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  if (!isOpen) return null;

  const ytSeconds = currentUser.stats.youtubeTimeSeconds || 0;
  const vkSeconds = currentUser.stats.vkTimeSeconds || 0;
  const totalSeconds = ytSeconds + vkSeconds;

  // Compute rank based on total time
  const getRank = (sec: number) => {
    if (sec < 60) return { title: 'Новичок комнат', level: 1, nextAt: 60, icon: '🌱' };
    if (sec < 600) return { title: 'Зритель синхрона', level: 2, nextAt: 600, icon: '🍿' };
    if (sec < 3600) return { title: 'Активный киноман', level: 3, nextAt: 3600, icon: '🎬' };
    if (sec < 18000) return { title: 'Марафонец видео', level: 4, nextAt: 18000, icon: '🚀' };
    return { title: 'Легенда Rave Reh', level: 5, nextAt: 100000, icon: '👑' };
  };

  const rank = getRank(totalSeconds);
  const progressPercent = Math.min(100, Math.round((totalSeconds / rank.nextAt) * 100));

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden shadow-md"
              style={{
                background: currentUser.avatar
                  ? `url('${currentUser.avatar}') center/cover`
                  : getColorsForString(currentUser.nickname),
              }}
            >
              {!currentUser.avatar && currentUser.nickname.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight flex items-center gap-2">
                Статистика аккаунта: {currentUser.nickname}
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-neutral-300 font-normal">
                  {rank.icon} Ур. {rank.level}
                </span>
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                {currentUser.email || (currentUser.provider === 'guest' ? 'Гостевой режим' : 'Локальный аккаунт')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Level & Rank banner */}
          <div className="bg-gradient-to-r from-red-950/40 via-neutral-900 to-blue-950/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                Ранг аккаунта
              </span>
              <span className="text-xs font-bold text-white">
                {rank.title}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden mb-1.5">
              <div
                className="bg-gradient-to-r from-amber-400 to-rose-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-neutral-400">
              <span>Общее время: {formatDurationRu(totalSeconds)}</span>
              <span>До следующего ранга: {formatDurationRu(Math.max(0, rank.nextAt - totalSeconds))}</span>
            </div>
          </div>

          {/* Primary Cards: YouTube vs VK Video times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* YouTube Card */}
            <div className="bg-[#161616] border border-red-500/20 rounded-xl p-4 relative overflow-hidden group hover:border-red-500/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
                    <PlayCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wide">YouTube комнаты</span>
                </div>
                <span className="text-[10px] text-red-400/80 font-mono">YouTube API</span>
              </div>
              <div className="text-2xl font-extrabold text-white tracking-tight mt-1">
                {formatDurationRu(ytSeconds)}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Суммарное время просмотра синхронных видео YouTube
              </p>
            </div>

            {/* VK Video Card */}
            <div className="bg-[#161616] border border-blue-500/20 rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                    <Tv className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wide">VK Видео комнаты</span>
                </div>
                <span className="text-[10px] text-blue-400/80 font-mono">VK Player</span>
              </div>
              <div className="text-2xl font-extrabold text-white tracking-tight mt-1">
                {formatDurationRu(vkSeconds)}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Суммарное время просмотра VK Видео со звуком и синхроном
              </p>
            </div>
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-neutral-900/60 border border-white/5 rounded-xl p-3 text-center">
              <Radio className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" />
              <div className="text-lg font-bold text-white">{currentUser.stats.sessionsCount || 0}</div>
              <div className="text-[11px] text-neutral-400">Сессий комнат</div>
            </div>

            <div className="bg-neutral-900/60 border border-white/5 rounded-xl p-3 text-center">
              <MessageSquare className="w-4 h-4 text-purple-400 mx-auto mb-1.5" />
              <div className="text-lg font-bold text-white">{currentUser.stats.messagesCount || 0}</div>
              <div className="text-[11px] text-neutral-400">Сообщений в чате</div>
            </div>

            <div className="bg-neutral-900/60 border border-white/5 rounded-xl p-3 text-center">
              <Flame className="w-4 h-4 text-amber-400 mx-auto mb-1.5" />
              <div className="text-lg font-bold text-white">{currentUser.stats.reactionsCount || 0}</div>
              <div className="text-[11px] text-neutral-400">Эмодзи реакций</div>
            </div>
          </div>

          {/* Account Metadata footer */}
          <div className="text-[11px] text-neutral-500 border-t border-white/5 pt-3 flex items-center justify-between">
            <span>Аккаунт создан: {new Date(currentUser.createdAt).toLocaleDateString()}</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Автосохранение активно
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
