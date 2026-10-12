import React, { useState } from 'react';
import { ThreeCanvas } from './ThreeCanvas';
import {
  ArrowRight,
  Volume2,
  VolumeX,
  ChevronRight,
  Zap,
  Sun,
  Moon,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  isLoggedIn: boolean;
  userName?: string;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onOpenAuth,
  isLoggedIn,
  userName,
  isDarkMode = true,
  onToggleTheme,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeModel, setActiveModel] = useState<number>(0);

  const models = [
    {
      id: 'openrouter/free',
      name: 'OpenRouter Free Tier',
      tag: 'Default Engine',
      status: 'ACTIVE',
      latency: '110ms',
      context: '32k tokens',
      desc: 'Active zero-cost routing core connected to open weights. Optimized for high-throughput daily coding, context synthesis, and real-time reasoning.',
      isAvailable: true,
    },
    {
      id: 'google/gemini-2.0-flash-exp:free',
      name: 'Gemini 2.0 Flash',
      tag: 'Google DeepMind',
      status: 'COMING SOON',
      latency: '80ms',
      context: '1,000k tokens',
      desc: 'High-speed multimodal intelligence core. Upcoming integration with massive context window handling and instant multimodal comprehension.',
      isAvailable: false,
    },
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      tag: 'Anthropic',
      status: 'COMING SOON',
      latency: '180ms',
      context: '200k tokens',
      desc: 'State-of-the-art software architecture and coding reasoning titan. Slated for upcoming release with advanced code review pipelines.',
      isAvailable: false,
    },
    {
      id: 'deepseek/deepseek-r1',
      name: 'DeepSeek R1',
      tag: 'DeepSeek AI',
      status: 'COMING SOON',
      latency: '220ms',
      context: '64k tokens',
      desc: 'Recursive chain-of-thought mathematical reasoning Titan. Integration in development for complex mathematical proofs and logic benchmarks.',
      isAvailable: false,
    },
  ];

  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1040, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch {
      // AudioContext policy
    }
  };

  return (
    <div
      className={`min-h-screen font-inter relative overflow-x-hidden selection:bg-yellow-400 selection:text-black transition-colors duration-300 ${
        isDarkMode
          ? 'bg-[#08090c] text-[#f4f4f5]'
          : 'bg-[#fcfcfd] text-[#09090b]'
      }`}
    >
      {/* -------------------- ARCHITECTURAL HAIRLINE RULERS (Dogstudio signature) -------------------- */}
      <div className="fixed inset-0 pointer-events-none z-30 select-none">
        <div
          className={`absolute top-0 left-0 right-0 h-[1px] ${
            isDarkMode ? 'bg-white/[0.07]' : 'bg-black/[0.07]'
          }`}
        />
        <div
          className={`absolute bottom-0 left-0 right-0 h-[1px] ${
            isDarkMode ? 'bg-white/[0.07]' : 'bg-black/[0.07]'
          }`}
        />

        <div
          className={`max-w-7xl mx-auto h-full border-x relative ${
            isDarkMode ? 'border-white/[0.05]' : 'border-black/[0.05]'
          }`}
        >
          <span
            className={`absolute top-6 left-4 text-[9px] font-mono tracking-widest ${
              isDarkMode ? 'text-zinc-600' : 'text-zinc-400'
            }`}
          >
            + THUNDER.CORE // 400KV
          </span>
          <span
            className={`absolute top-6 right-4 text-[9px] font-mono tracking-widest ${
              isDarkMode ? 'text-zinc-600' : 'text-zinc-400'
            }`}
          >
            SYS.V3.4 // ACTIVE +
          </span>
        </div>
      </div>

      {/* -------------------- STUDIO HEADER -------------------- */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-4 backdrop-blur-md transition-all border-b ${
          isDarkMode
            ? 'bg-[#08090c]/85 border-white/[0.08]'
            : 'bg-[#fcfcfd]/85 border-black/[0.08]'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo with Electric Yellow Thunder Bolt */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                isDarkMode
                  ? 'bg-yellow-400/10 border border-yellow-400/30 group-hover:bg-yellow-400 group-hover:border-yellow-400'
                  : 'bg-yellow-400/20 border border-yellow-500/40 group-hover:bg-yellow-400'
              }`}
            >
              <Zap
                className={`w-4 h-4 transition-colors ${
                  isDarkMode
                    ? 'text-yellow-400 group-hover:text-black'
                    : 'text-yellow-600 group-hover:text-black'
                }`}
              />
            </div>
            <div className="flex flex-col">
              <span
                className={`text-sm font-bold tracking-wider uppercase font-mono ${
                  isDarkMode ? 'text-white' : 'text-zinc-950'
                }`}
              >
                Thunder AI
              </span>
              <span className="text-[9px] font-mono tracking-widest text-yellow-500 font-semibold">
                HIGH VOLTAGE CORE
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav
            className={`hidden lg:flex items-center space-x-9 text-xs font-mono uppercase tracking-[0.2em] ${
              isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
            }`}
          >
            <a
              href="#overview"
              className={`transition ${isDarkMode ? 'hover:text-yellow-400' : 'hover:text-black font-medium'}`}
            >
              Overview
            </a>
            <a
              href="#architecture"
              className={`transition ${isDarkMode ? 'hover:text-yellow-400' : 'hover:text-black font-medium'}`}
            >
              Architecture
            </a>
            <a
              href="#models"
              className={`transition ${isDarkMode ? 'hover:text-yellow-400' : 'hover:text-black font-medium'}`}
            >
              Models
            </a>
            <a
              href="#security"
              className={`transition ${isDarkMode ? 'hover:text-yellow-400' : 'hover:text-black font-medium'}`}
            >
              Security
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-3.5">
            {/* Day / Night Theme Toggle */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className={`p-2.5 rounded-full border transition relative ${
                  isDarkMode
                    ? 'border-white/10 hover:border-yellow-400/50 text-yellow-400 hover:text-yellow-300 bg-white/[0.02]'
                    : 'border-black/10 hover:border-yellow-500/50 text-zinc-700 hover:text-black bg-black/[0.02]'
                }`}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Night Mode'}
              >
                {isDarkMode ? (
                  <Sun className="w-3.5 h-3.5 text-yellow-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-zinc-800" />
                )}
              </button>
            )}

            {/* Audio Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                playChime();
              }}
              className={`p-2.5 rounded-full border transition relative ${
                isDarkMode
                  ? 'border-white/10 hover:border-white/30 text-zinc-400 hover:text-white'
                  : 'border-black/10 hover:border-black/30 text-zinc-600 hover:text-black'
              }`}
              title="Toggle audio feedback"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
                </>
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Launch Thunder App Button (High Voltage Yellow + White Style) */}
            <button
              onClick={onLaunchApp}
              className="px-5 py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-mono uppercase tracking-wider font-bold transition-all flex items-center space-x-2 shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_25px_rgba(250,204,21,0.5)] hover:scale-105"
            >
              <Zap className="w-3.5 h-3.5 text-black" />
              <span>LAUNCH THUNDER UI</span>
            </button>

            {/* User status */}
            {isLoggedIn ? (
              <span
                className={`hidden sm:inline text-xs font-mono ${
                  isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
                }`}
              >
                User: <span className={isDarkMode ? 'text-white font-medium' : 'text-black font-semibold'}>{userName}</span>
              </span>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className={`hidden sm:inline text-xs font-mono uppercase tracking-wider transition ${
                  isDarkMode
                    ? 'text-zinc-400 hover:text-yellow-400'
                    : 'text-zinc-600 hover:text-black'
                }`}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* -------------------- HERO SECTION (Dogstudio Editorial Layout + Thunder Yellow & White) -------------------- */}
      <section
        id="overview"
        className="relative min-h-screen pt-36 pb-20 px-6 md:px-12 max-w-7xl mx-auto flex flex-col justify-between z-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[70vh]">
          {/* Left Column: Clean Editorial Headline (Spans 7 cols with ample padding to prevent overlap) */}
          <div className="lg:col-span-7 space-y-8 z-20 pr-2 lg:pr-6">
            {/* High-Voltage Status Pill */}
            <div
              className={`inline-flex items-center space-x-2.5 px-3 py-1.5 rounded-full border text-xs font-mono tracking-widest uppercase ${
                isDarkMode
                  ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-300'
                  : 'bg-yellow-400/20 border-yellow-500/40 text-yellow-800 font-semibold'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span>OPENROUTER // REDIS // THUNDER INTERFACE</span>
            </div>

            {/* Editorial Display Typography */}
            <h1
              className={`text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight leading-[1.05] ${
                isDarkMode ? 'text-white' : 'text-zinc-950'
              }`}
            >
              High-Voltage <br />
              <span className="text-yellow-400 font-light italic">Conversational</span> <br />
              Intelligence.
            </h1>

            <p
              className={`text-base sm:text-lg max-w-lg font-light leading-relaxed ${
                isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              An enterprise conversational AI platform powered by OpenRouter multi-model orchestration,
              Redis sliding-window token governance, and automatic semantic context summarization.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onLaunchApp}
                className="px-8 py-4 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-mono text-xs uppercase tracking-widest font-bold transition-all flex items-center space-x-3 group shadow-[0_0_35px_rgba(250,204,21,0.35)] hover:scale-105"
              >
                <span>ENTER THUNDER WORKSPACE</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#architecture"
                className={`px-7 py-4 rounded-full border font-mono text-xs uppercase tracking-widest transition ${
                  isDarkMode
                    ? 'border-white/20 text-white hover:border-yellow-400 hover:text-yellow-400'
                    : 'border-black/20 text-black hover:border-black hover:bg-black/[0.03]'
                }`}
              >
                VIEW ARCHITECTURE
              </a>
            </div>

            {/* Technical Telemetry Strip */}
            <div
              className={`pt-4 grid grid-cols-3 gap-4 border-t text-[11px] font-mono ${
                isDarkMode
                  ? 'border-white/[0.08] text-zinc-500'
                  : 'border-black/[0.08] text-zinc-500'
              }`}
            >
              <div>
                <span className="block text-yellow-500 font-semibold">110MS</span>
                <span>MEDIAN LATENCY</span>
              </div>
              <div>
                <span className="block text-yellow-500 font-semibold">SLIDING</span>
                <span>TOKEN WINDOW</span>
              </div>
              <div>
                <span className="block text-yellow-500 font-semibold">STATELESS</span>
                <span>JWT REVOCATION</span>
              </div>
            </div>
          </div>

          {/* Right Column: Seamless 3D Thunder Lightning Plasma Core Viewport (Compact 5-col width) */}
          <div className="lg:col-span-5 h-[420px] sm:h-[480px] lg:h-[540px] w-full relative flex items-center justify-center">
            <div className="w-full h-full relative">
              <ThreeCanvas isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>

        {/* Hero Footer Coordinate Meta */}
        <div
          className={`flex items-center justify-between text-[11px] font-mono uppercase tracking-widest pt-8 border-t ${
            isDarkMode
              ? 'border-white/[0.08] text-zinc-500'
              : 'border-black/[0.08] text-zinc-500'
          }`}
        >
          <span>THUNDER AI // CONVERSATIONAL ENGINE</span>
          <div
            className={`hidden sm:flex items-center space-x-2 ${
              isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
            }`}
          >
            <span>SCROLL TO EXPLORE SPECS</span>
            <ChevronRight className="w-3 h-3 rotate-90 text-yellow-400" />
          </div>
          <span>EST. 2026 // OPENROUTER ROUTER</span>
        </div>
      </section>

      {/* -------------------- MARQUEE TICKER (Electric Yellow & White) -------------------- */}
      <div
        className={`w-full py-4 border-y overflow-hidden transition-colors ${
          isDarkMode
            ? 'bg-yellow-400/[0.03] border-white/[0.08]'
            : 'bg-yellow-400/[0.08] border-black/[0.08]'
        }`}
      >
        <div className="animate-marquee whitespace-nowrap text-xs font-mono uppercase tracking-[0.25em]">
          <span className="mx-6 text-yellow-400 font-bold">★ MULTI-MODEL ROUTER</span>
          <span className={`mx-6 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
            // AUTOMATIC CONTEXT SUMMARIZATION
          </span>
          <span className="mx-6 text-yellow-400 font-bold">⚡ REDIS SLIDING WINDOW TOKEN LIMIT</span>
          <span className={`mx-6 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
            // JWT ZERO-RETENTION BLOCKLIST
          </span>
          <span className={`mx-6 font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>
            ★ THUNDER CONVERSATIONAL ARCHITECTURE
          </span>
          <span className="mx-6 text-yellow-400 font-bold">⚡ OPENROUTER FREE TIER OPERATIONAL</span>
          <span className={`mx-6 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
            // ZERO PROMPT OVERFLOW
          </span>
        </div>
      </div>

      {/* -------------------- ARCHITECTURAL CAPABILITIES (Dogstudio Editorial Rows - NO BOXED CARDS!) -------------------- */}
      <section
        id="architecture"
        className={`py-32 px-6 md:px-12 max-w-7xl mx-auto border-t ${
          isDarkMode ? 'border-white/[0.08]' : 'border-black/[0.08]'
        }`}
      >
        <div className="mb-20 space-y-4">
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-yellow-500 font-semibold">
            [ ARCHITECTURE // CORE SYSTEM ]
          </span>
          <h2
            className={`text-4xl sm:text-6xl font-normal tracking-tight leading-tight ${
              isDarkMode ? 'text-white' : 'text-zinc-950'
            }`}
          >
            Engineered for high-voltage throughput <br />
            <span className="text-yellow-400 font-light italic">and zero prompt overflow.</span>
          </h2>
        </div>

        {/* Minimalist Editorial List with Clean Dividing Lines */}
        <div
          className={`divide-y border-y ${
            isDarkMode
              ? 'divide-white/[0.08] border-white/[0.08]'
              : 'divide-black/[0.08] border-black/[0.08]'
          }`}
        >
          {/* 01 */}
          <div
            className={`py-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-baseline group transition px-4 rounded-xl ${
              isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'
            }`}
          >
            <div className="lg:col-span-2 text-xs font-mono text-yellow-500 font-semibold">
              01 // ROUTER
            </div>
            <div
              className={`lg:col-span-4 text-2xl font-medium ${
                isDarkMode ? 'text-white' : 'text-zinc-950'
              }`}
            >
              Multi-Model Orchestration
            </div>
            <div
              className={`lg:col-span-6 text-sm font-light leading-relaxed ${
                isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              Unified gateway built on the OpenRouter SDK. Routes queries with automatic per-user
              token accounting, high-speed streaming, and graceful fallback handling across available model checkpoints.
            </div>
          </div>

          {/* 02 */}
          <div
            className={`py-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-baseline group transition px-4 rounded-xl ${
              isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'
            }`}
          >
            <div className="lg:col-span-2 text-xs font-mono text-yellow-500 font-semibold">
              02 // GOVERNANCE
            </div>
            <div
              className={`lg:col-span-4 text-2xl font-medium ${
                isDarkMode ? 'text-white' : 'text-zinc-950'
              }`}
            >
              Sliding-Window Token Rate Limiter
            </div>
            <div
              className={`lg:col-span-6 text-sm font-light leading-relaxed ${
                isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              Redis-backed sliding-window algorithm that enforces 60-second burst limits and per-user
              token quotas. Protects server infrastructure and eliminates unauthorized API exhaustion
              with automatic key TTL expiration.
            </div>
          </div>

          {/* 03 */}
          <div
            className={`py-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-baseline group transition px-4 rounded-xl ${
              isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'
            }`}
          >
            <div className="lg:col-span-2 text-xs font-mono text-yellow-500 font-semibold">
              03 // MEMORY
            </div>
            <div
              className={`lg:col-span-4 text-2xl font-medium ${
                isDarkMode ? 'text-white' : 'text-zinc-950'
              }`}
            >
              Adaptive Context Summarization
            </div>
            <div
              className={`lg:col-span-6 text-sm font-light leading-relaxed ${
                isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              Asynchronous background worker that continuously condenses previous turns into compact
              semantic memory. Allows endless multi-turn dialogs without ballooning context window token costs.
            </div>
          </div>

          {/* 04 */}
          <div
            className={`py-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-baseline group transition px-4 rounded-xl ${
              isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'
            }`}
          >
            <div className="lg:col-span-2 text-xs font-mono text-yellow-500 font-semibold">
              04 // SECURITY
            </div>
            <div
              className={`lg:col-span-4 text-2xl font-medium ${
                isDarkMode ? 'text-white' : 'text-zinc-950'
              }`}
            >
              Stateless JWT & Instant Revocation
            </div>
            <div
              className={`lg:col-span-6 text-sm font-light leading-relaxed ${
                isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              Bcrypt 12-round password hashing with strict Zod validation. Authentication state is preserved
              in secure HttpOnly cookies, and instant session invalidation is guaranteed via Redis token blocklists.
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- NEURAL MODELS OVERVIEW (1 ACTIVE, OTHERS COMING SOON) -------------------- */}
      <section
        id="models"
        className={`py-28 px-6 md:px-12 max-w-7xl mx-auto border-t ${
          isDarkMode ? 'border-white/[0.08]' : 'border-black/[0.08]'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="space-y-3">
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-yellow-500 font-semibold">
              [ NEURAL MODELS // CATALOG ]
            </span>
            <h2
              className={`text-4xl sm:text-5xl font-normal ${
                isDarkMode ? 'text-white' : 'text-zinc-950'
              }`}
            >
              Supported Engines
            </h2>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-yellow-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>1 OPERATIONAL MODEL // OTHERS COMING SOON</span>
          </div>
        </div>

        {/* Interactive Model Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Model Names List */}
          <div className="lg:col-span-5 space-y-2.5">
            {models.map((m, idx) => {
              const active = activeModel === idx;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveModel(idx);
                    playChime();
                  }}
                  className={`p-5 rounded-xl cursor-pointer transition flex items-center justify-between border ${
                    active
                      ? isDarkMode
                        ? 'bg-yellow-400/10 border-yellow-400/40 text-white'
                        : 'bg-yellow-400/20 border-yellow-500/60 text-zinc-950'
                      : isDarkMode
                      ? 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
                      : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.02]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <h3
                        className={`text-lg font-medium ${
                          active
                            ? isDarkMode
                              ? 'text-white'
                              : 'text-zinc-950 font-semibold'
                            : isDarkMode
                            ? 'text-zinc-300'
                            : 'text-zinc-700'
                        }`}
                      >
                        {m.name}
                      </h3>
                      {m.isAvailable ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-mono font-semibold">
                          COMING SOON
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-zinc-500">{m.tag}</p>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      active ? 'text-yellow-400 translate-x-1' : 'text-zinc-600'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Right Active Model Details */}
          <div
            className={`lg:col-span-7 p-8 md:p-12 rounded-2xl border space-y-8 transition-colors ${
              isDarkMode
                ? 'bg-white/[0.02] border-white/10'
                : 'bg-black/[0.02] border-black/10'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-xs font-mono">
                <span
                  className={`px-3 py-1 rounded-full font-medium ${
                    isDarkMode
                      ? 'bg-white/10 text-white'
                      : 'bg-zinc-200 text-zinc-900'
                  }`}
                >
                  {models[activeModel].tag}
                </span>

                {models[activeModel].isAvailable ? (
                  <span className="text-emerald-400 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                    <span>OPERATIONAL IN BACKEND</span>
                  </span>
                ) : (
                  <span className="text-amber-500 font-bold flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    <span>COMING SOON // IN INTEGRATION</span>
                  </span>
                )}
              </div>

              <h4
                className={`text-3xl sm:text-4xl font-normal ${
                  isDarkMode ? 'text-white' : 'text-zinc-950'
                }`}
              >
                {models[activeModel].name}
              </h4>

              <p
                className={`text-base font-light leading-relaxed ${
                  isDarkMode ? 'text-zinc-300' : 'text-zinc-700'
                }`}
              >
                {models[activeModel].desc}
              </p>
            </div>

            <div
              className={`grid grid-cols-2 gap-6 pt-6 border-t text-xs font-mono ${
                isDarkMode ? 'border-white/10' : 'border-black/10'
              }`}
            >
              <div>
                <span className="text-zinc-500 block mb-1">TYPICAL LATENCY</span>
                <span
                  className={`text-lg font-medium ${
                    isDarkMode ? 'text-white' : 'text-zinc-950'
                  }`}
                >
                  {models[activeModel].latency}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">CONTEXT WINDOW</span>
                <span
                  className={`text-lg font-medium ${
                    isDarkMode ? 'text-white' : 'text-zinc-950'
                  }`}
                >
                  {models[activeModel].context}
                </span>
              </div>
            </div>

            <div className="pt-2">
              {models[activeModel].isAvailable ? (
                <button
                  onClick={onLaunchApp}
                  className="px-6 py-3 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-mono text-xs uppercase tracking-wider font-bold transition flex items-center space-x-2 shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:scale-105"
                >
                  <Zap className="w-3.5 h-3.5 text-black" />
                  <span>TEST IN THUNDER INTERFACE</span>
                </button>
              ) : (
                <div
                  className={`inline-flex items-center space-x-2 px-5 py-3 rounded-full text-xs font-mono ${
                    isDarkMode
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Model pipeline coming soon. OpenRouter Free Tier is active.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- HIGH-VOLTAGE WORKSPACE CTA -------------------- */}
      <section
        className={`py-28 px-6 md:px-12 max-w-7xl mx-auto border-t ${
          isDarkMode ? 'border-white/[0.08]' : 'border-black/[0.08]'
        }`}
      >
        <div
          className={`relative rounded-3xl p-10 sm:p-16 text-center max-w-4xl mx-auto overflow-hidden border ${
            isDarkMode
              ? 'bg-gradient-to-b from-yellow-400/[0.06] to-transparent border-yellow-400/20'
              : 'bg-gradient-to-b from-yellow-400/[0.12] to-transparent border-yellow-500/30'
          }`}
        >
          <div className="relative z-10 space-y-7">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-yellow-400/20 text-yellow-500 text-xs font-mono font-bold">
              <Zap className="w-3 h-3 text-yellow-500" />
              <span>READY TO TRANSMIT</span>
            </div>

            <h3
              className={`text-4xl sm:text-6xl font-normal tracking-tight ${
                isDarkMode ? 'text-white' : 'text-zinc-950'
              }`}
            >
              Step into the Thunder workspace.
            </h3>

            <p
              className={`text-sm sm:text-base font-light leading-relaxed max-w-xl mx-auto ${
                isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              Experience our multi-model intelligence core with Redis sliding-window token metering,
              automatic context summarization, and reactive conversational design.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={onLaunchApp}
                className="px-9 py-4 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-mono text-xs uppercase tracking-widest font-bold transition-all flex items-center space-x-3 shadow-[0_0_30px_rgba(250,204,21,0.4)] hover:scale-105"
              >
                <span>LAUNCH THUNDER UI</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {!isLoggedIn && (
                <button
                  onClick={() => onOpenAuth('signup')}
                  className={`px-8 py-4 rounded-full border font-mono text-xs uppercase tracking-widest transition ${
                    isDarkMode
                      ? 'border-white/20 text-white hover:border-yellow-400 hover:text-yellow-400'
                      : 'border-black/20 text-black hover:border-black'
                  }`}
                >
                  CREATE ACCOUNT
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- CLEAN ARCHITECTURAL FOOTER -------------------- */}
      <footer
        id="security"
        className={`pt-16 pb-12 px-6 md:px-12 border-t ${
          isDarkMode
            ? 'border-white/[0.08] bg-[#06070a]'
            : 'border-black/[0.08] bg-[#f4f4f7]'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-zinc-500 gap-6">
          <div className="flex items-center space-x-3">
            <span className="font-semibold text-yellow-500">© 2026 THUNDER AI</span>
            <span>·</span>
            <span>CONVERSATIONAL INTELLIGENCE PLATFORM</span>
          </div>

          <div className="flex items-center space-x-6">
            <a
              href="#overview"
              className={`transition ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`}
            >
              Overview
            </a>
            <a
              href="#architecture"
              className={`transition ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`}
            >
              Architecture
            </a>
            <a
              href="#models"
              className={`transition ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`}
            >
              Models
            </a>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className={`transition underline-offset-4 hover:underline ${
                isDarkMode ? 'text-white' : 'text-black'
              }`}
            >
              Back to top ↑
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
