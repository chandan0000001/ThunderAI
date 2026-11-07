import React, { useState, useEffect } from 'react';
import type { User } from '../../types';
import { api } from '../../services/api';
import {
  X,
  LogOut,
  Trash2,
  Zap,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  Layers,
  Database,
  ShieldCheck,
} from 'lucide-react';
import { DeleteAccountModal } from './DeleteAccountModal';
import { AdminPanel } from '../admin/AdminPanel';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void> | void;
  isDarkMode?: boolean;
  onUserUpdated?: (user: User) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout,
  onDeleteAccount,
  onUserUpdated,
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'admin'>('profile');
  const [localUsage, setLocalUsage] = useState({
    tokenUsed: currentUser?.usage?.tokenUsed || currentUser?.usage?.totalTokenUsed || 0,
    totalTokenUsed: currentUser?.usage?.totalTokenUsed || 0,
    tokenLimit: currentUser?.usage?.tokenLimit || 10000,
    windowSeconds: currentUser?.usage?.windowSeconds || 18000,
    ttl: currentUser?.usage?.ttl || 0,
    isUnlimited: currentUser?.usage?.isUnlimited || false,
  });

  // Sync when currentUser changes
  useEffect(() => {
    if (currentUser?.usage) {
      setLocalUsage({
        tokenUsed: currentUser.usage.tokenUsed ?? currentUser.usage.totalTokenUsed ?? 0,
        totalTokenUsed: currentUser.usage.totalTokenUsed ?? 0,
        tokenLimit: currentUser.usage.tokenLimit ?? 10000,
        windowSeconds: currentUser.usage.windowSeconds ?? 18000,
        ttl: currentUser.usage.ttl ?? 0,
        isUnlimited: currentUser.usage.isUnlimited ?? (currentUser.role === 'admin'),
      });
    }
  }, [currentUser]);

  // Fetch fresh telemetry immediately when modal opens
  useEffect(() => {
    if (isOpen) {
      handleLiveRefresh();
    }
  }, [isOpen]);

  // Live Refresh Token Quota from Backend
  const handleLiveRefresh = async () => {
    try {
      setRefreshing(true);
      const freshUser = await api.auth.getProfile();
      if (freshUser && freshUser.email) {
        if (freshUser.usage) {
          setLocalUsage({
            tokenUsed: freshUser.usage.tokenUsed ?? freshUser.usage.totalTokenUsed ?? 0,
            totalTokenUsed: freshUser.usage.totalTokenUsed ?? 0,
            tokenLimit: freshUser.usage.tokenLimit ?? 10000,
            windowSeconds: freshUser.usage.windowSeconds ?? 18000,
            ttl: freshUser.usage.ttl ?? 0,
            isUnlimited: freshUser.usage.isUnlimited ?? (freshUser.role === 'admin'),
          });
        }
        if (onUserUpdated) {
          onUserUpdated(freshUser);
        }
      }
    } catch (err: any) {
      console.warn('Could not refresh live tokens:', err.message);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  if (!isOpen) return null;

  const isAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'system_admin' ||
    Boolean(currentUser?.isAdmin) ||
    Boolean(currentUser?.email && currentUser.email.toLowerCase() === 'kumardalaichandan803@gmail.com') ||
    localUsage.isUnlimited ||
    localUsage.tokenLimit === -1;

  const used = localUsage.tokenUsed;
  const limit = isAdmin ? -1 : localUsage.tokenLimit || 10000;
  const percent = isAdmin ? 100 : Math.min(100, Math.round((used / (localUsage.tokenLimit || 10000)) * 100));
  const remaining = isAdmin ? -1 : Math.max(0, (localUsage.tokenLimit || 10000) - used);

  const copyEmail = () => {
    if (currentUser?.email) {
      navigator.clipboard.writeText(currentUser.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className={`relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] ${activeTab === 'admin' && isAdmin ? 'max-w-5xl' : 'max-w-xl'} rounded-none sm:rounded-3xl border-0 sm:border border-white/10 bg-[#0d0e14] text-white shadow-2xl flex flex-col overflow-hidden transition-all duration-200`}>
        {/* Subtle Top White Hairline Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {/* Modal Header Bar */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-white/[0.08] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <Zap className="w-3.5 h-3.5 fill-white" />
            </div>
            <div>
              <h3 className="font-mono text-[11px] sm:text-xs uppercase tracking-widest font-bold text-white truncate">
                {isAdmin ? 'System Governance // Telemetry' : 'Operator Profile // Telemetry'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Admin Tabs Switcher */}
        {isAdmin && (
          <div className="flex border-b border-white/[0.08] px-2 sm:px-6 bg-black/40 shrink-0">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 sm:flex-none py-2.5 sm:py-3 px-3 sm:px-4 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 sm:space-x-2 border-b-2 transition cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-white text-white bg-white/5'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Operator Telemetry</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 sm:flex-none py-2.5 sm:py-3 px-3 sm:px-4 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 sm:space-x-2 border-b-2 transition cursor-pointer ${
                activeTab === 'admin'
                  ? 'border-amber-400 text-amber-300 bg-amber-400/10'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Admin Console</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[8px] sm:text-[9px] shrink-0">ROOT</span>
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        {activeTab === 'admin' && isAdmin ? (
          <div className="p-3 sm:p-6 md:p-8 flex-1 overflow-y-auto overscroll-contain">
            <AdminPanel currentUserId={currentUser?._id} onClose={onClose} />
          </div>
        ) : (
        <div className="p-3.5 sm:p-6 md:p-8 space-y-3.5 sm:space-y-5 flex-1 overflow-y-auto overscroll-contain">
          {/* 1. User Identity Header */}
          <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
              {/* Avatar with Referrer-Policy and Error Fallback */}
              <div className="relative shrink-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl border border-white/20 bg-white/5 p-[1.5px] shadow-lg overflow-hidden flex items-center justify-center">
                  {currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser?.name || 'User profile avatar'}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextElementSibling) {
                          (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                        }
                      }}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : null}
                  <span
                    className={`${
                      currentUser?.avatar ? 'hidden' : 'flex'
                    } w-full h-full items-center justify-center font-bold text-xl sm:text-2xl font-mono text-white`}
                  >
                    {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
              </div>

              {/* Name & Email */}
              <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                <div className="flex items-center space-x-2 flex-wrap">
                  <h2 className="text-base sm:text-xl font-bold tracking-tight text-white truncate max-w-[180px] sm:max-w-none">
                    {currentUser?.name || 'Thunder Operator'}
                  </h2>
                  {isAdmin ? (
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-mono text-[8px] sm:text-[9px] font-bold flex items-center space-x-1 shadow-md shrink-0">
                      <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span>SYSTEM ADMIN</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[8px] sm:text-[9px] font-bold shrink-0">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="font-mono text-[11px] sm:text-xs text-zinc-400 truncate max-w-[190px] sm:max-w-none">
                    {currentUser?.email || 'operator@thunder.ai'}
                  </span>
                  <button
                    onClick={copyEmail}
                    className="p-1 hover:text-white transition cursor-pointer shrink-0"
                    title="Copy email"
                  >
                    {copiedEmail ? (
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-500 hover:text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Live Refresh Button */}
            <button
              onClick={handleLiveRefresh}
              disabled={refreshing}
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white font-mono text-[11px] sm:text-xs flex items-center space-x-1.5 sm:space-x-2 transition cursor-pointer shrink-0"
              title="Refresh live token consumption from Redis & MongoDB"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>LIVE SYNC</span>
            </button>
          </div>

          {/* 2. LIVE TOKEN CONSUMPTION GAUGE */}
          <div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-black/60 shadow-xl space-y-3.5 sm:space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-mono text-[10px] sm:text-xs uppercase tracking-wider font-bold text-zinc-300">
                  Live Token Quota // Redis Sliding Window
                </span>
              </div>
              <span className={`font-mono text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-bold ${
                isAdmin ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-white/10 text-white'
              }`}>
                {isAdmin ? '∞ UNLIMITED' : `${percent}% UTILIZED`}
              </span>
            </div>

            {/* Metrics Display */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="p-2.5 sm:p-3.5 rounded-xl border border-white/5 bg-[#121319]">
                <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 block uppercase">
                  Tokens Consumed
                </span>
                <span className="text-base sm:text-xl font-bold font-mono text-white">
                  {used.toLocaleString()}
                </span>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl border border-white/5 bg-[#121319]">
                <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 block uppercase">
                  Quota Window Limit
                </span>
                <span className="text-base sm:text-xl font-bold font-mono text-white">
                  {isAdmin ? '∞ UNLIMITED' : limit.toLocaleString()}
                </span>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl border border-white/5 bg-[#121319] col-span-2 sm:col-span-1">
                <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 block uppercase">
                  Remaining Tokens
                </span>
                <span className="text-base sm:text-xl font-bold font-mono text-emerald-400">
                  {isAdmin ? '∞ UNLIMITED' : remaining.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/80 rounded-full h-2 sm:h-2.5 overflow-hidden border border-white/10 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isAdmin ? 'bg-gradient-to-r from-emerald-400 via-amber-400 to-yellow-300' : 'bg-white'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-zinc-500 pt-0.5 sm:pt-1 flex-wrap gap-1">
              <span>{isAdmin ? 'GOVERNANCE: BYPASSED FOR SYSTEM ADMIN' : 'GOVERNANCE: 60-SEC / WINDOW RATE LIMIT'}</span>
              <span className="text-emerald-400">{isAdmin ? 'STATUS: UNRESTRICTED CHAT' : 'STATUS: OPERATIONAL'}</span>
            </div>
          </div>

          {/* 3. TECHNICAL SPEC MATRIX */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Operator Info */}
            <div className="p-2.5 sm:p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex items-center space-x-2 sm:space-x-3">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-white">
                <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[10px] font-mono text-zinc-500 uppercase block truncate">
                  Tier & Role
                </span>
                <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-white truncate block">
                  {isAdmin ? 'System Admin' : 'Standard Core'}
                </span>
              </div>
            </div>

            {/* Engine Gateway */}
            <div className="p-2.5 sm:p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex items-center space-x-2 sm:space-x-3">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-white">
                <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[10px] font-mono text-zinc-500 uppercase block truncate">
                  Neural Router
                </span>
                <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-white truncate block">
                  OpenRouter Active
                </span>
              </div>
            </div>

            {/* Security Protocol */}
            <div className="p-2.5 sm:p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex items-center space-x-2 sm:space-x-3">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-emerald-400">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[10px] font-mono text-zinc-500 uppercase block truncate">
                  Security Protocol
                </span>
                <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-white truncate block">
                  JWT // Bcrypt-12
                </span>
              </div>
            </div>

            {/* Context Summarization */}
            <div className="p-2.5 sm:p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex items-center space-x-2 sm:space-x-3">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-white">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] sm:text-[10px] font-mono text-zinc-500 uppercase block truncate">
                  Memory Cache
                </span>
                <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-white truncate block">
                  Adaptive Summary
                </span>
              </div>
            </div>
          </div>

          {/* 4. FOOTER ACTIONS */}
          <div className="pt-3 sm:pt-4 border-t border-white/[0.08] flex items-center justify-between shrink-0 gap-2">
            <button
              onClick={onLogout}
              className="px-3 sm:px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-mono text-xs flex items-center space-x-1.5 sm:space-x-2 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>SIGN OUT</span>
            </button>

            {!isAdmin ? (
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="px-3 sm:px-4 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-mono text-xs flex items-center space-x-1.5 sm:space-x-2 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>DELETE ACCOUNT</span>
              </button>
            ) : (
              <div className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[9px] sm:text-xs">
                <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">PROTECTED ROOT ADMIN</span>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Delete Account Modal Confirmation - Non-admin only */}
      {!isAdmin && (
        <DeleteAccountModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirmDelete={async () => {
            setDeleteModalOpen(false);
            await onDeleteAccount();
          }}
          userEmail={currentUser?.email}
          userName={currentUser?.name}
          isDarkMode={true}
        />
      )}
    </div>
  );
};
