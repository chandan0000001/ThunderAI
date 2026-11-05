import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { ByokProviderStatus } from '../../types';
import {
  Key,
  ShieldCheck,
  Clock,
  Trash2,
  Check,
  AlertTriangle,
  RotateCw,
  X,
  Zap,
  Info,
} from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeysUpdated?: () => void;
}

const PROVIDERS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tag: 'Open-Weights Gateway',
    placeholder: 'sk-or-v1-..., sk-or-v1-... (comma-separated for round-robin)',
    desc: 'Access hundreds of open-source & proprietary models via unified endpoint.',
  },
  {
    id: 'groq',
    name: 'Groq',
    tag: 'LPU Ultra Inference',
    placeholder: 'gsk_..., gsk_... (comma-separated for round-robin)',
    desc: 'Lightning-fast 500+ tokens/sec inference for Llama 3.3 and DeepSeek R1.',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    tag: 'Reasoning Titan',
    placeholder: 'sk-ant-api03-..., sk-ant-api03-...',
    desc: 'Claude 3.5 Sonnet and Haiku for complex architecture and coding.',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT / OpenAI',
    tag: 'OpenAI Frontier',
    placeholder: 'sk-proj-..., sk-proj-...',
    desc: 'GPT-4o, o1, and o3-mini models via OpenAI direct API.',
  },
] as const;

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeysUpdated }) => {
  const [statuses, setStatuses] = useState<Record<string, ByokProviderStatus>>({});
  const [selectedProvider, setSelectedProvider] = useState<string>('openrouter');
  const [keyInput, setKeyInput] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStatuses();
    }
  }, [isOpen]);

  const loadStatuses = async () => {
    try {
      const res = await api.byok.getStatus();
      const map: Record<string, ByokProviderStatus> = {};
      res.providers?.forEach((p) => {
        map[p.provider] = p;
      });
      setStatuses(map);
    } catch (e: any) {
      console.warn('Could not load BYOK statuses:', e.message);
    }
  };

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      showNotice('error', 'Please enter at least one valid API key');
      return;
    }

    try {
      setSaving(true);
      const res = await api.byok.saveKey(selectedProvider, keyInput.trim());
      showNotice('success', res.message || 'API key saved with 3-hour lease!');
      setKeyInput('');
      await loadStatuses();
      if (onKeysUpdated) onKeysUpdated();
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (prov: string) => {
    try {
      setSaving(true);
      const res = await api.byok.deleteKey(prov);
      showNotice('success', res.message || 'API key removed');
      await loadStatuses();
      if (onKeysUpdated) onKeysUpdated();
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to delete key');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentStatus = statuses[selectedProvider];
  const activeProviderMeta = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];

  const formatTtl = (seconds?: number) => {
    if (!seconds || seconds <= 0) return 'Inactive';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m lease`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0d0e14] text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-b border-white/[0.08] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-mono text-xs sm:text-sm uppercase tracking-wider font-bold text-white flex items-center space-x-2">
                <span>Custom API Keys // BYOK Engine</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-bold">
                  Round-Robin Active
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono hidden sm:block">
                Bring your own keys to bypass platform rate limits with Thunder system prompts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 font-mono text-xs">
          {/* Notification */}
          {notice && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs animate-fadeIn ${
                notice.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                {notice.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{notice.message}</span>
              </div>
              <button onClick={() => setNotice(null)} className="p-1 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Security & Lifecycle Specs Card */}
          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div className="flex items-start space-x-2.5 text-zinc-300">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block uppercase text-[10px] tracking-wider">
                  3-Hour Inactivity Auto-Cleanup
                </strong>
                <span>
                  Keys are stored securely in Redis and automatically purged after 3 hours of inactivity.
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-2.5 text-zinc-300">
              <RotateCw className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block uppercase text-[10px] tracking-wider">
                  Automated Round-Robin
                </strong>
                <span>
                  Provide multiple comma-separated keys for smooth automatic rotation across prompts.
                </span>
              </div>
            </div>
          </div>

          {/* Provider Selection Tabs */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-bold">
              Select AI Engine Provider:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROVIDERS.map((prov) => {
                const isSelected = selectedProvider === prov.id;
                const status = statuses[prov.id];
                const isActive = status?.active;

                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(prov.id);
                      setKeyInput('');
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between h-20 ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/10 text-white shadow-lg shadow-amber-500/10'
                        : 'border-white/10 bg-black/40 text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs">{prov.name}</span>
                      {isActive ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-zinc-600" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{isActive ? `${status.keyCount} Key(s)` : 'Default'}</span>
                      {isActive && <span className="text-emerald-400 font-bold">ACTIVE</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Provider Status Card */}
          {currentStatus?.active ? (
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-bold text-xs uppercase">
                    {activeProviderMeta.name} Custom Keys Connected
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteKey(selectedProvider)}
                  disabled={saving}
                  className="px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[10px] flex items-center space-x-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove Keys</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-zinc-500 block uppercase">Keys In Pool</span>
                  <span className="text-white font-bold">{currentStatus.keyCount} (Round-Robin)</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-zinc-500 block uppercase">Primary Key</span>
                  <span className="text-zinc-300 font-mono">{currentStatus.maskedKey}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-zinc-500 block uppercase">Inactivity Lease</span>
                  <span className="text-emerald-400 font-bold">
                    {formatTtl(currentStatus.ttlRemainingSeconds)}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 pt-1 leading-relaxed">
                Platform quota is bypassed for this model. Rate limits and concurrency are governed directly by your {activeProviderMeta.name} account.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl border border-white/5 bg-white/[0.01] flex items-start space-x-2 text-zinc-400 text-[11px]">
              <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <span>
                Currently utilizing Thunder default free system keys for {activeProviderMeta.name}. Add your own keys below to unlock dedicated high-throughput concurrency.
              </span>
            </div>
          )}

          {/* Key Input Form */}
          <form onSubmit={handleSaveKey} className="space-y-3 pt-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] uppercase tracking-wider text-zinc-300 font-bold block">
                  {activeProviderMeta.name} API Key(s):
                </label>
                <span className="text-[10px] text-zinc-500 font-normal">
                  Comma-separated for Round-Robin
                </span>
              </div>
              <textarea
                rows={3}
                required
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={activeProviderMeta.placeholder}
                className="w-full p-3 rounded-2xl border border-white/10 bg-black/60 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 font-mono text-xs leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-zinc-500 flex items-center space-x-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Thunder system prompt remains standard</span>
              </span>

              <button
                type="submit"
                disabled={saving || !keyInput.trim()}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-lg"
              >
                <span>{saving ? 'Validating...' : currentStatus?.active ? 'Update Key Pool' : 'Connect API Key'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
