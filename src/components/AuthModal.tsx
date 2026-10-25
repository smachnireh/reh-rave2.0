import React, { useState } from 'react';
import { UserAccount } from '../types';
import { getAllAccounts, saveCurrentUser, setActiveUserId, createInitialStats, getColorsForString } from '../utils/storage';
import { hashPassword } from '../utils/crypto';
import { X, Mail, Lock, User, Check, ArrowRight, ShieldCheck, LogIn, UserPlus } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onUserChange: (user: UserAccount) => void;
  onNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  onNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'google' | 'login' | 'register'>('google');
  
  // Google quick sign in state
  const [gmailInput, setGmailInput] = useState('dkit59102@gmail.com');
  const [gmailName, setGmailName] = useState(currentUser.nickname.startsWith('user_') ? 'Денис' : currentUser.nickname);

  // Email login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAvatar, setRegAvatar] = useState('');

  // Avatars presets
  const presetAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  ];

  if (!isOpen) return null;

  const existingAccounts = getAllAccounts();

  // 1. Google One-Click Login
  const handleGoogleSignIn = () => {
    const email = gmailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      onNotification('Пожалуйста, укажите корректный Gmail адрес', 'error');
      return;
    }

    const accounts = getAllAccounts();
    const existing = accounts.find(a => a.email.toLowerCase() === email);

    if (existing) {
      setActiveUserId(existing.id);
      onUserChange(existing);
      onNotification(`С возвращением, ${existing.nickname}!`, 'success');
      onClose();
      return;
    }

    // Create new Google-linked account
    const name = gmailName.trim() || email.split('@')[0];
    const newAccount: UserAccount = {
      id: 'acc_g_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      email: email,
      nickname: name,
      avatar: '',
      provider: 'gmail',
      createdAt: Date.now(),
      stats: currentUser.provider === 'guest' ? { ...currentUser.stats } : createInitialStats(),
      history: currentUser.provider === 'guest' ? [...currentUser.history] : [],
    };

    saveCurrentUser(newAccount);
    setActiveUserId(newAccount.id);
    onUserChange(newAccount);
    onNotification(`Аккаунт ${email} успешно создан через шаблон Google!`, 'success');
    onClose();
  };

  // 2. Standard Email Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      onNotification('Заполните почту и пароль', 'error');
      return;
    }

    const accounts = getAllAccounts();
    const target = accounts.find(a => a.email.toLowerCase() === loginEmail.trim().toLowerCase());

    if (!target) {
      onNotification('Аккаунт с такой почтой не найден. Зарегистрируйтесь!', 'error');
      return;
    }

    const inputHash = await hashPassword(loginPassword);
    if (target.passwordHash && target.passwordHash !== inputHash) {
      onNotification('Неверный пароль', 'error');
      return;
    }

    setActiveUserId(target.id);
    onUserChange(target);
    onNotification(`Вы успешно вошли как ${target.nickname}`, 'success');
    onClose();
  };

  // 3. Register New Account
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword.trim() || !regName.trim()) {
      onNotification('Заполните имя, почту и пароль', 'error');
      return;
    }

    if (regPassword.length < 4) {
      onNotification('Пароль должен содержать минимум 4 символа', 'error');
      return;
    }

    const accounts = getAllAccounts();
    const emailNorm = regEmail.trim().toLowerCase();
    if (accounts.some(a => a.email.toLowerCase() === emailNorm)) {
      onNotification('Аккаунт с такой почтой уже существует. Выполните вход.', 'error');
      return;
    }

    const pwdHash = await hashPassword(regPassword);
    const newAccount: UserAccount = {
      id: 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: emailNorm,
      nickname: regName.trim(),
      avatar: regAvatar,
      provider: 'email',
      passwordHash: pwdHash,
      createdAt: Date.now(),
      stats: currentUser.provider === 'guest' ? { ...currentUser.stats } : createInitialStats(),
      history: currentUser.provider === 'guest' ? [...currentUser.history] : [],
    };

    saveCurrentUser(newAccount);
    setActiveUserId(newAccount.id);
    onUserChange(newAccount);
    onNotification(`Аккаунт ${newAccount.nickname} успешно зарегистрирован!`, 'success');
    onClose();
  };

  // Quick switch between saved accounts
  const handleSelectAccount = (account: UserAccount) => {
    setActiveUserId(account.id);
    onUserChange(account);
    onNotification(`Активный аккаунт переключен на: ${account.nickname}`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-sm">
              R
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">Вход и Регистрация</h3>
              <p className="text-xs text-neutral-400">Сохранение времени и комнат без серверов</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="grid grid-cols-3 p-1.5 bg-black/40 border-b border-white/5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'google'
                ? 'bg-white text-black shadow-md font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Gmail / Google
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'login'
                ? 'bg-white text-black shadow-md font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Вход
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'register'
                ? 'bg-white text-black shadow-md font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Регистрация
          </button>
        </div>

        {/* Content area */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 1. GOOGLE TAB */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              <div className="bg-neutral-900/60 border border-white/5 rounded-xl p-4 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-white flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Быстрая авторизация через Google (Gmail)</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Автономный шаблон входа: сохраняет аккаунт в браузере навсегда без сторонних серверов и без терминала
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Ваш Gmail адрес
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={gmailInput}
                      onChange={(e) => setGmailInput(e.target.value)}
                      placeholder="example@gmail.com"
                      className="w-full bg-[#181818] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Отображаемое имя
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={gmailName}
                      onChange={(e) => setGmailName(e.target.value)}
                      placeholder="Ваше имя"
                      maxLength={20}
                      className="w-full bg-[#181818] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full bg-white hover:bg-neutral-200 text-black font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.99] mt-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Войти через Google ({gmailInput.split('@')[0] || 'Gmail'})
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2 text-[11px] text-neutral-500">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Все данные аккаунта и статистика сохраняются в памяти вашего браузера.</span>
              </div>
            </div>
          )}

          {/* 2. EMAIL LOGIN TAB */}
          {activeTab === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-[#181818] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Ваш пароль"
                    className="w-full bg-[#181818] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-white hover:bg-neutral-200 text-black font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                Войти в аккаунт
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* 3. REGISTER TAB */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Имя или Никнейм
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Например: Алекс"
                    maxLength={18}
                    className="w-full bg-[#181818] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Email (любой: Gmail, Yandex, Mail.ru)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="alex@gmail.com"
                    className="w-full bg-[#181818] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Минимум 4 знака"
                    className="w-full bg-[#181818] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Выберите аватар
                </label>
                <div className="flex gap-2">
                  {presetAvatars.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRegAvatar(url)}
                      className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${
                        regAvatar === url ? 'border-white scale-105 ring-2 ring-white/30' : 'border-white/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                      {regAvatar === url && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRegAvatar('')}
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                      regAvatar === '' ? 'border-white bg-neutral-800 text-white' : 'border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    Буква
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-white hover:bg-neutral-200 text-black font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                Создать аккаунт
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* List of previously saved accounts on this device */}
          {existingAccounts.length > 0 && (
            <div className="pt-4 border-t border-white/5">
              <h5 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
                Сохранённые аккаунты на этом устройстве ({existingAccounts.length})
              </h5>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {existingAccounts.map((acc) => {
                  const isActive = acc.id === currentUser.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => handleSelectAccount(acc)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-white/10 border border-white/20'
                          : 'bg-neutral-900/40 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                          style={{
                            background: acc.avatar ? `url('${acc.avatar}') center/cover` : getColorsForString(acc.nickname),
                          }}
                        >
                          {!acc.avatar && acc.nickname.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <div className="text-xs font-medium text-white flex items-center gap-1.5">
                            {acc.nickname}
                            {acc.provider === 'gmail' && (
                              <span className="text-[10px] bg-red-500/20 text-red-300 px-1 py-0.2 rounded font-mono">Gmail</span>
                            )}
                          </div>
                          {acc.email && (
                            <div className="text-[10px] text-neutral-400 font-mono">{acc.email}</div>
                          )}
                        </div>
                      </div>

                      {isActive ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Текущий
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-400 hover:text-white">
                          Выбрать
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
