import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Home, MessageSquare, Shield, ArrowLeft, Terminal } from 'lucide-react';
import { usePageSEO } from '../../utils/seo';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  usePageSEO({
    title: '404 // Route Disconnected',
    description: 'The requested route does not exist on the Thunder AI compute matrix.',
  });

  return (
    <div className="min-h-screen bg-[#07080c] text-white font-inter flex flex-col justify-between relative overflow-hidden selection:bg-white selection:text-black">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,145,255,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div
          onClick={() => navigate('/')}
          className="flex items-center space-x-2.5 cursor-pointer group"
          role="button"
          tabIndex={0}
          aria-label="Thunder AI home"
        >
          <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center transition group-hover:scale-105 shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            <Zap className="w-4 h-4 fill-black text-black" />
          </div>
          <span className="text-sm font-bold tracking-tight uppercase font-mono text-white">
            Thunder
          </span>
        </div>

        <button
          onClick={() => navigate('/')}
          className="text-xs font-mono text-zinc-400 hover:text-white transition flex items-center space-x-1.5 cursor-pointer px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 bg-white/5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return Home</span>
        </button>
      </header>

      {/* Main 404 Hero */}
      <main className="max-w-2xl mx-auto px-6 py-12 text-center my-auto z-10 space-y-6">
        {/* Terminal Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>STATUS 404 · ROUTE DISCONNECTED</span>
        </div>

        {/* Big Glitch 404 Typography */}
        <div className="relative py-2 select-none">
          <h1 className="text-7xl sm:text-9xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-300 to-zinc-600 drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <span className="text-8xl sm:text-[10rem] font-mono font-black text-blue-500 blur-xl">
              404
            </span>
          </div>
        </div>

        {/* Explanatory Message */}
        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-semibold text-white">
            Coordinate not found in compute matrix
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
            The neural route you requested is unavailable, expired, or has been relocated to an alternate partition.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#0091ff] hover:bg-[#007ee5] text-white text-xs font-semibold flex items-center justify-center space-x-2 shadow-[0_0_25px_rgba(0,145,255,0.4)] hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Headquarters</span>
          </button>

          <button
            onClick={() => navigate('/chat')}
            className="w-full sm:w-auto px-6 py-3 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center space-x-2 hover:border-white/30 transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open Chat Workspace</span>
          </button>
        </div>

        {/* System Telemetry Console Box */}
        <div className="mt-8 p-3 rounded-xl bg-black/60 border border-white/10 text-left font-mono text-[11px] text-zinc-400 max-w-md mx-auto space-y-1">
          <div className="flex items-center space-x-1.5 text-zinc-500 pb-1 border-b border-white/5">
            <Terminal className="w-3 h-3" />
            <span className="text-[10px] uppercase">Telemetry Diagnostics</span>
          </div>
          <div className="text-zinc-400">
            <span className="text-red-400">ERR_HTTP_404</span>: Path verification failed
          </div>
          <div className="text-zinc-500 text-[10px]">
            cluster_id: vercel_edge_iad1 · gateway_latency: 0.18ms
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-zinc-500 z-10">
        <div>© 2026 Thunder AI · Zero Data Retention</div>
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/privacy')} className="hover:text-zinc-300 transition cursor-pointer flex items-center space-x-1">
            <Shield className="w-3 h-3" />
            <span>Privacy Policy</span>
          </button>
          <a href="/#features" className="hover:text-zinc-300 transition">Features</a>
          <a href="/sitemap.xml" className="hover:text-zinc-300 transition">Sitemap</a>
        </div>
      </footer>
    </div>
  );
};
