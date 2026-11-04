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
      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#0d0e14] text-white shadow-2xl overflow-hidden transition-all duration-200">
        {/* Subtle Top White Hairline Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {/* Modal Header Bar */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/[0.08]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold text-white">
                Operator Profile // Telemetry
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* 1. User Identity Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              {/* Avatar with Referrer-Policy and Error Fallback */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl border border-white/20 bg-white/5 p-[1.5px] shadow-lg overflow-hidden flex items-center justify-center">
                  {currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
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
                    } w-full h-full items-center justify-center font-bold text-2xl font-mono text-white`}
                  >
                    {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
              </div>

              {/* Name & Email */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    {currentUser?.name || 'Thunder Operator'}
                  </h2>
                  {currentUser?.role === 'admin' ? (
                    <span className="px-2 py-0.5 rounded-full bg-white text-black font-mono text-[9px] font-bold flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>ADMIN</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs text-zinc-400">
                    {currentUser?.email || 'operator@thunder.ai'}
                  </span>
                  <button
                    onClick={copyEmail}
                    className="p-1 hover:text-white transition cursor-pointer"
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
              className="px-3.5 py-2 rounded-xl border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white font-mono text-xs flex items-center space-x-2 transition cursor-pointer"
              title="Refresh live token consumption from Redis & MongoDB"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>LIVE SYNC</span>
            </button>
          </div>

          {/* 2. LIVE TOKEN CONSUMPTION GAUGE (Clean Dark Monochrome) */}
          <div className="p-5 rounded-2xl border border-white/10 bg-black/60 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs uppercase tracking-wider font-bold text-zinc-300">
                  Live Token Quota // Redis Sliding Window
                </span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white font-bold">
                {percent}% UTILIZED
              </span>
            </div>

            {/* Metrics Display */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-white/5 bg-[#121319]">
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                  Tokens Consumed
                </span>
                <span className="text-xl font-bold font-mono text-white">
                  {used.toLocaleString()}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-white/5 bg-[#121319]">
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                  Quota Window Limit
                </span>
                <span className="text-xl font-bold font-mono text-white">
                  {limit.toLocaleString()}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-white/5 bg-[#121319] col-span-2 sm:col-span-1">
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                  Remaining Tokens
                </span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {remaining.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/80 rounded-full h-2.5 overflow-hidden border border-white/10 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-500 bg-white"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
              <span>GOVERNANCE: 60-SEC / WINDOW RATE LIMIT</span>
              <span className="text-emerald-400">STATUS: OPERATIONAL</span>
            </div>
          </div>

          {/* 3. TECHNICAL SPEC MATRIX */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Age & Operator Info */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-white">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                  Operator Tier & Role
                </span>
                <span className="text-sm font-semibold text-white">
                  {currentUser?.role === 'admin' ? 'Admin Access' : 'Standard'} // Enterprise Core
                </span>
              </div>
            </div>

            {/* Engine Gateway */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-white">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                  Active Neural Router
                </span>
                <span className="text-sm font-semibold text-white">
                  OpenRouter Free Tier (Active)
                </span>
              </div>
            </div>

            {/* Security Protocol */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                  Security Protocol
                </span>
                <span className="text-sm font-semibold text-white">
                  Stateless JWT // Bcrypt-12
                </span>
              </div>
            </div>

            {/* Context Summarization */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-white">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                  Memory Condensation
                </span>
                <span className="text-sm font-semibold text-white">
                  Adaptive Context Summarization
                </span>
              </div>
            </div>
          </div>

          {/* 4. FOOTER ACTIONS */}
          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-mono text-xs flex items-center space-x-2 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>SIGN OUT</span>
            </button>

            <button
              onClick={() => setDeleteModalOpen(true)}
              className="px-4 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-mono text-xs flex items-center space-x-2 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>DELETE ACCOUNT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal Confirmation */}
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
    </div>
  );
};
