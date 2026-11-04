import React, { useState, useEffect } from 'react';
import {
  Zap,
  Shield,
  Cpu,
  Lock,
  Server,
  Check,
  Terminal,
  Copy,
  ChevronRight,
  ChevronDown,
  Users,
  Building2,
  Bot,
  Laptop,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  isLoggedIn: boolean;
  userName?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onOpenAuth,
  isLoggedIn,
  userName,
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Clerk Hero Tab Switcher: 'user' | 'org' | 'sso' | 'agent'
  const [activeTab, setActiveTab] = useState<'user' | 'org' | 'sso' | 'agent'>('user');

  // Modal Matrix interactive mouse proximity
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  // Live Security Stream Telemetry (Clerk style)
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([
    '[AUTH] 23:45:01 · Google OAuth ID Token verified (sub: 10744745...)',
    '[REDIS] 23:45:04 · sliding_window: 142/10,000 tokens (ttl: 17980s)',
    '[ROUTER] 23:45:05 · dispatch: openrouter/free (latency: 94ms)',
    '[SESSION] 23:45:09 · 7-day HttpOnly cookie issued (SameSite=None, Secure)',
  ]);

  // Live sparkline simulation for Modal observability card
  const [sparkPoints, setSparkPoints] = useState<number[]>([32, 45, 58, 48, 62, 75, 68, 85, 78, 92, 88, 96]);

  // Real-time telemetry generator
  useEffect(() => {
    const interval = setInterval(() => {
      const sampleEvents = [
        '[REDIS] sliding_window: user capacity replenished',
        '[ROUTER] openrouter/free: 98ms first-byte stream latency',
        '[AUTH] Google One-Tap handshake validated successfully',
        '[MEMORY] semantic context condensator: 88% token reduction',
        '[BLOCKLIST] stateless revocation audit: 0 revoked tokens active',
      ];
      const randomEvent = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
      const timeStr = new Date().toTimeString().split(' ')[0];
      setTelemetryLogs((prev) => [`[SEC] ${timeStr} · ${randomEvent}`, prev[0], prev[1], prev[2]]);

      // Update sparkline waveform
      setSparkPoints((prev) => {
        const nextVal = Math.floor(40 + Math.random() * 55);
        return [...prev.slice(1), nextVal];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Card mouse spotlight position tracking
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-white font-inter relative overflow-x-hidden selection:bg-white selection:text-black">
      {/* =========================================================================
          HERO SECTION: MAJESTIC SCENIC MOUNTAIN BACKDROP & FLOATING CAPSULE NAVBAR
          (Inspired by Reference Image / macOS Sonoma Shotbase Aesthetic)
      ========================================================================= */}
      <section className="relative w-full overflow-hidden">
        {/* Background Alpine Twilight Image with Soft Bottom Gradient Blend */}
        <div
          className="absolute inset-0 bg-cover bg-center sm:bg-[center_28%] pointer-events-none"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=2560&auto=format&fit=crop&q=90')`,
          }}
        >
          {/* Subtle Contrast Grade & Seamless Bottom Dark Fade */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-[#07080c]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_30%,rgba(0,0,0,0.5)_100%)]" />
        </div>

        {/* -------------------- FLOATING CAPSULE NAVBAR -------------------- */}
        <div className="sticky top-4 sm:top-6 z-50 px-4 max-w-xl mx-auto pt-2">
          <header className="w-full px-4 sm:px-5 py-2.5 rounded-full backdrop-blur-2xl bg-black/75 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.7)] flex items-center justify-between transition-all">
            {/* Logo */}
            <div
              className="flex items-center space-x-2.5 cursor-pointer group"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center transition group-hover:scale-105 shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                <Zap className="w-3.5 h-3.5 fill-black text-black" />
              </div>
              <span className="text-xs font-bold tracking-tight uppercase font-mono text-white">
                Thunder
              </span>
            </div>

            {/* Navigation Dropdowns & Links */}
            <nav className="flex items-center space-x-4 sm:space-x-6 text-xs font-medium text-zinc-300">
              <a
                href="#features"
                className="hover:text-white transition flex items-center space-x-1 cursor-pointer"
              >
                <span>Features</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </a>
              <a href="#models" className="hover:text-white transition">
                Pricing
              </a>
              <a href="#compute" className="hover:text-white transition">
                FAQ
              </a>
            </nav>

            {/* Right Actions: Log In + Vibrant Sky Blue Pill Button */}
            <div className="flex items-center space-x-3">
              {isLoggedIn ? (
                <button
                  onClick={onLaunchApp}
                  className="text-xs font-mono px-3 py-1 rounded-full border border-white/15 bg-white/10 text-zinc-200 font-medium hover:bg-white/20 transition cursor-pointer"
                >
                  {userName || 'User'}
                </button>
              ) : (
                <button
                  onClick={() => onOpenAuth('login')}
                  className="text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  Log in
                </button>
              )}

              <button
                onClick={onLaunchApp}
                className="px-3.5 py-1.5 rounded-full bg-[#0091ff] hover:bg-[#007ee5] text-white text-xs font-semibold flex items-center space-x-1.5 shadow-[0_0_20px_rgba(0,145,255,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Zap className="w-3 h-3 fill-white text-white" />
                <span>Launch</span>
              </button>
            </div>
          </header>
        </div>

        {/* -------------------- HERO TYPOGRAPHY & CALL TO ACTION -------------------- */}
        <div className="relative z-10 pt-16 sm:pt-24 pb-20 sm:pb-28 px-4 sm:px-8 max-w-5xl mx-auto text-center space-y-6">
          {/* Main 2-Line Headline Matching Reference Layout */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.08] drop-shadow-[0_4px_25px_rgba(0,0,0,0.65)]">
            Conversational AI, auth, <br />
            and compute in one place
          </h1>

          {/* Clean Subtitle */}
          <p className="text-sm sm:text-lg font-normal text-white/90 max-w-xl mx-auto leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
            Stateless JWT sessions, Redis sliding-window quotas, and multi-model AI routing designed for modern web apps.
          </p>

          {/* Primary CTA Button & Micro-Guarantee Chip */}
          <div className="pt-2 flex flex-col items-center space-y-3">
            <button
              onClick={onLaunchApp}
              className="px-7 py-3 rounded-full bg-[#0091ff] hover:bg-[#007ee5] text-white text-sm font-semibold flex items-center space-x-2.5 shadow-[0_10px_35px_rgba(0,145,255,0.45)] hover:shadow-[0_14px_45px_rgba(0,145,255,0.65)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white text-white" />
              <span>Try free with Thunder</span>
            </button>
            <div className="flex items-center space-x-2.5 text-xs text-white/80 font-medium drop-shadow-md">
              <span>🎁 Includes 10,000 free tokens</span>
              <span className="text-white/40">·</span>
              <span>💳 No card required</span>
            </div>
          </div>
        </div>
      </section>

      {/* Background Architectural Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* -------------------- SECTION 1: AUTHENTICATION & IDENTITY MESH (CLERK STYLE) -------------------- */}
      <section id="features" className="relative pt-20 sm:pt-28 pb-24 px-4 sm:px-8 border-b border-white/10">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          {/* Copy Prompt Pill */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center space-x-3 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-inner text-xs font-mono text-zinc-300">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-zinc-400 font-semibold">npm i @thunder/core</span>
              </span>
              <button
                onClick={() => handleCopyPrompt('npx thunder-ai init')}
                className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white font-sans text-[11px] font-medium transition flex items-center space-x-1 cursor-pointer"
              >
                {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPrompt ? 'Copied' : 'Copy prompt'}</span>
              </button>
            </div>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            Authentication, roles, <br />
            <span className="bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-transparent">
              and identity mesh built for AI.
            </span>
          </h2>

          <p className="text-sm sm:text-base font-normal text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            More than basic login. The complete conversational AI and identity layer for modern engineering teams.
            Google One-Tap OAuth, Redis sliding-window rate limits, and stateless 7-day JWT sessions.
          </p>

          {/* Segmented Navigation Tabs */}
          <div id="showcase" className="pt-8 flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
            {[
              { id: 'user', label: 'User Authentication', icon: Lock },
              { id: 'org', label: 'Multi-tenancy', icon: Building2 },
              { id: 'sso', label: 'Enterprise SSO', icon: Users },
              { id: 'agent', label: 'Agent Authentication', icon: Bot },
            ].map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center space-x-2 cursor-pointer ${
                    active
                      ? 'bg-white text-black font-semibold shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                      : 'bg-white/[0.04] border border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Live Component Showcase Card */}
          <div className="pt-6 max-w-xl mx-auto">
            <div className="p-7 sm:p-8 rounded-3xl border border-white/10 bg-[#0c0d14] shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-left space-y-6 relative overflow-hidden backdrop-blur-xl">
              {/* TAB 1: User Authentication Card */}
              {activeTab === 'user' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="text-center space-y-1">
                    <h3 className="text-xl font-bold text-white">Create your account</h3>
                    <p className="text-xs text-zinc-400 font-normal">Welcome! Please fill in the details to get started.</p>
                  </div>

                  {/* Google OAuth Button */}
                  <button
                    onClick={() => onOpenAuth('signup')}
                    className="w-full py-2.5 px-4 rounded-xl border border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition flex items-center justify-center space-x-2.5 shadow-sm cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <div className="flex items-center my-3">
                    <div className="flex-1 border-t border-white/10" />
                    <span className="px-3 text-[10px] uppercase tracking-wider text-zinc-500 font-mono">or</span>
                    <div className="flex-1 border-t border-white/10" />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-zinc-300 mb-1 font-medium">
                        <span>Email address</span>
                        <span className="text-zinc-500 text-[10px]">Verified domain</span>
                      </div>
                      <input
                        type="email"
                        readOnly
                        value="kumardalaichandan803@gmail.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/40 text-xs font-mono text-zinc-200 outline-none"
                      />
                    </div>

                    <button
                      onClick={() => onOpenAuth('signup')}
                      className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition shadow-[0_0_15px_rgba(255,255,255,0.2)] cursor-pointer"
                    >
                      Continue with Email
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Multi-tenancy Card */}
              {activeTab === 'org' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-xs font-mono text-zinc-400">ORGANIZATION WORKSPACES</span>
                    <span className="text-[10px] text-emerald-400 font-mono">2 ROLES ACTIVE</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white font-mono">
                          AC
                        </div>
                        <div>
                          <span className="font-semibold text-white block">Acme AI Lab</span>
                          <span className="text-[10px] text-zinc-400">14 Developers · Enterprise Tier</span>
                        </div>
                      </div>
                      <span className="text-zinc-400 font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        Admin
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono">
                          TC
                        </div>
                        <div>
                          <span className="font-semibold text-white block">Thunder Agent Core</span>
                          <span className="text-[10px] text-zinc-400">Automated reasoning worker</span>
                        </div>
                      </div>
                      <span className="text-emerald-400 font-semibold text-[11px]">Active</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Enterprise SSO Card */}
              {activeTab === 'sso' && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-sm font-bold text-white">Select your Identity Provider</h4>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3.5 rounded-xl border border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.05] flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer">
                      <span className="font-bold text-white">Okta Workforce</span>
                      <span className="text-[10px] text-zinc-400">SAML 2.0</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.05] flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer">
                      <span className="font-bold text-white">Microsoft Entra</span>
                      <span className="text-[10px] text-zinc-400">Azure AD OIDC</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.05] flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer">
                      <span className="font-bold text-white">Google Workspace</span>
                      <span className="text-[10px] text-zinc-400">Enterprise Domain</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.05] flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer">
                      <span className="font-bold text-white">Custom SAML</span>
                      <span className="text-[10px] text-zinc-400">Single Sign-On</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Agent Authentication Card */}
              {activeTab === 'agent' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white">Cursor / Coding Agent</span>
                      <span className="text-emerald-400 font-semibold">Granted</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Allows autonomous agents to authenticate with scoped permissions and rate-limited sliding quota.
                    </p>
                  </div>
                  <div className="flex space-x-2 pt-1">
                    <button
                      onClick={onLaunchApp}
                      className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 transition cursor-pointer"
                    >
                      Authorize Agent
                    </button>
                    <button
                      onClick={() => handleCopyPrompt('sk-thunder-agent-v2-live-token')}
                      className="px-3.5 py-2 rounded-xl border border-white/10 text-xs text-zinc-300 hover:bg-white/10 transition cursor-pointer"
                    >
                      Copy Token
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- SECTION 2: COMPUTE CLUSTERS & MATRIX -------------------- */}
      <section
        id="compute"
        className="relative py-28 px-4 sm:px-8 border-b border-white/10 bg-[#090a10]"
      >
        <div className="max-w-7xl mx-auto space-y-24">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-bold">
              [ COMPUTE INFRASTRUCTURE // AGENT RUNTIME ]
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
              Computers for AI agents. <br />
              <span className="text-zinc-400 font-light">Sub-second orchestration at scale.</span>
            </h2>
            <p className="text-sm sm:text-base font-light text-zinc-400 leading-relaxed">
              From long-running reasoning rollouts to interactive coding agents, Thunder AI is built to provide stateless
              inference with sub-110ms cold boot and zero prompt window overflow.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Specs List */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-white font-bold text-sm">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Built for scale</span>
                </div>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Create thousands of inference queries in under a second with high-concurrency OpenRouter stream multiplexing.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-white font-bold text-sm">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span>Active-resource pricing</span>
                </div>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Redis sliding-window algorithms reserve token capacity for your baseline and gracefully rate-limit unauthorized bursts.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-white font-bold text-sm">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>Consistently fast</span>
                </div>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Sub-110ms first-byte stream delivery on open-weights checkpoints without waiting for heavy cold starts.
                </p>
              </div>

              <button
                onClick={onLaunchApp}
                className="mt-4 px-5 py-2.5 rounded-full bg-white text-black font-mono text-xs font-bold hover:bg-zinc-200 transition cursor-pointer flex items-center space-x-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                <span>TEST AGENT WORKSPACE</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right: Interactive Matrix Grid with Direct Cursor Tracking */}
            <div className="lg:col-span-7">
              <div className="relative p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#0d0e14] shadow-2xl overflow-hidden select-none">
                <div className="flex items-center justify-between text-xs font-mono pb-4 border-b border-white/10 text-zinc-400">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white font-semibold">128 ACTIVE COMPUTE CLUSTERS</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">MOVE MOUSE OVER CELLS</span>
                </div>

                <div
                  onMouseLeave={() => setHoveredCell(null)}
                  className="py-6 grid grid-cols-16 gap-1.5 sm:gap-2"
                >
                  {Array.from({ length: 128 }).map((_, idx) => {
                    const col = idx % 16;
                    const row = Math.floor(idx / 16);
                    const hoveredCol = hoveredCell !== null ? hoveredCell % 16 : -999;
                    const hoveredRow = hoveredCell !== null ? Math.floor(hoveredCell / 16) : -999;
                    const gridDist = Math.hypot(col - hoveredCol, row - hoveredRow);
                    const isDirect = gridDist === 0;
                    const isNear = gridDist <= 1.5;
                    const isMid = gridDist <= 2.6;

                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredCell(idx)}
                        className={`aspect-square rounded-sm transition-all duration-75 cursor-pointer ${
                          isDirect
                            ? 'bg-white scale-125 z-20 shadow-[0_0_18px_#ffffff]'
                            : isNear
                            ? 'bg-purple-400/90 scale-110 shadow-[0_0_10px_rgba(192,132,252,0.6)]'
                            : isMid
                            ? 'bg-purple-600/40 scale-105'
                            : idx % 11 === 0
                            ? 'bg-emerald-500/35'
                            : 'bg-white/[0.06] hover:bg-white/40'
                        }`}
                      />
                    );
                  })}
                </div>

                <div className="p-3 rounded-xl border border-white/10 bg-black/80 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-zinc-400">dispatch:</span>
                    <span className="text-white font-semibold">
                      {hoveredCell !== null ? `node_${hoveredCell + 1}.openrouter` : 'openrouter.stream()'}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">READY</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- SECTION 3: ARCHITECTURE & SECURITY BENTO GRID -------------------- */}
      <section id="architecture" className="relative py-28 px-4 sm:px-8 border-b border-white/10 bg-[#090a10]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-bold">
              [ INFRASTRUCTURE SPECIFICATIONS ]
            </span>
            <h3 className="text-2xl sm:text-4xl font-bold text-white">
              Enterprise security & session governance.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Card 1: Connected Provider Hub */}
            <div
              onMouseMove={handleCardMouseMove}
              className="spotlight-card md:col-span-7 p-7 rounded-3xl border border-white/10 bg-[#0c0d14] flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">01 // IDENTITY HUB</span>
                <h4 className="text-xl font-bold text-white">Social Sign-On & Provider Mesh</h4>
                <p className="text-xs text-zinc-400 font-light leading-relaxed max-w-md">
                  Seamlessly link Google OAuth, GitHub credentials, and database records into one unified JWT session
                  with stateless revocation.
                </p>
              </div>

              {/* Animated Connected Nodes */}
              <div className="my-8 py-6 px-4 sm:px-6 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between relative overflow-hidden">
                {/* Node 1: Google OAuth */}
                <div className="flex flex-col items-center space-y-1.5 z-10 shrink-0 w-20">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">Google OAuth</span>
                </div>

                <div className="flex-1 h-0.5 mx-2 sm:mx-4 relative min-w-[20px] max-w-[90px] overflow-hidden bg-white/10 rounded-full">
                  <div className="w-full h-full border-t border-dashed border-white/30" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-beam-slide" />
                </div>

                {/* Node 2: Central Thunder Core */}
                <div className="flex flex-col items-center space-y-1.5 z-10 shrink-0 w-24">
                  <div className="w-13 h-13 rounded-2xl bg-white text-black flex items-center justify-center font-bold shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                    <Zap className="w-6 h-6 fill-black text-black" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-white">Thunder Core</span>
                </div>

                <div className="flex-1 h-0.5 mx-2 sm:mx-4 relative min-w-[20px] max-w-[90px] overflow-hidden bg-white/10 rounded-full">
                  <div className="w-full h-full border-t border-dashed border-white/30" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-beam-slide" />
                </div>

                {/* Node 3: Redis Cache */}
                <div className="flex flex-col items-center space-y-1.5 z-10 shrink-0 w-20">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center text-white">
                    <Server className="w-5 h-5 text-zinc-300" />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">Redis Cache</span>
                </div>
              </div>

              <div className="pt-2 text-xs font-mono text-zinc-500 border-t border-white/10 flex justify-between">
                <span>STATELESS 7-DAY JWT</span>
                <span className="text-white font-semibold">SAME-SITE COOKIES</span>
              </div>
            </div>

            {/* Card 2: Live Security Feed */}
            <div
              onMouseMove={handleCardMouseMove}
              className="spotlight-card md:col-span-5 p-7 rounded-3xl border border-white/10 bg-[#0c0d14] flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">02 // AUDIT FEED</span>
                <h4 className="text-xl font-bold text-white">Live Security Telemetry</h4>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Real-time event stream logging token verification, sliding-window checks, and blocklist queries.
                </p>
              </div>

              <div className="my-6 p-4 rounded-2xl bg-black/70 border border-white/10 space-y-2 text-[11px] font-mono">
                <div className="flex items-center justify-between text-zinc-500 pb-1 border-b border-white/10">
                  <span>SECURITY TAPE</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                {telemetryLogs.map((log, i) => (
                  <div key={i} className="truncate text-zinc-300">
                    {log}
                  </div>
                ))}
              </div>

              <div className="pt-2 text-xs font-mono text-zinc-500 border-t border-white/10 flex justify-between">
                <span>RATE LIMIT: 60 REQ/MIN</span>
                <span className="text-emerald-400 font-semibold">STREAM ACTIVE</span>
              </div>
            </div>

            {/* Card 3: Session & Device Management */}
            <div
              onMouseMove={handleCardMouseMove}
              className="spotlight-card md:col-span-6 p-7 rounded-3xl border border-white/10 bg-[#0c0d14] flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">03 // DEVICE GOVERNANCE</span>
                <h4 className="text-xl font-bold text-white">Active Session Telemetry</h4>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Track authenticated browsers, IP locations, and invalidate active sessions instantly via Redis key blocklists.
                </p>
              </div>

              <div className="my-6 p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-white">Linux Workstation · Current Session</h5>
                      <p className="text-[10px] text-zinc-400">Chrome Browser · 192.168.1.6</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 text-[10px] font-bold">
                    ACTIVE
                  </span>
                </div>
              </div>

              <div className="pt-2 text-xs font-mono text-zinc-500 border-t border-white/10 flex justify-between">
                <span>EXPIRATION: 7 DAYS</span>
                <span className="text-white font-semibold">INSTANT REVOCATION</span>
              </div>
            </div>

            {/* Card 4: Modal Observability & Live GPU/Token Sparkline */}
            <div
              onMouseMove={handleCardMouseMove}
              className="spotlight-card md:col-span-6 p-7 rounded-3xl border border-white/10 bg-[#0c0d14] flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">04 // OBSERVABILITY</span>
                <h4 className="text-xl font-bold text-white">Live Stream Throughput</h4>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Streaming rate tracking with real-time sliding-window replenishment and token consumption rates.
                </p>
              </div>

              <div className="my-6 p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Throughput Waveform</span>
                  <span className="text-emerald-400 font-bold">48 tokens/sec</span>
                </div>
                <div className="h-16 flex items-end space-x-1.5 pt-2">
                  {sparkPoints.map((val, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-white/20 hover:bg-white rounded-t transition-all duration-300"
                      style={{ height: `${val}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 text-xs font-mono text-zinc-500 border-t border-white/10 flex justify-between">
                <span>MEDIAN LATENCY: 104MS</span>
                <span className="text-white font-semibold">SLIDING TOKENS: 10,000</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- SECTION 4: CUSTOMER FEEDBACK & USE CASES (IMAGE 3 STAGGERED LAYOUT) -------------------- */}
      <section id="testimonials" className="relative py-28 px-4 sm:px-8 border-b border-white/10 bg-[#07080c]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-bold">
              [ PRODUCTION WORKLOADS // CUSTOMER FEEDBACK ]
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
              Built for teams who ship fast.
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 font-light">
              See how modern teams and industry leaders leverage Thunder AI to automate intelligence and run high-concurrency workflows.
            </p>
          </div>

          <div className="space-y-8">
            {/* Row 1: 01 Left, 02 Right */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Item 01 */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#0e0f16] hover:border-white/20 transition-all duration-300 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-6 group">
                <div className="w-full sm:w-44 h-36 rounded-2xl overflow-hidden shrink-0 relative bg-black/60 border border-white/10">
                  <img
                    src="https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80"
                    alt="Beauty & Aesthetics"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
                <div className="flex-1 space-y-2">
                  <span className="text-xs font-mono text-zinc-500 font-semibold block">01</span>
                  <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-zinc-200 transition">
                    Beauty & Aesthetics
                  </h4>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Books the next visit, answers mid-service, and texts the regulars who go quiet.
                  </p>
                  <div className="pt-2 text-[11px] text-zinc-500 font-mono flex flex-wrap gap-x-2 gap-y-1">
                    <span>Hair and nail salons</span>
                    <span>• Barbers</span>
                    <span>• Med spas</span>
                    <span>• Skin clinics</span>
                  </div>
                </div>
              </div>

              {/* Item 02 */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#0e0f16] hover:border-white/20 transition-all duration-300 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-6 group">
                <div className="w-full sm:w-44 h-36 rounded-2xl overflow-hidden shrink-0 relative bg-black/60 border border-white/10">
                  <img
                    src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&auto=format&fit=crop&q=80"
                    alt="Real estate"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
                <div className="flex-1 space-y-2">
                  <span className="text-xs font-mono text-zinc-500 font-semibold block">02</span>
                  <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-zinc-200 transition">
                    Real estate
                  </h4>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Answers mid-showing, books the tour, and keeps every lead warm until closing.
                  </p>
                  <div className="pt-2 text-[11px] text-zinc-500 font-mono flex flex-wrap gap-x-2 gap-y-1">
                    <span>Agents</span>
                    <span>• Brokerages</span>
                    <span>• Property management</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: 03 Centered in layout */}
            <div className="max-w-2xl mx-auto w-full">
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#0e0f16] hover:border-white/20 transition-all duration-300 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-6 group">
                <div className="w-full sm:w-44 h-36 rounded-2xl overflow-hidden shrink-0 relative bg-black/60 border border-white/10">
                  <img
                    src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80"
                    alt="Home services"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
                <div className="flex-1 space-y-2">
                  <span className="text-xs font-mono text-zinc-500 font-semibold block">03</span>
                  <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-zinc-200 transition">
                    Home services
                  </h4>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Never misses a call, sorts emergencies from estimates, and keeps quotes moving.
                  </p>
                  <div className="pt-2 text-[11px] text-zinc-500 font-mono flex flex-wrap gap-x-2 gap-y-1">
                    <span>Plumbing</span>
                    <span>• HVAC</span>
                    <span>• Electrical</span>
                    <span>• Roofing</span>
                    <span>• Landscaping</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: 04 Left, 05 Right */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Item 04 */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#0e0f16] hover:border-white/20 transition-all duration-300 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-6 group">
                <div className="w-full sm:w-44 h-36 rounded-2xl overflow-hidden shrink-0 relative bg-black/60 border border-white/10">
                  <img
                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80"
                    alt="Professional services"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
                <div className="flex-1 space-y-2">
                  <span className="text-xs font-mono text-zinc-500 font-semibold block">04</span>
                  <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-zinc-200 transition">
                    Professional services
                  </h4>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Screens mid-meeting, routes what's urgent to you, and captures the rest with context.
                  </p>
                  <div className="pt-2 text-[11px] text-zinc-500 font-mono flex flex-wrap gap-x-2 gap-y-1">
                    <span>Insurance</span>
                    <span>• Security</span>
                    <span>• Legal</span>
                    <span>• Accounting</span>
                  </div>
                </div>
              </div>

              {/* Item 05 */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#0e0f16] hover:border-white/20 transition-all duration-300 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-6 group">
                <div className="w-full sm:w-44 h-36 rounded-2xl overflow-hidden shrink-0 relative bg-black/60 border border-white/10">
                  <img
                    src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80"
                    alt="Automotive"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
                <div className="flex-1 space-y-2">
                  <span className="text-xs font-mono text-zinc-500 font-semibold block">05</span>
                  <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-zinc-200 transition">
                    Automotive
                  </h4>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Answers the second a lead lands, qualifies the buyer, and follows up to the sale.
                  </p>
                  <div className="pt-2 text-[11px] text-zinc-500 font-mono flex flex-wrap gap-x-2 gap-y-1">
                    <span>Auto brokers</span>
                    <span>• Dealerships</span>
                    <span>• Service and repair</span>
                    <span>• Detailing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- SECTION 5: SUPPORTED AI CHECKPOINTS -------------------- */}
      <section id="models" className="relative py-28 px-4 sm:px-8 border-b border-white/10 bg-[#090a10]">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-bold">
                [ MODEL ECOSYSTEM ]
              </span>
              <h3 className="text-3xl sm:text-4xl font-bold text-white">Supported AI Checkpoints</h3>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>OPENROUTER GATEWAY ACTIVE</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: 'OpenRouter Free Tier',
                tag: 'Default Core',
                status: 'OPERATIONAL',
                latency: '95ms',
                desc: 'Instant open-weights routing. Zero-cost daily coding and reasoning.',
              },
              {
                name: 'Gemini 2.0 Flash',
                tag: 'Google DeepMind',
                status: 'COMING SOON',
                latency: '78ms',
                desc: 'High-speed multimodal intelligence core with million-token ingestion.',
              },
              {
                name: 'Claude 3.5 Sonnet',
                tag: 'Anthropic',
                status: 'COMING SOON',
                latency: '160ms',
                desc: 'Software architecture and reasoning titan for complex codebases.',
              },
              {
                name: 'DeepSeek R1',
                tag: 'DeepSeek AI',
                status: 'COMING SOON',
                latency: '210ms',
                desc: 'Recursive chain-of-thought mathematical reasoning Titan.',
              },
            ].map((m, idx) => (
              <div
                key={idx}
                onMouseMove={handleCardMouseMove}
                className="spotlight-card p-6 rounded-3xl border border-white/10 bg-[#0c0d14] flex flex-col justify-between hover:border-white/20 transition cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-zinc-500 uppercase">{m.tag}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold ${
                        m.status === 'OPERATIONAL'
                          ? 'bg-emerald-400/20 text-emerald-400'
                          : 'bg-white/10 text-zinc-400'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white">{m.name}</h4>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">{m.desc}</p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/10 flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-500">LATENCY:</span>
                  <span className="text-white font-semibold">{m.latency}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-10 sm:p-16 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent text-center space-y-6 max-w-3xl mx-auto shadow-2xl">
            <h3 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Step into the Thunder workspace.
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-lg mx-auto leading-relaxed">
              Experience conversational intelligence with real-time sliding-window rate limiting,
              automatic context summarization, and Google OAuth.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={onLaunchApp}
                className="px-8 py-3.5 rounded-full bg-white text-black font-mono text-xs font-bold hover:bg-zinc-200 transition shadow-[0_0_25px_rgba(255,255,255,0.3)] cursor-pointer"
              >
                ENTER THUNDER WORKSPACE
              </button>
              {!isLoggedIn && (
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="px-7 py-3.5 rounded-full border border-white/20 text-white font-mono text-xs hover:border-white/40 transition cursor-pointer"
                >
                  CREATE ACCOUNT
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- MINIMAL STATEMENT FOOTER ("THUNDER") -------------------- */}
      <footer className="bg-[#050608] text-zinc-500 pt-16 sm:pt-24 pb-12 px-6 sm:px-12 border-t border-white/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* MASSIVE STATEMENT LOGO: ONLY "THUNDER" (Zero Clipping, 100% Edge-to-Edge Responsive) */}
          <div className="w-full select-none overflow-hidden py-6 sm:py-10 flex items-center justify-center">
            <svg
              viewBox="0 0 1000 160"
              className="w-full h-auto max-h-[220px]"
              preserveAspectRatio="xMidYMid meet"
            >
              <text
                x="50%"
                y="50%"
                dominantBaseline="central"
                textAnchor="middle"
                fontSize="165"
                fontWeight="900"
                letterSpacing="-0.04em"
                fill="#ffffff"
                className="font-inter uppercase select-none"
              >
                THUNDER
              </text>
            </svg>
            <h1 className="sr-only">THUNDER</h1>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
            <div>
              <span>© 2026 Thunder AI. All rights reserved.</span>
            </div>

            <div className="flex items-center space-x-6">
              <a href="#features" className="hover:text-white transition">Features</a>
              <a href="#compute" className="hover:text-white transition">Compute Grid</a>
              <a href="#architecture" className="hover:text-white transition">Architecture</a>
              <a href="#testimonials" className="hover:text-white transition">Feedback</a>
              <a href="#models" className="hover:text-white transition">Pricing</a>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Back to top ↑
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
