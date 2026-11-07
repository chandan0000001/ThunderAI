import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import confetti from 'canvas-confetti';
import {
  Zap,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { usePageSEO } from '../../utils/seo';

interface ResetPasswordPageProps {
  onPasswordResetSuccess?: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  onPasswordResetSuccess,
}) => {
  usePageSEO({
    title: 'Reset Password // Security Console',
    description: 'Cryptographically authenticate and securely reset your Thunder AI user password.',
    canonical: '/reset-password',
  });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password rules validation
  const hasMinLen = password.length >= 8 && password.length <= 30;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSpecial = /[~!@#$%^&*():]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLen && hasUpper && hasLower && hasNum && hasSpecial && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing reset token. Please request a new password reset link.');
      return;
    }

    if (!isFormValid) {
      setError('Please satisfy all password complexity and matching requirements.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.auth.resetPassword({
        token,
        newPassword: password,
      });

      setSuccess(true);
      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 },
      });

      setTimeout(() => {
        if (onPasswordResetSuccess) {
          onPasswordResetSuccess();
        } else {
          navigate('/');
        }
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#090a0f] text-white flex items-center justify-center p-4 sm:p-6 font-inter relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl bg-[#0c0d14] border border-white/15 p-6 sm:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.9)] z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              <Zap className="w-4 h-4 fill-black text-black" />
            </div>
            <span className="font-mono text-sm font-bold tracking-tight uppercase text-white">
              Thunder AI
            </span>
          </div>

          <button
            onClick={() => navigate('/')}
            className="text-xs font-mono text-zinc-400 hover:text-white transition flex items-center space-x-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>
        </div>

        {/* No Token Provided State */}
        {!token ? (
          <div className="space-y-4 py-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Invalid Reset Link</h2>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              This link is invalid or incomplete. Please request a new password reset link from the Sign In screen.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs transition hover:bg-zinc-200 cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        ) : success ? (
          /* Success Confirmation State */
          <div className="space-y-4 py-8 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-bounce">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight">Password Reset Complete!</h2>
              <p className="text-xs font-mono text-zinc-400">
                Your password has been successfully updated. Redirecting to sign in...
              </p>
            </div>
            <div className="w-36 h-1 bg-white/10 rounded-full overflow-hidden mx-auto mt-4">
              <div className="h-full bg-emerald-400 rounded-full animate-pulse" style={{ width: '100%' }} />
            </div>
          </div>
        ) : (
          /* Password Reset Form */
          <div className="space-y-5 animate-fadeIn">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-mono font-bold mb-1">
                <KeyRound className="w-3 h-3" />
                <span>SECURE CREDENTIAL ROTATION</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                Create New Password
              </h2>
              {emailParam && (
                <p className="text-xs text-zinc-400 font-mono truncate">
                  Account: <span className="text-yellow-400">{emailParam}</span>
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-white focus:outline-none text-xs text-white placeholder-zinc-500 transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-white focus:outline-none text-xs text-white placeholder-zinc-500 transition font-mono"
                  />
                </div>
              </div>

              {/* Validation Checklist */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5 text-[10px] font-mono">
                <div className="grid grid-cols-2 gap-1">
                  <div className={`flex items-center space-x-1.5 ${hasMinLen ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <Check className={`w-3 h-3 ${hasMinLen ? 'opacity-100' : 'opacity-30'}`} />
                    <span>8-30 characters</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${hasUpper ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <Check className={`w-3 h-3 ${hasUpper ? 'opacity-100' : 'opacity-30'}`} />
                    <span>1 uppercase letter</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${hasLower ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <Check className={`w-3 h-3 ${hasLower ? 'opacity-100' : 'opacity-30'}`} />
                    <span>1 lowercase letter</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${hasNum ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <Check className={`w-3 h-3 ${hasNum ? 'opacity-100' : 'opacity-30'}`} />
                    <span>1 number</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${hasSpecial ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <Check className={`w-3 h-3 ${hasSpecial ? 'opacity-100' : 'opacity-30'}`} />
                    <span>1 special character</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${passwordsMatch ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <Check className={`w-3 h-3 ${passwordsMatch ? 'opacity-100' : 'opacity-30'}`} />
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="w-full py-3 rounded-xl bg-[#0091ff] hover:bg-[#007ee5] text-white text-xs font-semibold tracking-wide shadow-[0_10px_25px_rgba(0,145,255,0.4)] disabled:opacity-40 transition-all flex items-center justify-center space-x-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <span>Updating Password...</span>
                ) : (
                  <>
                    <span>RESET & UPDATE PASSWORD</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
