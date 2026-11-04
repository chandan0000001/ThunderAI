import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { api } from '../../services/api';
import confetti from 'canvas-confetti';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Calendar,
  ArrowRight,
  Check,
  AlertCircle,
  Zap,
  RotateCcw,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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
  const [step, setStep] = useState<'form' | 'otp'>('form');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState<number | ''>('');

  // OTP Fields
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Sync mode with prop
  useEffect(() => {
    setMode(initialMode);
    setStep('form');
    setError(null);
    setSuccessBanner(null);
  }, [initialMode, isOpen]);

  // Resend OTP countdown timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 'otp' && resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendCooldown]);

  // Auto-focus OTP input when switching to OTP view
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [step]);

  if (!isOpen) return null;

  // Password validation checks for UX guidance
  const hasMinLen = password.length >= 8 && password.length <= 30;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSpecial = /[~!@#$%^&*():]/.test(password);
  const isPasswordValid = hasMinLen && hasUpper && hasLower && hasNum && hasSpecial;

  // Google OAuth Login / Signup submission
  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setError('No credential token received from Google');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessBanner(null);

    try {
      const res = await api.auth.googleLogin(credentialResponse.credential);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
      onSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Primary Login / Signup submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessBanner(null);
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

        if (res.requiresVerification) {
          setStep('otp');
          setOtp(res.devOtp || '');
          setResendCooldown(60);
          setSuccessBanner(
            res.devOtp
              ? `Verification code: ${res.devOtp} (Render Free Tier blocks SMTP)`
              : (res.message || 'A 6-digit verification code has been dispatched to your email.')
          );
          return;
        }

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

        if (res.requiresVerification) {
          setStep('otp');
          setOtp(res.devOtp || '');
          setResendCooldown(60);
          setSuccessBanner(
            res.devOtp
              ? `Verification code: ${res.devOtp} (Render Free Tier blocks SMTP)`
              : (res.message || 'Your email is not verified yet. A fresh 6-digit code has been sent to your email.')
          );
          return;
        }

        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
        onSuccess(res);
      }
    } catch (err: any) {
      if (err.status === 403 || err.message?.includes('not verified')) {
        setStep('otp');
        setOtp('');
        setResendCooldown(60);
        setSuccessBanner(err.message || 'Please verify your email address to continue.');
        return;
      }
      setError(err.message || 'Authentication failed. Please check credentials or ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Verification Submission
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessBanner(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.auth.verifyOTP({
        email: email.trim().toLowerCase(),
        otp: cleanOtp,
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      onSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP Action
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;

    setError(null);
    setSuccessBanner(null);
    setResending(true);

    try {
      const res: any = await api.auth.resendOTP({
        email: email.trim().toLowerCase(),
      });
      setResendCooldown(60);
      if (res.devOtp) {
        setOtp(res.devOtp);
        setSuccessBanner(`New code: ${res.devOtp} (Render Free Tier blocks SMTP)`);
      } else {
        setSuccessBanner(res.message || 'A new 6-digit code has been sent to your email.');
        setOtp('');
      }
      otpInputRef.current?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-md rounded-2xl bg-[#141418] p-6 sm:p-8 border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle top glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-400/[0.08] rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ==================== STEP 2: OTP VERIFICATION VIEW ==================== */}
        {step === 'otp' ? (
          <div>
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setError(null);
                setSuccessBanner(null);
              }}
              className="inline-flex items-center space-x-1 text-xs font-mono text-zinc-400 hover:text-white mb-4 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to credentials</span>
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-400/10 p-0.5 mb-3 border border-yellow-400/30">
                <KeyRound className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="font-syne text-2xl font-bold text-white">Verify Your Email</h3>
              <p className="text-xs text-zinc-400 font-mono mt-1.5 leading-relaxed">
                Enter the 6-digit code sent to<br />
                <span className="text-yellow-400 font-semibold">{email.trim().toLowerCase()}</span>
              </p>
            </div>

            {/* Success Notification */}
            {successBanner && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-start space-x-2">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{successBanner}</span>
              </div>
            )}

            {/* Error Notification */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1 text-center">
                  6-DIGIT VERIFICATION CODE
                </label>
                <div className="relative">
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setOtp(val);
                    }}
                    placeholder="••••••"
                    className="w-full py-3.5 px-4 rounded-xl bg-black/60 border border-white/20 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 focus:outline-none text-2xl text-center font-mono font-bold tracking-[0.5em] text-white placeholder-zinc-700 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.trim().length !== 6}
                className="w-full py-3.5 rounded-lg bg-yellow-400 text-black font-mono text-xs uppercase tracking-wider font-bold hover:bg-yellow-300 disabled:opacity-40 transition-all flex items-center justify-center space-x-2 mt-4 shadow-lg shadow-yellow-400/10"
              >
                {loading ? (
                  <span>VERIFYING CODE...</span>
                ) : (
                  <>
                    <span>ACTIVATE & ENTER WORKSPACE</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Resend Code Section */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-500">Didn't receive the code?</span>
              {resendCooldown > 0 ? (
                <span className="text-zinc-500">
                  Resend in <strong className="text-yellow-400">{resendCooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-yellow-400 hover:text-yellow-300 transition flex items-center space-x-1.5 underline underline-offset-2"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Sending...' : 'Resend Code'}</span>
                </button>
              )}
            </div>

            {/* Spam / Junk Reminder */}
            <p className="mt-3 text-[11px] text-zinc-500 font-mono text-center">
              💡 Tip: Please check your <span className="text-zinc-300">Spam</span> or <span className="text-zinc-300">Junk / Promotions</span> folder if the code doesn't appear in your main inbox.
            </p>
          </div>
        ) : (
          /* ==================== STEP 1: CREDENTIALS VIEW ==================== */
          <div>
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
                    setSuccessBanner(null);
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
                    setSuccessBanner(null);
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

              {/* Google OAuth Section */}
              <div className="mt-4">
                {GOOGLE_CLIENT_ID ? (
                  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                    <div className="flex justify-center w-full min-h-[44px]">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('Google sign-in encountered an issue. Please try again.')}
                        theme="filled_black"
                        shape="rectangular"
                        size="large"
                        width="100%"
                        text={mode === 'signup' ? 'signup_with' : 'signin_with'}
                      />
                    </div>
                  </GoogleOAuthProvider>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError(
                        'Google OAuth Client ID not configured yet. Add VITE_GOOGLE_CLIENT_ID to Frontend/.env or Cloudflare Pages environment variables.'
                      );
                    }}
                    className="w-full py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center justify-center space-x-2.5 text-xs font-mono text-white cursor-pointer group"
                  >
                    <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{mode === 'signup' ? 'SIGN UP WITH GOOGLE' : 'CONTINUE WITH GOOGLE'}</span>
                  </button>
                )}

                <div className="flex items-center my-4">
                  <div className="flex-1 border-t border-white/10" />
                  <span className="px-3 text-[10px] font-mono text-zinc-500 uppercase">
                    OR WITH EMAIL
                  </span>
                  <div className="flex-1 border-t border-white/10" />
                </div>
              </div>
            </div>

            {/* Error Notification */}
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
                  <label className="block text-xs font-mono text-zinc-400 mb-1">
                    FULL NAME (3-35 CHARACTERS)
                  </label>
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
                  <div
                    className={`flex items-center space-x-1 ${
                      hasNum && hasSpecial ? 'text-emerald-400' : ''
                    }`}
                  >
                    <Check
                      className={`w-3 h-3 ${hasNum && hasSpecial ? 'opacity-100' : 'opacity-30'}`}
                    />
                    <span>Number & Symbol</span>
                  </div>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">
                    AGE (18-99, OPTIONAL)
                  </label>
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
          </div>
        )}
      </div>
    </div>
  );
};
