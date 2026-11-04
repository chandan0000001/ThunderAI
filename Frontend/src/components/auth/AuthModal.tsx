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
  Eye,
  EyeOff,
  Quote,
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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      {/* Split Modal Container: Left Auth Form, Right Brand Showcase (Reference Image 2 Layout) */}
      <div
        className="relative w-full max-w-4xl rounded-3xl bg-[#0c0d14] border border-white/15 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full text-zinc-400 hover:text-white bg-black/40 hover:bg-white/10 transition border border-white/10 cursor-pointer"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* =========================================================================
            LEFT COLUMN (7 COLS): AUTHENTICATION FORM & CREDENTIALS
        ========================================================================= */}
        <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
          {/* Brand header */}
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              <Zap className="w-4 h-4 fill-black text-black" />
            </div>
            <span className="font-mono text-sm font-bold tracking-tight uppercase text-white">
              Thunder AI
            </span>
          </div>

          {/* ==================== STEP 2: OTP VERIFICATION VIEW ==================== */}
          {step === 'otp' ? (
            <div className="space-y-5 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setError(null);
                  setSuccessBanner(null);
                }}
                className="inline-flex items-center space-x-1.5 text-xs font-mono text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to credentials</span>
              </button>

              <div className="space-y-1.5">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-400/10 p-0.5 border border-yellow-400/30">
                  <KeyRound className="w-5 h-5 text-yellow-400" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">Verify Your Email</h3>
                <p className="text-xs text-zinc-400 font-normal leading-relaxed">
                  Enter the 6-digit code sent to{' '}
                  <span className="text-yellow-400 font-semibold">{email.trim().toLowerCase()}</span>
                </p>
              </div>

              {/* Success Notification */}
              {successBanner && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-start space-x-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{successBanner}</span>
                </div>
              )}

              {/* Error Notification */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                    6-DIGIT VERIFICATION CODE
                  </label>
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
                    className="w-full py-3 px-4 rounded-xl bg-black/60 border border-white/20 focus:border-white focus:outline-none text-2xl text-center font-mono font-bold tracking-[0.4em] text-white placeholder-zinc-700 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.trim().length !== 6}
                  className="w-full py-3 rounded-xl bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-zinc-200 disabled:opacity-40 transition-all flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
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
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">Didn't receive the code?</span>
                {resendCooldown > 0 ? (
                  <span className="text-zinc-500">
                    Resend in <strong className="text-white">{resendCooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending}
                    className="text-white hover:underline transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    <span>{resending ? 'Sending...' : 'Resend Code'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ==================== STEP 1: CREDENTIALS VIEW (SoftQA Layout) ==================== */
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {mode === 'signup' ? 'Create Your Account' : 'Welcome Back!'}
                </h2>
                <p className="text-xs text-zinc-400 font-normal">
                  {mode === 'signup'
                    ? 'Get started with 10,000 free tokens & instant model access.'
                    : 'Sign in to access your dashboard and continue optimizing your workflows.'}
                </p>
              </div>

              {/* Error Notification */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Primary Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alice"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-white focus:bg-white/[0.07] focus:outline-none text-xs text-white placeholder-zinc-500 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-white focus:bg-white/[0.07] focus:outline-none text-xs text-white placeholder-zinc-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Password
                    </label>
                    {mode === 'login' && (
                      <span className="text-[11px] text-zinc-400 hover:text-white cursor-pointer transition">
                        Forgot Password?
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-white focus:bg-white/[0.07] focus:outline-none text-xs text-white placeholder-zinc-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password helper in signup */}
                  {mode === 'signup' && (
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
                  )}
                </div>

                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Age (18-99, optional)
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="18"
                        max="99"
                        value={age}
                        onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="24"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-white focus:outline-none text-xs text-white placeholder-zinc-500 transition"
                      />
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || (mode === 'signup' && !isPasswordValid)}
                  className="w-full py-3 rounded-xl bg-[#0091ff] hover:bg-[#007ee5] text-white text-xs font-semibold tracking-wide shadow-[0_10px_25px_rgba(0,145,255,0.4)] disabled:opacity-40 transition-all flex items-center justify-center space-x-2 cursor-pointer mt-2"
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* OR Divider */}
              <div className="flex items-center my-3">
                <div className="flex-1 border-t border-white/10" />
                <span className="px-3 text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
                  OR
                </span>
                <div className="flex-1 border-t border-white/10" />
              </div>

              {/* Google OAuth Button */}
              {GOOGLE_CLIENT_ID ? (
                <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                  <div className="flex justify-center w-full min-h-[42px]">
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
                    setError('Google OAuth Client ID not configured yet. Add VITE_GOOGLE_CLIENT_ID to Frontend/.env');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] text-white text-xs font-medium transition flex items-center justify-center space-x-2.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              )}

              {/* Bottom mode switcher */}
              <div className="pt-2 text-center text-xs text-zinc-400">
                {mode === 'signup' ? (
                  <span>
                    Already have an Account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className="text-white font-semibold underline underline-offset-4 hover:text-zinc-200 cursor-pointer"
                    >
                      Sign In
                    </button>
                  </span>
                ) : (
                  <span>
                    Don't have an Account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setError(null);
                      }}
                      className="text-white font-semibold underline underline-offset-4 hover:text-zinc-200 cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            RIGHT COLUMN (5 COLS): BRAND SHOWCASE & TESTIMONIAL PANEL
            (Inspired by Reference Image 2 / SoftQA Modern Split-Screen Layout)
        ========================================================================= */}
        <div className="hidden md:flex md:col-span-5 p-8 lg:p-10 flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#0c2e2c] via-[#091f21] to-[#061215] border-l border-white/10">
          {/* Ambient decorative glowing orbs */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Heading */}
          <div className="relative z-10 space-y-4 pt-4">
            <h3 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight drop-shadow-md">
              Revolutionize AI with Smarter Automation
            </h3>
            <p className="text-xs text-zinc-300 font-light leading-relaxed">
              Stateless JWT authentication, Redis sliding-window quotas, and sub-100ms multi-model routing.
            </p>
          </div>

          {/* Testimonial Quote Block (Exact Reference Image 2 Style) */}
          <div className="relative z-10 my-6 space-y-4 p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-xl">
            <Quote className="w-6 h-6 text-emerald-400 opacity-80" />
            <p className="text-xs sm:text-sm text-zinc-200 font-light leading-relaxed italic">
              "Thunder AI has completely transformed our production testing and intelligence stack. It's reliable, efficient, and ensures our latency is always sub-100ms."
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 to-sky-400 p-0.5 shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&fm=webp&q=80"
                  alt="Michael Carter"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Michael Carter</span>
                <span className="text-[10px] text-zinc-400 block font-mono">Staff AI Engineer at DevCore</span>
              </div>
            </div>
          </div>

          {/* Bottom Trust Badges (Exact Reference Image 2 Style) */}
          <div className="relative z-10 pt-4 border-t border-white/10 space-y-2.5">
            <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 font-semibold block">
              JOIN 10K+ BUILDERS & TEAMS
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-zinc-400">
              <span className="hover:text-white transition">Discord</span>
              <span>•</span>
              <span className="hover:text-white transition">Grammarly</span>
              <span>•</span>
              <span className="hover:text-white transition">Square</span>
              <span>•</span>
              <span className="hover:text-white transition">Dropbox</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
