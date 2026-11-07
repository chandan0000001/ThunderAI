import React from 'react';
import { Zap, Activity } from 'lucide-react';

interface RouteLoadingScreenProps {
  message?: string;
  subtext?: string;
}

export const RouteLoadingScreen: React.FC<RouteLoadingScreenProps> = ({
  message = 'INITIALIZING WORKSPACE...',
  subtext = 'VERIFYING ROUTE TELEMETRY & EDGE CLUSTERS',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen w-screen flex-col items-center justify-center bg-[#07080c] text-white px-4 select-none relative overflow-hidden"
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,145,255,0.06)_0%,transparent_65%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      {/* Main Loading Card */}
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full p-8 rounded-3xl bg-[#0c0d14]/80 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl space-y-5 text-center">
        {/* Pulsing Lightning Logo */}
        <div className="relative">
          <div className="absolute -inset-3 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0091ff] to-cyan-400 p-[1.5px] shadow-[0_0_25px_rgba(0,145,255,0.5)]">
            <div className="w-full h-full bg-[#090a0f] rounded-2xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-[#0091ff] animate-pulse" />
            </div>
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-1.5 w-full">
          <div className="font-mono text-xs font-bold tracking-widest uppercase text-white">
            {message}
          </div>
          <p className="font-mono text-[10px] text-zinc-400 tracking-wide uppercase">
            {subtext}
          </p>
        </div>

        {/* Smooth Shimmer Loading Bar */}
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
          <div className="h-full bg-gradient-to-r from-transparent via-[#0091ff] to-transparent w-1/2 rounded-full animate-[shimmer_1.4s_infinite] [animation-direction:alternate]" />
        </div>

        {/* Diagnostic Telemetry Status */}
        <div className="flex items-center justify-between w-full pt-1 border-t border-white/5 font-mono text-[9px] text-zinc-400 uppercase">
          <span className="flex items-center space-x-1">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>NODE_LATENCY: 0.12ms</span>
          </span>
          <span className="text-zinc-400">STATUS: 200 OK</span>
        </div>
      </div>
    </div>
  );
};

export default RouteLoadingScreen;
