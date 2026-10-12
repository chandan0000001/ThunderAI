import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { User, Chat, Message, AvailableModel } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ProfileModal } from '../profile/ProfileModal';
import {
  Menu,
  Plus,
  MessageSquare,
  Trash2,
  Send,
  ChevronDown,
  ArrowLeft,
  Settings,
  Copy,
  Check,
  Search,
  Zap,
  Globe,
  Paperclip,
  ThumbsUp,
  ThumbsDown,
  X,
  AlertTriangle,
  Sun,
  Moon,
  Clock,
  RefreshCw
} from 'lucide-react';

interface ThunderAppProps {
  currentUser: User | null;
  onLogout: () => void;
  onBackToLanding: () => void;
  onDeleteAccount: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onUpdateUser?: (user: User) => void;
  initialProfileOpen?: boolean;
}

const AVAILABLE_MODELS: AvailableModel[] = [
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Tier',
    provider: 'Backend Default',
    description: 'Active zero-cost routing engine connected to open weights.',
    tag: 'ACTIVE',
    badge: 'Operational',
    enabled: true,
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash',
    provider: 'Google DeepMind',
    description: 'High-throughput multimodal intelligence engine.',
    tag: 'COMING SOON',
    badge: 'Coming Soon',
    enabled: false,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Industry benchmark for code architecture and problem solving.',
    tag: 'COMING SOON',
    badge: 'Coming Soon',
    enabled: false,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek AI',
    description: 'Recursive chain-of-thought mathematical reasoning Titan.',
    tag: 'COMING SOON',
    badge: 'Coming Soon',
    enabled: false,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    description: 'Open-weights 70B parameter powerhouse.',
    tag: 'COMING SOON',
    badge: 'Coming Soon',
    enabled: false,
  },
];

const SUGGESTIONS = [
  {
    title: 'Explain Token Rate Limiting',
    prompt: 'Explain how the Redis sliding-window token rate limiter works in this backend architecture.',
    icon: '⚡',
  },
  {
    title: 'Write a Three.js Shader',
    prompt: 'Write a GLSL vertex and fragment shader for an iridescent organic morphing sphere in Three.js.',
    icon: '✨',
  },
  {
    title: 'Compare AI Reasoning Titans',
    prompt: 'Compare the reasoning strengths of DeepSeek R1, Claude 3.5 Sonnet, and Gemini 2.0 Flash.',
    icon: '🧠',
  },
  {
    title: 'Architect a Microservice',
    prompt: 'Design a scalable AI agent workflow with automated context summarization and Redis caching.',
    icon: '🏗️',
  },
];

