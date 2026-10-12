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
  Database
} from 'lucide-react';
import { DeleteAccountModal } from './DeleteAccountModal';

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
  isDarkMode = true,
  onUserUpdated,
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [localUsage, setLocalUsage] = useState({
    tokenUsed: currentUser?.usage?.tokenUsed || currentUser?.usage?.totalTokenUsed || 0,
    totalTokenUsed: currentUser?.usage?.totalTokenUsed || 0,
    tokenLimit: currentUser?.usage?.tokenLimit || 10000,
    windowSeconds: currentUser?.usage?.windowSeconds || 18000,
    ttl: currentUser?.usage?.ttl || 0,
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

  const used = localUsage.tokenUsed;
  const limit = localUsage.tokenLimit || 10000;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const remaining = Math.max(0, limit - used);

  const copyEmail = () => {
    if (currentUser?.email) {
      navigator.clipboard.writeText(currentUser.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div
        className={`relative w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden transition-all duration-200 ${
          isDarkMode
            ? 'bg-[#0b0c10] border-white/10 text-white shadow-[0_0_50px_rgba(250,204,21,0.08)]'
            : 'bg-[#ffffff] border-black/10 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
        }`}
      >
        {/* Subtle Architectural Grid Lines */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />

        {/* Modal Header Bar */}
        <div
          className={`px-6 py-5 flex items-center justify-between border-b ${
            isDarkMode ? 'border-white/[0.08]' : 'border-black/[0.08]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold">
                Operator Profile // Telemetry
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition ${
              isDarkMode
                ? 'hover:bg-white/10 text-zinc-400 hover:text-white'
                : 'hover:bg-black/5 text-zinc-600 hover:text-black'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* 1. User Identity Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              {/* Glowing Avatar */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-400 via-amber-400 to-yellow-200 p-[2px] shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                  <div
                    className={`w-full h-full rounded-2xl flex items-center justify-center font-bold text-2xl font-mono ${
                      isDarkMode ? 'bg-[#121318] text-white' : 'bg-white text-zinc-950'
                    }`}
                  >
                    {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
              </div>

              {/* Name & Email */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold tracking-tight">
                    {currentUser?.name || 'Thunder Operator'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-500 font-mono text-[9px] font-bold">
                    ACTIVE
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`font-mono text-xs ${
                      isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    {currentUser?.email || 'operator@thunder.ai'}
                  </span>
                  <button
                    onClick={copyEmail}
                    className="p-1 hover:text-yellow-400 transition"
                    title="Copy email"
                  >
                    {copiedEmail ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Live Refresh Button */}
            <button
              onClick={handleLiveRefresh}
              disabled={refreshing}
              className={`px-3.5 py-2 rounded-xl border font-mono text-xs flex items-center space-x-2 transition ${
                isDarkMode
                  ? 'border-yellow-400/30 hover:border-yellow-400/60 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20'
                  : 'border-yellow-500/40 hover:border-yellow-500/80 bg-yellow-400/20 text-yellow-800 hover:bg-yellow-400/30 font-semibold'
              }`}
              title="Refresh live token consumption from Redis & MongoDB"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>LIVE SYNC</span>
            </button>
          </div>

          {/* 2. LIVE ELECTRIC TOKEN CONSUMPTION GAUGE (Prominently requested) */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              isDarkMode
                ? 'bg-yellow-400/[0.03] border-yellow-400/30 shadow-[0_0_30px_rgba(250,204,21,0.06)]'
                : 'bg-yellow-400/[0.08] border-yellow-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold text-yellow-500">
                  Live Token Quota // Redis Sliding Window
                </span>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-500 font-bold">
                {percent}% UTILIZED
              </span>
            </div>

            {/* Big Metrics Display */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
              <div
                className={`p-3 rounded-xl border ${
                  isDarkMode ? 'bg-[#121318] border-white/5' : 'bg-white border-zinc-200'
                }`}
              >
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                  Tokens Consumed
                </span>
                <span className="text-xl font-bold font-mono text-yellow-400">
                  {used.toLocaleString()}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  isDarkMode ? 'bg-[#121318] border-white/5' : 'bg-white border-zinc-200'
                }`}
              >
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                  Quota Window Limit
                </span>
                <span
                  className={`text-xl font-bold font-mono ${
                    isDarkMode ? 'text-white' : 'text-zinc-950'
                  }`}
                >
                  {limit.toLocaleString()}
                </span>
              </div>

              <div
                className={`col-span-2 sm:col-span-1 p-3 rounded-xl border ${
                  isDarkMode ? 'bg-[#121318] border-white/5' : 'bg-white border-zinc-200'
                }`}
              >
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                  Remaining Tokens
                </span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {remaining.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Glowing High-Voltage Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-2.5 rounded-full bg-zinc-800/40 overflow-hidden p-[1px]">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-200 rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(250,204,21,0.5)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
                <span>GOVERNANCE: 60-SEC / WINDOW RATE LIMIT</span>
                <span>STATUS: HIGH-VOLTAGE OK</span>
              </div>
            </div>
          </div>

          {/* 3. TECHNICAL SPEC MATRIX */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Age & Operator Info */}
            <div
              className={`p-4 rounded-xl border flex items-center space-x-3 ${
                isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-yellow-400/10 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                  Operator Age & Tier
                </span>
                <span className="text-sm font-semibold">
                  {currentUser?.age ? `${currentUser.age} yrs` : 'Standard'} // Enterprise Core
                </span>
              </div>
            </div>

            {/* Engine Gateway */}
            <div
              className={`p-4 rounded-xl border flex items-center space-x-3 ${
                isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-yellow-400/10 flex items-center justify-center shrink-0">
                <Database className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                  Active Neural Router
                </span>
                <span className="text-sm font-semibold">
                  OpenRouter Free Tier (Active)
                </span>
              </div>
            </div>

            {/* Security Protocol */}
            <div
              className={`p-4 rounded-xl border flex items-center space-x-3 ${
                isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-400/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                  Security Protocol
                </span>
                <span className="text-sm font-semibold">
                  Stateless JWT // Bcrypt-12
                </span>
              </div>
            </div>

            {/* Context Summarizer */}
            <div
              className={`p-4 rounded-xl border flex items-center space-x-3 ${
                isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-yellow-400/10 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                  Memory Condensation
                </span>
                <span className="text-sm font-semibold">
                  Adaptive Context Summarization
                </span>
              </div>
            </div>
          </div>

          {/* 4. Action Row */}
          <div
            className={`pt-4 border-t flex flex-wrap items-center justify-between gap-3 ${
              isDarkMode ? 'border-white/10' : 'border-black/10'
            }`}
          >
            <button
              onClick={onLogout}
              className={`px-5 py-2.5 rounded-xl border text-xs font-mono uppercase tracking-wider font-semibold transition flex items-center space-x-2 ${
                isDarkMode
                  ? 'border-white/20 hover:border-white text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10'
                  : 'border-black/20 hover:border-black text-zinc-700 hover:text-black bg-black/5 hover:bg-black/10'
              }`}
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-400" />
              <span>SIGN OUT</span>
            </button>

            <button
              onClick={() => setDeleteModalOpen(true)}
              className="px-5 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-mono uppercase tracking-wider font-semibold transition flex items-center space-x-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>DELETE ACCOUNT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cyberpunk Danger Confirmation Modal */}
      <DeleteAccountModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirmDelete={async () => {
          await onDeleteAccount();
          setDeleteModalOpen(false);
          onClose();
        }}
        userEmail={currentUser?.email}
        userName={currentUser?.name}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
