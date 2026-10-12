import React, { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  MessageSquare,
  Zap,
  KeyRound,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
  userEmail?: string;
  userName?: string;
  isDarkMode?: boolean;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  userEmail,
  userName,
  isDarkMode = true,
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmed = confirmInput.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await onConfirmDelete();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleModalClose = () => {
    if (isDeleting) return;
    setConfirmInput('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={handleModalClose}
      />

      {/* Main Modal Card */}
      <div
        className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 z-10 animate-in zoom-in-95 duration-200 ${
          isDarkMode
            ? 'bg-[#0f1015] border-rose-500/30 text-white shadow-[0_0_50px_rgba(244,63,94,0.2)]'
            : 'bg-white border-rose-200 text-zinc-900 shadow-[0_10px_35px_rgba(244,63,94,0.15)]'
        }`}
      >
        {/* Top Warning Accent Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

        {/* Modal Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>Permanent Action</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white font-syne">
                  Delete Account
                </h3>
              </div>
            </div>

            <button
              onClick={handleModalClose}
              disabled={isDeleting}
              className={`p-1.5 rounded-lg transition ${
                isDarkMode
                  ? 'hover:bg-white/10 text-zinc-400 hover:text-white'
                  : 'hover:bg-black/10 text-zinc-600 hover:text-black'
              }`}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
            Are you sure you want to delete your account? All your chats, prompt history, and account data will be permanently erased.
          </p>

          {/* Account Target Tag */}
          <div className={`mt-3 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-mono border ${
            isDarkMode ? 'bg-white/[0.03] border-white/10 text-zinc-300' : 'bg-zinc-50 border-zinc-200 text-zinc-700'
          }`}>
            <span className="text-zinc-500">Target Account:</span>
            <span className="font-semibold text-rose-300">
              {userEmail || userName || 'Current Account'}
            </span>
          </div>
        </div>

        {/* What Will Be Deleted */}
        <div className="px-6 py-2">
          <div className={`rounded-xl p-3.5 border space-y-2.5 ${
            isDarkMode ? 'bg-[#15161f] border-white/5' : 'bg-zinc-50 border-zinc-200'
          }`}>
            <div className="text-xs font-medium text-zinc-300">
              What will be permanently deleted:
            </div>

            <div className="space-y-2">
              <div className="flex items-start space-x-2.5 text-xs text-zinc-300">
                <MessageSquare className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Conversation History:</strong> All chats and generated messages stored in the database.
                </span>
              </div>

              <div className="flex items-start space-x-2.5 text-xs text-zinc-300">
                <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Token Quota & Telemetry:</strong> Redis usage records and token quotas.
                </span>
              </div>

              <div className="flex items-start space-x-2.5 text-xs text-zinc-300">
                <KeyRound className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Login & Session:</strong> All authentication sessions and credentials.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Confirmation Input Section */}
        <div className="p-6 pt-3 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Please type <span className="font-bold text-rose-400 tracking-wider">DELETE</span> to confirm:
            </label>
            <div className="relative">
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Type DELETE"
                disabled={isDeleting}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono tracking-wider transition outline-none ${
                  isDarkMode
                    ? 'bg-[#181924] border-rose-500/30 text-white placeholder-zinc-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                    : 'bg-zinc-50 border-rose-300 text-black placeholder-zinc-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                }`}
                autoFocus
              />
              {isConfirmed && (
                <div className="absolute right-3 top-2.5 text-emerald-400 flex items-center space-x-1 text-xs font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Confirmed</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={handleModalClose}
              disabled={isDeleting}
              className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-semibold tracking-wide transition ${
                isDarkMode
                  ? 'border-white/10 hover:border-white/20 text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10'
                  : 'border-zinc-300 hover:border-zinc-400 text-zinc-700 hover:text-black bg-zinc-100 hover:bg-zinc-200'
              }`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={!isConfirmed || isDeleting}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center space-x-2 transition ${
                isConfirmed && !isDeleting
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] cursor-pointer'
                  : 'bg-rose-950/30 border border-rose-900/30 text-rose-400/40 cursor-not-allowed opacity-60'
              }`}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting account...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete My Account</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
