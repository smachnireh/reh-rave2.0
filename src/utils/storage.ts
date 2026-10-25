import { UserAccount, UserStats } from '../types';

const ACCOUNTS_KEY = 'ravereh_accounts_v2';
const ACTIVE_USER_ID_KEY = 'ravereh_active_uid';

const defaultAnimals = ["Кот", "Енот", "Панда", "Лисин", "Сова", "Бобр", "Ёжик", "Носорожек", "Барсук", "Пингвин", "Сокол", "Тигр"];

export function generateGuestNickname(): string {
  const randomAnimal = defaultAnimals[Math.floor(Math.random() * defaultAnimals.length)];
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${randomAnimal}_${randomNum}`;
}

export function createInitialStats(): UserStats {
  return {
    youtubeTimeSeconds: 0,
    vkTimeSeconds: 0,
    sessionsCount: 0,
    messagesCount: 0,
    reactionsCount: 0,
    lastActive: Date.now(),
  };
}

export function getAllAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse saved accounts', e);
    return [];
  }
}

export function saveAllAccounts(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts', e);
  }
}

export function getActiveUserId(): string | null {
  return localStorage.getItem(ACTIVE_USER_ID_KEY);
}

export function setActiveUserId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_USER_ID_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
  }
}

export function getCurrentUser(): UserAccount {
  const accounts = getAllAccounts();
  const activeId = getActiveUserId();

  if (activeId) {
    const found = accounts.find(a => a.id === activeId);
    if (found) return found;
  }

  // If there are existing accounts and no active selected, pick the first one
  if (accounts.length > 0) {
    setActiveUserId(accounts[0].id);
    return accounts[0];
  }

  // Otherwise, create a default local guest account so user is never blocked
  const legacyNick = localStorage.getItem('ravereh_nickname') || generateGuestNickname();
  const legacyAvatar = localStorage.getItem('ravereh_avatar') || '';

  const guestUser: UserAccount = {
    id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    email: '',
    nickname: legacyNick,
    avatar: legacyAvatar,
    provider: 'guest',
    createdAt: Date.now(),
    stats: createInitialStats(),
    history: [],
  };

  accounts.push(guestUser);
  saveAllAccounts(accounts);
  setActiveUserId(guestUser.id);
  return guestUser;
}

export function saveCurrentUser(updated: UserAccount): void {
  const accounts = getAllAccounts();
  const idx = accounts.findIndex(a => a.id === updated.id);
  if (idx >= 0) {
    accounts[idx] = updated;
  } else {
    accounts.push(updated);
  }
  saveAllAccounts(accounts);
}

/**
 * Increment watch time for the current user
 */
export function addWatchTime(userId: string, platform: 'youtube' | 'vk', seconds: number): void {
  if (seconds <= 0) return;
  const accounts = getAllAccounts();
  const user = accounts.find(a => a.id === userId);
  if (!user) return;

  if (platform === 'youtube') {
    user.stats.youtubeTimeSeconds = (user.stats.youtubeTimeSeconds || 0) + seconds;
  } else {
    user.stats.vkTimeSeconds = (user.stats.vkTimeSeconds || 0) + seconds;
  }
  user.stats.lastActive = Date.now();
  saveAllAccounts(accounts);
}

/**
 * Increment stats counters (messages, reactions, sessions)
 */
export function incrementStat(userId: string, statKey: keyof UserStats, delta = 1): void {
  const accounts = getAllAccounts();
  const user = accounts.find(a => a.id === userId);
  if (!user) return;

  const current = (user.stats[statKey] as number) || 0;
  // @ts-ignore
  user.stats[statKey] = current + delta;
  user.stats.lastActive = Date.now();
  saveAllAccounts(accounts);
}

/**
 * Format total seconds into human-readable Russian string
 * e.g., "1 ч. 24 мин.", "45 сек."
 */
export function formatDurationRu(totalSeconds: number): string {
  const sec = Math.floor(totalSeconds || 0);
  if (sec <= 0) return '0 сек.';

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours} ч. ${minutes} мин.`;
    }
    return `${hours} ч.`;
  }

  if (minutes > 0) {
    if (seconds > 0) {
      return `${minutes} мин. ${seconds} с.`;
    }
    return `${minutes} мин.`;
  }

  return `${seconds} сек.`;
}

/**
 * Color generator helper for initials avatar
 */
export function getColorsForString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 35%))`;
}
