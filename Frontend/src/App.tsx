import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { LandingPage } from './components/landing/LandingPage';
import { RouteLoadingScreen } from './components/common/RouteLoadingScreen';
import { NotFoundPage } from './components/common/NotFoundPage';
import { api } from './services/api';
import type { User } from './types';

const ThunderApp = lazy(() =>
  import('./components/thunder/ThunderApp').then((m) => ({ default: m.ThunderApp }))
);
const AuthModal = lazy(() =>
  import('./components/auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const ResetPasswordPage = lazy(() =>
  import('./components/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const PrivacyPolicyPage = lazy(() =>
  import('./components/legal/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage }))
);

interface ProtectedChatViewProps {
  currentUser: User | null;
  sessionChecking: boolean;
  onLogout: () => Promise<void>;
  onBackToLanding: () => void;
  onDeleteAccount: () => Promise<void>;
  onUpdateUser: (u: User) => void;
  initialProfileOpen?: boolean;
}

const ProtectedChatView: React.FC<ProtectedChatViewProps> = ({
  currentUser,
  sessionChecking,
  onLogout,
  onBackToLanding,
  onDeleteAccount,
  onUpdateUser,
  initialProfileOpen = false,
}) => {
  if (sessionChecking) {
    return (
      <RouteLoadingScreen
        message="VERIFYING SESSION TELEMETRY..."
        subtext="AUTHENTICATING CRYPTOGRAPHIC JWT TOKENS"
      />
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense
      fallback={
        <RouteLoadingScreen
          message="INITIALIZING WORKSPACE..."
          subtext="SYNCHRONIZING MODEL MESH & CHAT SESSIONS"
        />
      }
    >
      <ThunderApp
        currentUser={currentUser}
        onLogout={onLogout}
        onBackToLanding={onBackToLanding}
        onDeleteAccount={onDeleteAccount}
        onUpdateUser={onUpdateUser}
        initialProfileOpen={initialProfileOpen}
      />
    </Suspense>
  );
};

export function App() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [sessionChecking, setSessionChecking] = useState(true);
  useEffect(() => {
    localStorage.setItem('thunder_theme', 'dark');
    document.documentElement.classList.add('dark');
  }, []);

  // Check existing session strictly with backend on mount
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const user = await api.auth.getProfile();
        if (user && user.email) {
          setCurrentUser(user);
          localStorage.setItem('thunder_cached_user', JSON.stringify(user));
        } else {
          throw new Error('Unauthenticated session');
        }
      } catch {
        // Token is expired, invalid, or absent.
        // DO NOT restore stale cached user! Clear session completely.
        setCurrentUser(null);
        localStorage.removeItem('thunder_cached_user');
      } finally {
        setSessionChecking(false);
      }
    };

    checkUserSession();
  }, []);

  // Listen for global auth-expired event from API interceptor
  useEffect(() => {
    const handleAuthExpired = () => {
      if (currentUser) {
        setCurrentUser(null);
        localStorage.removeItem('thunder_cached_user');
        navigate('/');
        setAuthInitialMode('login');
        setAuthModalOpen(true);
      }
    };

    window.addEventListener('thunder:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('thunder:auth-expired', handleAuthExpired);
  }, [currentUser, navigate]);

  const handleLaunchApp = () => {
    if (currentUser) {
      navigate('/chat');
    } else {
      setAuthInitialMode('login');
      setAuthModalOpen(true);
    }
  };

  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
  };

  const handleAuthSuccess = (userData: any) => {
    const isAdmin = userData.role === 'admin' || userData.isUnlimited || userData.usage?.isUnlimited;
    const user: User = {
      _id: userData._id,
      name: userData.name || 'User',
      email: userData.email,
      age: userData.age,
      avatar: userData.avatar,
      role: userData.role || (isAdmin ? 'admin' : 'user'),
      isUnlimited: isAdmin,
      usage: userData.usage || {
        tokenUsed: 0,
        tokenLimit: isAdmin ? -1 : 10000,
        totalTokenUsed: 0,
        isUnlimited: isAdmin,
      },
    };
    setCurrentUser(user);
    localStorage.setItem('thunder_cached_user', JSON.stringify(user));
    setAuthModalOpen(false);
    navigate('/chat');
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    setCurrentUser(null);
    localStorage.removeItem('thunder_cached_user');
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    if (currentUser?.role === 'admin' || currentUser?.isUnlimited) {
      console.warn('Blocked: Administrator accounts are protected and cannot be deleted.');
      return;
    }
    await api.auth.deleteAccount();
    setCurrentUser(null);
    localStorage.removeItem('thunder_cached_user');
    navigate('/');
  };

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('thunder_cached_user', JSON.stringify(updatedUser));
  };

  return (
    <div className="min-h-screen antialiased bg-[#090a0f] text-[#f4f4f5]">
      <Routes>
        {/* Landing Page Route */}
        <Route
          path="/"
          element={
            <LandingPage
              onLaunchApp={handleLaunchApp}
              onOpenAuth={handleOpenAuth}
              isLoggedIn={!!currentUser}
              userName={currentUser?.name}
            />
          }
        />

        {/* Unified Chat Route: Handles /chat and /chat/:chatId seamlessly without unmounting */}
        <Route
          path="/chat/:chatId?"
          element={
            <ProtectedChatView
              currentUser={currentUser}
              sessionChecking={sessionChecking}
              onLogout={handleLogout}
              onBackToLanding={() => navigate('/')}
              onDeleteAccount={handleDeleteAccount}
              onUpdateUser={handleUpdateUser}
              initialProfileOpen={false}
            />
          }
        />

        {/* Profile Section Route */}
        <Route
          path="/profile"
          element={
            <ProtectedChatView
              currentUser={currentUser}
              sessionChecking={sessionChecking}
              onLogout={handleLogout}
              onBackToLanding={() => navigate('/')}
              onDeleteAccount={handleDeleteAccount}
              onUpdateUser={handleUpdateUser}
              initialProfileOpen={true}
            />
          }
        />

        {/* Reset Password Route */}
        <Route
          path="/reset-password"
          element={
            <Suspense
              fallback={
                <RouteLoadingScreen
                  message="LOADING SECURITY CONSOLE..."
                  subtext="VERIFYING RECOVERY TOKEN PROTOCOL"
                />
              }
            >
              <ResetPasswordPage
                onPasswordResetSuccess={() => {
                  setAuthInitialMode('login');
                  setAuthModalOpen(true);
                  navigate('/');
                }}
              />
            </Suspense>
          }
        />

        {/* Privacy Policy Route */}
        <Route
          path="/privacy"
          element={
            <Suspense
              fallback={
                <RouteLoadingScreen
                  message="LOADING PRIVACY POLICY..."
                  subtext="FETCHING DATA PROTECTION PROTOCOLS"
                />
              }
            >
              <PrivacyPolicyPage />
            </Suspense>
          }
        />

        {/* Custom 404 Route for Unmatched Paths */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Auth Modal for Sign in / Sign up - lazy loaded on demand */}
      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={authModalOpen}
            initialMode={authInitialMode}
            onClose={() => setAuthModalOpen(false)}
            onSuccess={handleAuthSuccess}
          />
        </Suspense>
      )}

      {/* Privacy-Preserving Web Analytics */}
      <Analytics />
      <SpeedInsights />
    </div>
  );
}

export default App;
