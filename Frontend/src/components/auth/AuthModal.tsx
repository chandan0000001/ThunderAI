import React, { useState } from 'react';
import { api } from '../../services/api';
import confetti from 'canvas-confetti';
import { X, Lock, Mail, User as UserIcon, Calendar, ArrowRight, Check, AlertCircle, Sparkles, Zap } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'signup';
  onClose: () => void;
  onSuccess: (userData: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Password validation checks for UX guidance
  const hasMinLen = password.length >= 8 && password.length <= 30;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSpecial = /[~!@#$%^&*():]/.test(password);
  const isPasswordValid = hasMinLen && hasUpper && hasLower && hasNum && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const payload: any = {
          name,
          email: email.trim().toLowerCase(),
          password,
        };
        if (age !== '' && Number(age) >= 18) {
          payload.age = Number(age);
        }

        const res = await api.auth.signup(payload);
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
        onSuccess(res);
      } else {
        const res = await api.auth.login({
          email: email.trim().toLowerCase(),
          password,
        });
        onSuccess(res);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials or ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setName('Chandan Dev');
    setEmail('chandan.dev@thunder.ai');
    setPassword('ThunderAI#2026');
    setAge(25);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-md rounded-2xl bg-[#141418] p-6 sm:p-8 border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle top glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-white/[0.05] rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-400/10 p-0.5 mb-3 border border-yellow-400/30">
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <h3 className="font-syne text-2xl font-bold text-white">
            {mode === 'signup' ? 'Create Your Account' : 'Welcome to Thunder AI'}
          </h3>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            {mode === 'signup'
              ? 'Join Thunder AI conversational workspace'
              : 'Sign in to access your models & conversations'}
          </p>

          {/* Mode Switch Tabs */}
          <div className="flex p-1 mt-5 rounded-lg bg-black/40 border border-white/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-md transition ${
                mode === 'login'
                  ? 'bg-white text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-md transition ${
                mode === 'signup'
                  ? 'bg-white text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              CREATE ACCOUNT
            </button>
          </div>
        </div>

        {/* Error message notification */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">FULL NAME (3-35 CHARACTERS)</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chandan"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-black/50 border border-white/10 focus:border-white focus:outline-none text-sm text-white placeholder-zinc-600 font-mono transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">EMAIL ADDRESS</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chandan@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-black/50 border border-white/10 focus:border-white focus:outline-none text-sm text-white placeholder-zinc-600 font-mono transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">PASSWORD</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-black/50 border border-white/10 focus:border-white focus:outline-none text-sm text-white placeholder-zinc-600 font-mono transition"
              />
            </div>

            {/* Password Validation live indicators */}
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-mono text-zinc-400">
              <div className={`flex items-center space-x-1 ${hasMinLen ? 'text-emerald-400' : ''}`}>
                <Check className={`w-3 h-3 ${hasMinLen ? 'opacity-100' : 'opacity-30'}`} />
                <span>8-30 characters</span>
              </div>
              <div className={`flex items-center space-x-1 ${hasUpper ? 'text-emerald-400' : ''}`}>
                <Check className={`w-3 h-3 ${hasUpper ? 'opacity-100' : 'opacity-30'}`} />
                <span>1 Uppercase (A-Z)</span>
              </div>
              <div className={`flex items-center space-x-1 ${hasLower ? 'text-emerald-400' : ''}`}>
                <Check className={`w-3 h-3 ${hasLower ? 'opacity-100' : 'opacity-30'}`} />
                <span>1 Lowercase (a-z)</span>
              </div>
              <div className={`flex items-center space-x-1 ${hasNum && hasSpecial ? 'text-emerald-400' : ''}`}>
                <Check className={`w-3 h-3 ${hasNum && hasSpecial ? 'opacity-100' : 'opacity-30'}`} />
                <span>Number & Symbol</span>
              </div>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">AGE (18-99, OPTIONAL)</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="18"
                  max="99"
                  value={age}
                  onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="24"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-black/50 border border-white/10 focus:border-white focus:outline-none text-sm text-white placeholder-zinc-600 font-mono transition"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'signup' && !isPasswordValid)}
            className="w-full py-3.5 rounded-lg bg-white text-black font-mono text-xs uppercase tracking-wider font-bold hover:bg-zinc-200 disabled:opacity-40 transition-all flex items-center justify-center space-x-2 mt-4 shadow-lg shadow-white/5"
          >
            {loading ? (
              <span>PROCESSING...</span>
            ) : (
              <>
                <span>{mode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials shortcut */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-500">Quick fill:</span>
          <button
            type="button"
            onClick={handleQuickDemo}
            className="text-white hover:text-zinc-300 transition flex items-center space-x-1 underline underline-offset-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fill Demo Credentials</span>
          </button>
        </div>
      </div>
    </div>
  );
};
