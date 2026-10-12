import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { LandingPage } from './components/landing/LandingPage';
import { ThunderApp } from './components/thunder/ThunderApp';
import { AuthModal } from './components/auth/AuthModal';
import { api } from './services/api';
import type { User } from './types';

interface ProtectedChatViewProps {
  currentUser: User | null;
  sessionChecking: boolean;
  onLogout: () => Promise<void>;
  onBackToLanding: () => void;
  onDeleteAccount: () => Promise<void>;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onUpdateUser: (u: User) => void;
  initialProfileOpen?: boolean;
}

const ProtectedChatView: React.FC<ProtectedChatViewProps> = ({
  currentUser,
  sessionChecking,
  onLogout,
  onBackToLanding,
  onDeleteAccount,
  isDarkMode,
  onToggleTheme,
  onUpdateUser,
  initialProfileOpen = false,
}) => {
  if (sessionChecking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center font-mono text-xs text-yellow-500 bg-[#090a0f]">
        VERIFYING SESSION TELEMETRY...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <ThunderApp
      currentUser={currentUser}
      onLogout={onLogout}
      onBackToLanding={onBackToLanding}
      onDeleteAccount={onDeleteAccount}
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      onUpdateUser={onUpdateUser}
      initialProfileOpen={initialProfileOpen}
    />
  );
};

export function App() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [sessionChecking, setSessionChecking] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('thunder_theme');
    return saved !== null ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('thunder_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

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

  // Auto-display Login / Signup modal after 13 seconds of landing on the page
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentUser((user) => {
        if (!user) {
          setAuthModalOpen(true);
        }
        return user;
      });
    }, 13000);

    return () => clearTimeout(timer);
  }, []);

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
    const user: User = {
      name: userData.name || 'User',
      email: userData.email,
      age: userData.age,
      usage: userData.usage || {
        tokenUsed: 0,
        tokenLimit: 10000,
        totalTokenUsed: 0,
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
    try {
      await api.auth.deleteAccount();
      setCurrentUser(null);
      localStorage.removeItem('thunder_cached_user');
      navigate('/');
    } catch (err: any) {
      throw err;
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('thunder_cached_user', JSON.stringify(updatedUser));
  };

  return (
    <div
      className={`min-h-screen antialiased transition-colors duration-300 ${
        isDarkMode ? 'bg-[#090a0f] text-[#f4f4f5]' : 'bg-[#f8f9fa] text-[#0f172a]'
      }`}
    >
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
              isDarkMode={isDarkMode}
              onToggleTheme={toggleTheme}
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
              isDarkMode={isDarkMode}
              onToggleTheme={toggleTheme}
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
              isDarkMode={isDarkMode}
              onToggleTheme={toggleTheme}
              onUpdateUser={handleUpdateUser}
              initialProfileOpen={true}
            />
          }
        />

        {/* Fallback to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Auth Modal for Sign in / Sign up */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;