export const ThunderApp: React.FC<ThunderAppProps> = ({
  currentUser,
  onLogout,
  onBackToLanding,
  onDeleteAccount,
  isDarkMode = true,
  onToggleTheme,
  onUpdateUser,
  initialProfileOpen = false,
}) => {
  const navigate = useNavigate();
  const { chatId: urlChatId } = useParams<{ chatId?: string }>();

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Chats & messages
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(urlChatId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Input & model
  const [inputPrompt, setInputPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('openrouter/free');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Status & notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Live Token Tracking State
  const [tokenStats, setTokenStats] = useState({
    used: currentUser?.usage?.tokenUsed ?? currentUser?.usage?.totalTokenUsed ?? 0,
    limit: currentUser?.usage?.tokenLimit || 10000,
  });
  const [syncingTokens, setSyncingTokens] = useState(false);
  const [lastTokenDelta, setLastTokenDelta] = useState<number | null>(null);

  // Settings / Profile Modal
  const [profileModalOpen, setProfileModalOpen] = useState(initialProfileOpen);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeStreamChatIdRef = useRef<string | null>(null);

  // Keep tokenStats in sync when currentUser updates
  useEffect(() => {
    if (currentUser?.usage) {
      setTokenStats({
        used: currentUser.usage.tokenUsed ?? currentUser.usage.totalTokenUsed ?? 0,
        limit: currentUser.usage.tokenLimit || 10000,
      });
    }
  }, [currentUser]);

  // Keep profile modal in sync if initialProfileOpen changes (e.g. via route /profile)
  useEffect(() => {
    setProfileModalOpen(initialProfileOpen);
  }, [initialProfileOpen]);

  // Synchronize currentChatId whenever urlChatId parameter changes
  useEffect(() => {
    if (urlChatId && urlChatId !== currentChatId) {
      setCurrentChatId(urlChatId);
    } else if (!urlChatId && currentChatId) {
      if (activeStreamChatIdRef.current) return;
      setCurrentChatId(null);
      setMessages([]);
    }
  }, [urlChatId]);

  // Live token sync helper (silently handles rate-limit without UI flicker)
  const refreshLiveTokens = async () => {
    try {
      setSyncingTokens(true);
      const freshUser = await api.auth.getProfile();
      if (freshUser?.usage) {
        setTokenStats({
          used: freshUser.usage.tokenUsed ?? freshUser.usage.totalTokenUsed ?? 0,
          limit: freshUser.usage.tokenLimit || 10000,
        });
        if (onUpdateUser) onUpdateUser(freshUser);
      }
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('login first')) {
        onLogout();
      }
      // Silently log background telemetry failures to avoid disruptive error banners
      console.warn('Background token telemetry:', err?.message);
    } finally {
      setTimeout(() => setSyncingTokens(false), 500);
    }
  };

  // Background token sync every 90 seconds (only when tab is visible)
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshLiveTokens();
    }, 90000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Load chats on mount
  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      setLoadingChats(true);
      const res = await api.chat.getRecent();
      if (res.chats) {
        setChats(res.chats);
      }
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('login first')) {
        onLogout();
        return;
      }
      console.warn('Could not fetch chats:', err.message);
    } finally {
      setLoadingChats(false);
    }
  };

  // Load messages when currentChatId changes
  useEffect(() => {
    if (!currentChatId) {
      setMessages([]);
      return;
    }

    // If this chat ID change was triggered by our active prompt stream, preserve live state!
    if (activeStreamChatIdRef.current === currentChatId) {
      return;
    }

    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await api.message.getMessages(currentChatId);
        if (res.msg) {
          setMessages(res.msg);
        }
      } catch (err: any) {
        if (err.status === 401 || err.message?.includes('login first')) {
          onLogout();
          return;
        }
        // Do NOT clear existing messages or cause screen reset on temporary rate limit or network glitch!
        console.warn('Could not load messages:', err.message);
        if (err.status === 429) {
          setErrorMessage(err.message || 'Rate limit active. Please wait a moment.');
        }
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [currentChatId]);

  // Start new chat (navigates to /chat)
  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setInputPrompt('');
    setErrorMessage(null);
    navigate('/chat');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Delete chat
  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    try {
      await api.chat.deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      if (currentChatId === chatId) {
        handleNewChat();
      }
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('login first')) {
        onLogout();
        return;
      }
      setErrorMessage(err.message || 'Failed to delete chat');
    }
  };

  // Send message with STREAMING output, LIVE token updating & dynamic URL switching
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || sending) return;

    setErrorMessage(null);
    setSending(true);

    // Optimistic user message
    const tempUserMsgId = `temp-${Date.now()}`;
    const tempUserMsg: Message = {
      _id: tempUserMsgId,
      chatId: currentChatId || 'temp',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    // Optimistic assistant message for live stream rendering
    const streamAsstId = `stream-${Date.now()}`;
    const streamAsstMsg: Message = {
      _id: streamAsstId,
      chatId: currentChatId || 'temp',
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg, streamAsstMsg]);
    setStreamingMessageId(streamAsstId);
    setInputPrompt('');
    activeStreamChatIdRef.current = currentChatId || 'pending-new';

    let accumulatedContent = '';

    try {
      // 1. Primary: Real SSE Streaming from backend
      const res = await api.message.streamMessage(
        {
          chatId: currentChatId || undefined,
          content: text,
          model: selectedModel,
        },
        {
          onStart: (startData) => {
            if (!currentChatId && startData.chatId) {
              activeStreamChatIdRef.current = startData.chatId;
              setCurrentChatId(startData.chatId);
              navigate(`/chat/${startData.chatId}`, { replace: true });
              // Optimistically prepend chat to sidebar locally without burning rate limit
              setChats((prev) => [
                {
                  _id: startData.chatId,
                  topic: text.slice(0, 40),
                  updatedAt: new Date().toISOString(),
                },
                ...prev.filter((c) => c._id !== startData.chatId),
              ]);
            }
            if (startData.userMessage) {
              setMessages((prev) =>
                prev.map((m) => (m._id === tempUserMsgId ? startData.userMessage! : m))
              );
            }
          },
          onChunk: (chunk) => {
            accumulatedContent += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m._id === streamAsstId ? { ...m, content: accumulatedContent } : m
              )
            );
            scrollToBottom();
          },
          onDone: (doneData) => {
            if (!currentChatId && doneData.chatId) {
              activeStreamChatIdRef.current = doneData.chatId;
              setCurrentChatId(doneData.chatId);
              navigate(`/chat/${doneData.chatId}`, { replace: true });
            }

            setMessages((prev) =>
              prev.map((m) =>
                m._id === streamAsstId
                  ? doneData.assistantMessage || {
                      ...m,
                      content: doneData.reply,
                      usage: doneData.usage,
                    }
                  : m
              )
            );

            // LIVE TOKEN QUOTA UPDATE
            if (doneData.tokenUsed !== undefined) {
              setTokenStats((prev) => ({
                ...prev,
                used: doneData.tokenUsed,
                limit: doneData.tokenLimit || prev.limit,
              }));

              if (doneData.usage?.totalTokens) {
                setLastTokenDelta(doneData.usage.totalTokens);
                setTimeout(() => setLastTokenDelta(null), 3500);
              }

              if (currentUser && onUpdateUser) {
                onUpdateUser({
                  ...currentUser,
                  usage: {
                    ...currentUser.usage,
                    tokenUsed: doneData.tokenUsed,
                    totalTokenUsed:
                      (currentUser.usage?.totalTokenUsed || 0) +
                      (doneData.usage?.totalTokens || 0),
                    tokenLimit: doneData.tokenLimit || 10000,
                  },
                });
              }
            }
          },
        }
      );

      if (res && res.chatId && !currentChatId) {
        setCurrentChatId(res.chatId);
        navigate(`/chat/${res.chatId}`, { replace: true });
      }
    } catch (streamErr: any) {
      if (
        streamErr.status === 401 ||
        streamErr.message?.includes('login first') ||
        streamErr.message?.includes('login again')
      ) {
        onLogout();
        return;
      }

      // 2. Fallback: If streaming failed before any chunks, attempt standard request with simulated UI stream
      if (!accumulatedContent) {
        try {
          const fallbackRes = await api.message.sendMessage({
            chatId: currentChatId || undefined,
            content: text,
            model: selectedModel,
          });

          if (!currentChatId && fallbackRes.chatId) {
            setCurrentChatId(fallbackRes.chatId);
            navigate(`/chat/${fallbackRes.chatId}`, { replace: true });
            fetchChats();
          }

          // Simulate streaming typing on the UI
          const fullText =
            fallbackRes.reply || fallbackRes.assistantMessage?.content || '';
          let displayed = '';
          const chunkSize = 10;

          for (let i = 0; i < fullText.length; i += chunkSize) {
            displayed += fullText.slice(i, i + chunkSize);
            setMessages((prev) =>
              prev.map((m) =>
                m._id === streamAsstId ? { ...m, content: displayed } : m
              )
            );
            scrollToBottom();
            await new Promise((r) => setTimeout(r, 20));
          }

          setMessages((prev) =>
            prev.map((m) =>
              m._id === streamAsstId
                ? fallbackRes.assistantMessage || {
                    ...m,
                    content: fullText,
                    usage: fallbackRes.usage,
                  }
                : m
            )
          );

          if (fallbackRes.tokenUsed !== undefined) {
            setTokenStats((prev) => ({
              ...prev,
              used: fallbackRes.tokenUsed,
              limit: fallbackRes.tokenLimit || prev.limit,
            }));

            if (fallbackRes.usage?.totalTokens) {
              setLastTokenDelta(fallbackRes.usage.totalTokens);
              setTimeout(() => setLastTokenDelta(null), 3500);
            }

            if (currentUser && onUpdateUser) {
              onUpdateUser({
                ...currentUser,
                usage: {
                  ...currentUser.usage,
                  tokenUsed: fallbackRes.tokenUsed,
                  totalTokenUsed:
                    (currentUser.usage?.totalTokenUsed || 0) +
                    (fallbackRes.usage?.totalTokens || 0),
                  tokenLimit: fallbackRes.tokenLimit || 10000,
                },
              });
            }
          }
        } catch (fallbackErr: any) {
          setErrorMessage(fallbackErr.message || 'Failed to generate response.');
          setMessages((prev) =>
            prev.filter((m) => m._id !== tempUserMsgId && m._id !== streamAsstId)
          );
        }
      } else {
        setErrorMessage('Stream connection was interrupted.');
      }
    } finally {
      setStreamingMessageId(null);
      setSending(false);
      setTimeout(() => {
        activeStreamChatIdRef.current = null;
      }, 1000);
      fetchChats();
    }
  };

  // Handle keypress in textarea (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending) {
        handleSendMessage();
      }
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const filteredChats = chats.filter((c) =>
    (c.topic || 'Untitled Chat').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={`flex h-screen w-screen font-inter overflow-hidden select-none transition-colors duration-200 ${
        isDarkMode ? 'bg-[#131314] text-[#e3e3e3]' : 'bg-[#f8f9fa] text-[#1f1f1f]'
      }`}
    >
      {/* -------------------- THUNDER SIDEBAR -------------------- */}
      <aside
        className={`${
          sidebarOpen ? 'w-72' : 'w-16'
        } transition-all duration-300 flex flex-col justify-between shrink-0 z-20 ${
          isDarkMode
            ? 'bg-[#1e1f20] border-r border-[#2d2e30]'
            : 'bg-[#f0f4f9] border-r border-[#e1e3e1]'
        }`}
      >
        {/* Sidebar Top: Collapse Toggle & New Chat */}
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-full transition ${
                isDarkMode
                  ? 'hover:bg-[#2d2e30] text-[#c4c7c5] hover:text-white'
                  : 'hover:bg-[#e4ebf5] text-[#444746] hover:text-black'
              }`}
              title={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
            >
              <Menu className="w-5 h-5" />
            </button>

            {sidebarOpen && (
              <button
                onClick={() => {
                  onBackToLanding();
                  navigate('/');
                }}
                className={`text-xs font-mono flex items-center space-x-1 px-2 py-1 rounded transition ${
                  isDarkMode
                    ? 'text-zinc-400 hover:text-white hover:bg-[#2d2e30]'
                    : 'text-zinc-600 hover:text-black hover:bg-[#e4ebf5]'
                }`}
                title="Return to 3D Landing Page"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>STUDIO</span>
              </button>
            )}
          </div>

          {/* "+ New chat" Button */}
          <button
            onClick={() => {
              if (sending) return;
              handleNewChat();
            }}
            disabled={sending}
            className={`w-full flex items-center ${
              sidebarOpen ? 'px-4 py-3 space-x-3 justify-start' : 'p-3 justify-center'
            } rounded-full transition shadow-sm group ${
              sending ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              isDarkMode
                ? 'bg-[#131314] hover:bg-[#28292a] text-[#e3e3e3] border border-[#2d2e30]'
                : 'bg-white hover:bg-[#f3f4f6] text-[#1f1f1f] border border-[#d3dbdf]'
            }`}
            title={sending ? 'Waiting for response to complete...' : 'Start new chat'}
          >
            <Plus className="w-4 h-4 text-yellow-500 group-hover:rotate-90 transition-transform" />
            {sidebarOpen && (
              <span className="text-sm font-medium tracking-tight">New chat</span>
            )}
          </button>

          {/* Search chats */}
          {sidebarOpen && chats.length > 0 && (
            <div className="relative mt-2">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none transition ${
                  isDarkMode
                    ? 'bg-[#131314] border-white/5 text-white placeholder-zinc-500 focus:border-yellow-500'
                    : 'bg-white border-zinc-200 text-black placeholder-zinc-400 focus:border-yellow-500'
                }`}
              />
            </div>
          )}
        </div>

        {/* Sidebar Middle: Recent Chats List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {sidebarOpen && (
            <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-[#8e918f]">
              Recent
            </div>
          )}

          {loadingChats ? (
            <div className="px-4 py-6 text-center text-xs text-zinc-500 font-mono">
              Loading conversations...
            </div>
          ) : filteredChats.length === 0 ? (
            sidebarOpen && (
              <div className="px-4 py-6 text-center text-xs text-zinc-500 font-mono">
                {chats.length === 0 ? 'No chats yet. Say hi!' : 'No chats match filter.'}
              </div>
            )
          ) : (
            filteredChats.map((chat) => {
              const isActive = chat._id === currentChatId;
              return (
                <div
                  key={chat._id}
                  onClick={() => {
                    if (sending) return;
                    setCurrentChatId(chat._id);
                    navigate(`/chat/${chat._id}`);
                  }}
                  className={`group relative flex items-center ${
                    sidebarOpen ? 'px-3 py-2.5 justify-between' : 'p-2.5 justify-center'
                  } rounded-full cursor-pointer transition text-sm ${
                    isActive
                      ? isDarkMode
                        ? 'bg-[#004a77]/30 text-[#c2e7ff] font-medium'
                        : 'bg-[#d3e3fd] text-[#041e49] font-medium'
                      : isDarkMode
                      ? 'text-[#c4c7c5] hover:bg-[#28292a] hover:text-white'
                      : 'text-[#444746] hover:bg-[#e4ebf5] hover:text-black'
                  }`}
                  title={chat.topic}
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-yellow-400' : 'text-zinc-500'}`} />
                    {sidebarOpen && (
                      <span className="truncate text-xs tracking-tight">
                        {chat.topic || 'New Chat'}
                      </span>
                    )}
                  </div>

                  {sidebarOpen && (
                    <button
                      onClick={(e) => handleDeleteChat(e, chat._id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-rose-500/20 hover:text-rose-400 text-zinc-500 transition"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Bottom: LIVE Token Meter, Settings, Profile */}
        <div className={`p-3 border-t space-y-2 ${isDarkMode ? 'border-[#2d2e30]' : 'border-[#e1e3e1]'}`}>
          {sidebarOpen && (
            <div className={`p-3 rounded-2xl border space-y-2 text-xs font-mono transition-all ${
              isDarkMode
                ? 'bg-[#131314] border-yellow-400/20 shadow-[0_0_15px_rgba(250,204,21,0.04)]'
                : 'bg-white border-yellow-500/30 shadow-sm'
            }`}>
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1.5 text-zinc-400">
                  <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                  <span className="font-bold tracking-wider">TOKEN QUOTA</span>
                  <button
                    onClick={refreshLiveTokens}
                    disabled={syncingTokens}
                    className="p-0.5 rounded hover:text-yellow-400 text-zinc-500 transition"
                    title="Live sync token quota from backend"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingTokens ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center space-x-1.5">
                  {lastTokenDelta && (
                    <span className="px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-400 font-mono text-[9px] font-bold animate-bounce">
                      +{lastTokenDelta}
                    </span>
                  )}
                  <span className={isDarkMode ? 'text-yellow-400 font-bold' : 'text-yellow-700 font-bold'}>
                    {tokenStats.used.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Live Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-zinc-700/30 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-200 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                  style={{
                    width: `${Math.min(100, (tokenStats.used / (tokenStats.limit || 10000)) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-[9px] text-zinc-500">
                <span>LIMIT: {(tokenStats.limit || 10000).toLocaleString()}</span>
                <span className="text-emerald-400 font-semibold">● LIVE UPDATED</span>
              </div>
            </div>
          )}

          {/* Profile Button in Sidebar (Navigates to /profile) */}
          <div
            onClick={() => {
              setProfileModalOpen(true);
              navigate('/profile');
            }}
            className={`flex items-center ${
              sidebarOpen ? 'px-3 py-2 justify-between' : 'p-2 justify-center'
            } rounded-full cursor-pointer transition ${
              isDarkMode ? 'hover:bg-[#28292a]' : 'hover:bg-[#e4ebf5]'
            }`}
            title="User Profile & Live Telemetry"
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-200 p-[1.5px] shrink-0">
                <div className={`w-full h-full rounded-full flex items-center justify-center font-bold text-xs ${
                  isDarkMode ? 'bg-[#1e1f20] text-white' : 'bg-white text-zinc-900'
                }`}>
                  {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                </div>
              </div>
              {sidebarOpen && (
                <div className="overflow-hidden">
                  <p className={`text-xs font-medium truncate ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>
                    {currentUser?.name || 'Operator'}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate font-mono">
                    {currentUser?.email || 'operator@thunder.ai'}
                  </p>
                </div>
              )}
            </div>

            {sidebarOpen && <Settings className="w-4 h-4 text-zinc-500 hover:text-white" />}
          </div>
        </div>
      </aside>

      {/* -------------------- MAIN THUNDER CHAT AREA -------------------- */}
      <main className={`flex-1 flex flex-col h-full relative overflow-hidden ${
        isDarkMode ? 'bg-[#131314]' : 'bg-[#ffffff]'
      }`}>
        {/* Top Header Bar */}
        <header className={`h-14 px-6 flex items-center justify-between border-b backdrop-blur-md z-10 ${
          isDarkMode
            ? 'border-[#2d2e30]/60 bg-[#131314]/90'
            : 'border-[#e1e3e1] bg-[#ffffff]/90'
        }`}>
          {/* Thunder Title & Model Selector Dropdown */}
          <div className="flex items-center space-x-3 relative">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-200 flex items-center justify-center shadow-md">
                <Zap className="w-3.5 h-3.5 text-black" />
              </div>
              <span className={`font-semibold text-base tracking-tight font-mono uppercase ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>
                Thunder
              </span>
            </div>

            {/* Model Selector Pill */}
            <div className="relative">
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                  isDarkMode
                    ? 'bg-[#1e1f20] hover:bg-[#28292a] border-[#2d2e30] text-[#c4c7c5] hover:text-white'
                    : 'bg-[#f0f4f9] hover:bg-[#e4ebf5] border-[#d3dbdf] text-[#444746] hover:text-black'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium">
                  {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name || 'OpenRouter Free Tier'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </button>

              {/* Model Dropdown Menu */}
              {modelDropdownOpen && (
                <div
                  className={`absolute top-full left-0 mt-2 w-80 rounded-2xl border shadow-2xl p-2 z-50 space-y-1.5 ${
                    isDarkMode
                      ? 'bg-[#1e1f20] border-[#2d2e30]'
                      : 'bg-[#ffffff] border-[#d3dbdf]'
                  }`}
                >
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex justify-between items-center">
                    <span>Neural Router Model</span>
                    <span className="text-emerald-400 font-bold">1 Active</span>
                  </div>
                  {AVAILABLE_MODELS.map((model) => {
                    const isSelected = selectedModel === model.id;
                    const isAvailable = model.enabled !== false;
                    return (
                      <button
                        key={model.id}
                        onClick={() => {
                          if (!isAvailable) {
                            setErrorMessage(
                              `${model.name} is coming soon. OpenRouter Free Tier is currently the only active engine.`
                            );
                            setModelDropdownOpen(false);
                            return;
                          }
                          setSelectedModel(model.id);
                          setModelDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-start justify-between ${
                          isAvailable
                            ? isSelected
                              ? isDarkMode
                                ? 'bg-[#004a77]/40 text-[#c2e7ff] border border-blue-500/30'
                                : 'bg-[#e8f0fe] text-[#1967d2] border border-blue-200'
                              : isDarkMode
                              ? 'hover:bg-[#28292a] text-[#c4c7c5]'
                              : 'hover:bg-[#f0f4f9] text-[#1f1f1f]'
                            : isDarkMode
                            ? 'opacity-40 cursor-not-allowed hover:bg-transparent text-zinc-500'
                            : 'opacity-40 cursor-not-allowed hover:bg-transparent text-zinc-400'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>
                              {model.name}
                            </span>
                            {isAvailable ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[9px] font-mono flex items-center space-x-1">
                                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                                <span>COMING SOON</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-snug">
                            {model.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center space-x-3">
            {/* Day / Night Theme Toggle */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className={`p-2 rounded-full border transition ${
                  isDarkMode
                    ? 'border-white/10 hover:border-white/30 text-yellow-400 hover:text-yellow-300'
                    : 'border-black/10 hover:border-black/20 text-zinc-700 hover:text-black'
                }`}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Night Mode'}
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
              </button>
            )}

            <button
              onClick={() => {
                onBackToLanding();
                navigate('/');
              }}
              className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-mono transition ${
                isDarkMode
                  ? 'border-white/10 hover:border-white/20 text-zinc-300 hover:text-white'
                  : 'border-zinc-300 hover:border-zinc-400 text-zinc-700 hover:text-black'
              }`}
            >
              <span>3D STUDIO</span>
              <ArrowLeft className="w-3 h-3 rotate-180" />
            </button>

            {/* Profile Avatar Button (Navigates to /profile) */}
            <button
              onClick={() => {
                setProfileModalOpen(true);
                navigate('/profile');
              }}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-200 p-[1.5px]"
              title="Profile & Telemetry"
            >
              <div className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold ${
                isDarkMode ? 'bg-[#131314] text-white' : 'bg-white text-black'
              }`}>
                {(currentUser?.name || 'U').charAt(0).toUpperCase()}
              </div>
            </button>
          </div>
        </header>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-200 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* -------------------- CHAT CONTENT (Messages or Empty Thunder State) -------------------- */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {!currentChatId && messages.length === 0 ? (
            /* Thunder Empty State Greeting */
            <div className="max-w-3xl mx-auto h-full flex flex-col justify-center py-12 space-y-10">
              <div className="space-y-3">
                <h1 className="font-syne text-4xl sm:text-6xl font-bold tracking-tight text-yellow-400">
                  Hello, {currentUser?.name?.split(' ')[0] || 'User'}
                </h1>
                <p className={`font-syne text-3xl sm:text-5xl font-light ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  How can Thunder assist you today?
                </p>
              </div>

              {/* Suggestion prompt cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputPrompt(s.prompt);
                      handleSendMessage(s.prompt);
                    }}
                    className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between h-36 group ${
                      isDarkMode
                        ? 'bg-[#1e1f20] hover:bg-[#28292a] border-[#2d2e30]'
                        : 'bg-[#f0f4f9] hover:bg-[#e4ebf5] border-[#d3dbdf]'
                    }`}
                  >
                    <span className={`text-sm font-medium leading-snug ${
                      isDarkMode ? 'text-[#e3e3e3] group-hover:text-white' : 'text-[#1f1f1f] group-hover:text-black'
                    }`}>
                      {s.title}
                    </span>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xl">{s.icon}</span>
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                        isDarkMode
                          ? 'bg-[#131314] text-zinc-400 group-hover:text-black group-hover:bg-yellow-400'
                          : 'bg-white text-zinc-600 group-hover:text-black group-hover:bg-yellow-400 shadow-sm'
                      }`}>
                        <Send className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Message Thread */
            <div className="max-w-3xl mx-auto space-y-6 pb-20">
              {loadingMessages && messages.length === 0 && (
                <div className="text-center py-8 text-xs font-mono text-zinc-500 animate-pulse">
                  Retrieving conversation thread...
                </div>
              )}

              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg._id || index}
                    className={`flex items-start space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-200 p-[1px] shrink-0 mt-1 shadow-md">
                        <div className={`w-full h-full rounded-full flex items-center justify-center ${
                          isDarkMode ? 'bg-[#1e1f20]' : 'bg-white'
                        }`}>
                          <Zap className="w-4 h-4 text-yellow-400" />
                        </div>
                      </div>
                    )}

                    <div
                      className={`relative max-w-[85%] rounded-2xl px-5 py-3.5 ${
                        isUser
                          ? isDarkMode
                            ? 'bg-[#282a2d] text-white rounded-tr-sm border border-white/5'
                            : 'bg-[#e9eef6] text-[#1f1f1f] rounded-tr-sm border border-black/5 shadow-sm'
                          : isDarkMode
                          ? 'bg-transparent text-[#e3e3e3] rounded-tl-sm w-full'
                          : 'bg-transparent text-[#1f1f1f] rounded-tl-sm w-full'
                      }`}
                    >
                      {isUser ? (
                        <div className="text-[15px] leading-relaxed whitespace-pre-wrap font-inter">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {msg._id === streamingMessageId && !msg.content ? (
                            <div className="flex items-center space-x-2 text-xs font-mono text-yellow-500 py-1.5">
                              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                              <span className="animate-pulse">Synthesizing intelligence stream...</span>
                            </div>
                          ) : (
                            <div className="relative">
                              <MarkdownRenderer content={msg.content} />
                              {msg._id === streamingMessageId && (
                                <span className="inline-block w-2.5 h-4 ml-1 bg-yellow-400 animate-pulse align-middle rounded-xs shadow-[0_0_10px_rgba(250,204,21,0.9)]" />
                              )}
                            </div>
                          )}

                          {/* Message telemetry & actions (displayed when streaming concludes) */}
                          {msg._id !== streamingMessageId && (
                            <div className="flex items-center space-x-3 pt-2 text-[11px] font-mono text-zinc-500">
                              {msg.usage && (
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  isDarkMode ? 'bg-white/[0.04] text-zinc-400' : 'bg-black/[0.04] text-zinc-600'
                                }`}>
                                  Tokens: {msg.usage.totalTokens} (P: {msg.usage.promptTokens} · C:{' '}
                                  {msg.usage.completionTokens})
                                </span>
                              )}

                              <button
                                onClick={() => copyToClipboard(msg.content, msg._id)}
                                className={`p-1 rounded transition flex items-center space-x-1 ${
                                  isDarkMode ? 'hover:text-white hover:bg-white/5' : 'hover:text-black hover:bg-black/5'
                                }`}
                                title="Copy response"
                              >
                                {copiedMsgId === msg._id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                className={`p-1 rounded transition ${
                                  isDarkMode ? 'hover:text-white hover:bg-white/5' : 'hover:text-black hover:bg-black/5'
                                }`}
                                title="Good response"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className={`p-1 rounded transition ${
                                  isDarkMode ? 'hover:text-white hover:bg-white/5' : 'hover:text-black hover:bg-black/5'
                                }`}
                                title="Bad response"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 text-xs font-semibold ${
                        isDarkMode ? 'bg-[#2d2e30] text-white' : 'bg-zinc-300 text-zinc-800'
                      }`}>
                        {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* -------------------- FLOATING THUNDER BOTTOM PROMPT BAR -------------------- */}
        <div className="p-4 md:pb-6 max-w-3xl w-full mx-auto relative z-20">
          <div className={`rounded-3xl border shadow-xl transition-all p-3 space-y-2 ${
            isDarkMode
              ? 'bg-[#1e1f20] border-[#2d2e30] focus-within:border-yellow-500/50 focus-within:bg-[#28292a]'
              : 'bg-[#f0f4f9] border-[#d3dbdf] focus-within:border-yellow-500 focus-within:bg-white'
          }`}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder={
                sending
                  ? 'Thunder is synthesizing response...'
                  : 'Ask Thunder anything, analyze backend models, or write code...'
              }
              className={`w-full bg-transparent text-sm focus:outline-none resize-none px-2 max-h-36 overflow-y-auto leading-relaxed transition-opacity ${
                sending ? 'cursor-not-allowed opacity-50' : ''
              } ${
                isDarkMode
                  ? 'text-[#e3e3e3] placeholder-[#8e918f]'
                  : 'text-[#1f1f1f] placeholder-[#5f6368]'
              }`}
              style={{ minHeight: '44px' }}
            />

            <div className={`flex items-center justify-between pt-1 px-1 border-t ${
              isDarkMode ? 'border-white/[0.04]' : 'border-black/[0.04]'
            }`}>
              {/* Left action accessories */}
              <div className="flex items-center space-x-1.5 text-zinc-400">
                <button
                  type="button"
                  title="Upload attachment"
                  disabled={sending}
                  className={`p-2 rounded-full transition ${
                    sending ? 'opacity-40 cursor-not-allowed' : ''
                  } ${
                    isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-black/10 hover:text-black'
                  }`}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Web Search"
                  disabled={sending}
                  className={`p-2 rounded-full transition ${
                    sending ? 'opacity-40 cursor-not-allowed' : ''
                  } ${
                    isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-black/10 hover:text-black'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono text-zinc-500 pl-1">
                  Model: {selectedModel.split('/')[1] || selectedModel}
                </span>
              </div>

              {/* Right Send Action */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputPrompt.trim() || sending}
                className={`p-2.5 rounded-full transition-all flex items-center justify-center ${
                  inputPrompt.trim() && !sending
                    ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 text-black font-bold shadow-md shadow-yellow-500/30 hover:scale-105'
                    : isDarkMode
                    ? 'bg-[#2d2e30] text-zinc-600 cursor-not-allowed'
                    : 'bg-[#e1e3e1] text-zinc-400 cursor-not-allowed'
                }`}
                title={sending ? 'Synthesizing response...' : 'Send prompt'}
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-center text-[#8e918f] mt-2 font-mono">
            Thunder AI may display inaccurate info, including about people, so double-check its responses.
          </p>
        </div>
      </main>

      {/* -------------------- REVAMPED USER SETTINGS / PROFILE MODAL -------------------- */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => {
          setProfileModalOpen(false);
          navigate(currentChatId ? `/chat/${currentChatId}` : '/chat');
        }}
        currentUser={currentUser}
        onLogout={onLogout}
        onDeleteAccount={onDeleteAccount}
        isDarkMode={isDarkMode}
        onUserUpdated={onUpdateUser}
      />
    </div>
  );
};
