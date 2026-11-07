import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  ArrowLeft,
  Shield,
  Lock,
  Database,
  KeyRound,
  Trash2,
  CheckCircle2,
  FileText,
  Clock,
} from 'lucide-react';
import { usePageSEO } from '../../utils/seo';

export const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();

  usePageSEO({
    title: 'Privacy Policy // Security & Data Governance',
    description:
      'Thunder AI privacy policy: Stateless JWT tokens, Redis sliding-window ephemeral quotas, AES-256 client encryption, and zero persistent training retention.',
    canonical: '/privacy',
  });

  const sections = [
    { id: 'executive-summary', title: '1. Executive Privacy Principles' },
    { id: 'data-collection', title: '2. Information We Collect' },
    { id: 'session-architecture', title: '3. Stateless Session & JWT Architecture' },
    { id: 'redis-sliding-window', title: '4. Redis Sliding-Window Rate Limiting' },
    { id: 'byok-encryption', title: '5. Bring-Your-Own-Key (BYOK) Governance' },
    { id: 'zero-retention', title: '6. Zero LLM Training & Model Retention' },
    { id: 'data-deletion', title: '7. Right to Erasure & Account Deletion' },
    { id: 'analytics-telemetry', title: '8. Privacy-Preserving Analytics' },
    { id: 'third-party-providers', title: '9. Model Provider Protocols' },
    { id: 'contact', title: '10. Security Inquiries & Contact' },
  ];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-[#eaeaea] font-inter selection:bg-white selection:text-black relative overflow-x-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,145,255,0.07)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_20%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Floating Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#07080c]/85 border-b border-white/10 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center space-x-2.5 cursor-pointer group"
            role="button"
            tabIndex={0}
            aria-label="Return to Thunder AI Home"
          >
            <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center transition group-hover:scale-105 shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              <Zap className="w-4 h-4 fill-black text-black" />
            </div>
            <span className="text-sm font-bold tracking-tight uppercase font-mono text-white">
              Thunder
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SECURITY CERTIFIED // v2.4</span>
            </div>

            <button
              onClick={() => navigate('/')}
              className="text-xs font-mono text-zinc-300 hover:text-white transition flex items-center space-x-1.5 cursor-pointer px-3.5 py-1.5 rounded-full border border-white/10 hover:border-white/20 bg-white/5 active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8 text-center sm:text-left relative z-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono mb-4">
          <Shield className="w-3.5 h-3.5" />
          <span>DATA PROTECTION & PLATFORM GOVERNANCE</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
          Privacy Policy & Security Matrix
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl font-light leading-relaxed">
          Thunder AI is engineered from first principles with zero-retention defaults, stateless cryptographic authentication, and ephemeral Redis rate-limiting governance.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-4 text-xs font-mono text-zinc-500">
          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Effective Date: November 7, 2026</span>
          </span>
          <span>•</span>
          <span>Version 2.4 (Production Release)</span>
          <span>•</span>
          <span>Jurisdiction: Global Edge (Vercel / Render)</span>
        </div>
      </div>

      {/* 4 Feature Pillar Badges */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#0c0d14] border border-white/10 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase font-mono">Zero Model Training</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Your conversations and prompts are never used to train public machine learning or foundation models.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0c0d14] border border-white/10 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Lock className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase font-mono">Stateless JWT Auth</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Cryptographically signed tokens with strict 7-day TTL and HttpOnly/SameSite=None protection.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0c0d14] border border-white/10 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Database className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase font-mono">Ephemeral Redis Quotas</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Sliding-window counters in Redis sorted sets expire automatically via 61s self-destruct TTL.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0c0d14] border border-white/10 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase font-mono">Client-Owned BYOK</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Custom model API keys remain client-side encrypted and are never stored in server databases.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Layout with Sidebar Nav */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sticky Desktop Table of Contents */}
        <aside className="lg:col-span-4 hidden lg:block">
          <div className="sticky top-24 p-5 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-white/10 text-xs font-bold font-mono text-zinc-300 uppercase">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Table of Contents</span>
            </div>
            <nav className="space-y-1 text-xs">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => scrollTo(sec.id)}
                  className="w-full text-left py-1.5 px-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition flex items-center justify-between group cursor-pointer"
                >
                  <span className="truncate">{sec.title}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-blue-400 transition font-mono text-[10px]">
                    #
                  </span>
                </button>
              ))}
            </nav>
            <div className="pt-3 border-t border-white/10 text-[11px] text-zinc-500 font-mono">
              Thunder AI Platform // Zero Trace
            </div>
          </div>
        </aside>

        {/* Detailed Sections */}
        <div className="lg:col-span-8 space-y-10 text-zinc-300 leading-relaxed text-sm">
          {/* Section 1 */}
          <section id="executive-summary" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">1.</span>
              <span>Executive Privacy Principles</span>
            </h2>
            <p className="text-zinc-400 leading-relaxed text-xs sm:text-sm">
              Thunder AI (<a href="https://thunder-ai-mu.vercel.app" className="text-blue-400 hover:underline">thunder-ai-mu.vercel.app</a>) operates as a high-performance conversational intelligence and AI model orchestration gateway. We believe modern developer platforms must treat user privacy, token governance, and telemetry as cryptographic guarantees rather than marketing promises.
            </p>
            <p className="text-zinc-400 leading-relaxed text-xs sm:text-sm">
              Our core tenet is <strong className="text-white">minimal data persistence</strong>: we do not sell your personal identifiers, we do not monetize your chat prompts, and we do not permit foundation model vendors to ingest your queries into training datasets.
            </p>
          </section>

          {/* Section 2 */}
          <section id="data-collection" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">2.</span>
              <span>Information We Collect</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              We collect only the minimum telemetry strictly necessary to deliver AI inference and maintain token integrity:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-zinc-400 list-disc list-inside">
              <li>
                <strong className="text-zinc-200">Account Credentials:</strong> If you register via email, your email and cryptographically hashed passwords (using salted bcrypt hashes) are stored in our encrypted MongoDB cluster. Plaintext passwords are never visible or retrievable.
              </li>
              <li>
                <strong className="text-zinc-200">OAuth Identifiers:</strong> If you authenticate via Google One-Tap or Google OAuth 2.0, we verify the signed Google ID Token on the backend and persist only your public name, email address, and avatar URI. We never request Google Drive, contacts, or mailbox permissions.
              </li>
              <li>
                <strong className="text-zinc-200">Chat History:</strong> Message logs and conversation titles you create are stored in your private user database so you can retrieve your previous sessions. You can delete individual conversations or your entire workspace at any time.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="session-architecture" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">3.</span>
              <span>Stateless Session & JWT Architecture</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              Thunder AI uses stateless JSON Web Tokens (JWT) signed with high-entropy cryptographic secrets.
            </p>
            <div className="p-4 rounded-2xl bg-black/50 border border-white/5 font-mono text-xs space-y-1.5 text-zinc-400">
              <div className="text-blue-400">// Token Security Parameters</div>
              <div>• Lifecycle: 7 Days (604,800 seconds)</div>
              <div>• Transport: HttpOnly, Secure, SameSite=None</div>
              <div>• Verification: RS256/HS256 cryptographic signature</div>
              <div>• Revocation: Memory-efficient blocklist checks on logout</div>
            </div>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              Because tokens are stateless, no backend session state tracks your minute-to-minute presence, preventing persistent user correlation across external networks.
            </p>
          </section>

          {/* Section 4 */}
          <section id="redis-sliding-window" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">4.</span>
              <span>Redis Sliding-Window Rate Limiting</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              To defend our infrastructure against automated DDoS attacks and enforce the complimentary 10,000 token tier equitably, we utilize an in-memory Redis sorted set (ZSET) sliding-window algorithm.
            </p>
            <div className="p-4 rounded-2xl bg-black/50 border border-white/5 font-mono text-xs space-y-1.5 text-zinc-400">
              <div className="text-emerald-400">// In-Memory Redis Sliding Window Logic</div>
              <div>1. ZREMRANGEBYSCORE key 0 (now - 60000)</div>
              <div>2. ZCARD key to evaluate requests in last 60 seconds</div>
              <div>3. ZADD key now request_uuid</div>
              <div>4. EXPIRE key 61 (automatic self-destruct TTL)</div>
            </div>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              No prompt contents, conversational texts, or IP addresses are permanently persisted inside rate limiting keys. Once 61 seconds elapse without activity, the Redis entry completely purges from volatile RAM.
            </p>
          </section>

          {/* Section 5 */}
          <section id="byok-encryption" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">5.</span>
              <span>Bring-Your-Own-Key (BYOK) Governance</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              Thunder AI empowers developers to connect their own API keys (OpenRouter, Groq, DeepSeek, Google Gemini).
            </p>
            <ul className="space-y-1.5 text-xs sm:text-sm text-zinc-400 list-disc list-inside">
              <li>
                <strong className="text-zinc-200">Local Session Storage:</strong> Custom API keys provided via the API Keys modal are cached locally in your client's browser memory or session storage.
              </li>
              <li>
                <strong className="text-zinc-200">In-Transit Encryption:</strong> When making direct inference calls, keys are transmitted strictly over TLS 1.3 encrypted sockets directly to the verified provider endpoints.
              </li>
              <li>
                <strong className="text-zinc-200">No Backend Key Archival:</strong> Our production servers do not store or mirror your private third-party provider keys in persistent storage.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section id="zero-retention" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">6.</span>
              <span>Zero LLM Training & Model Retention</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              When you prompt an AI model through Thunder, the conversation is processed via streaming inference pipelines. We utilize enterprise API tiers with upstream providers (OpenRouter, Google, Groq) configured under terms that prohibit training on API customer data. Your intellectual property, proprietary source code, and queries remain yours alone.
            </p>
          </section>

          {/* Section 7 */}
          <section id="data-deletion" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">7.</span>
              <span>Right to Erasure & Account Deletion</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              In strict accordance with GDPR (General Data Protection Regulation) Article 17 and CCPA (California Consumer Privacy Act), you retain full sovereign ownership over your account data:
            </p>
            <div className="flex items-center space-x-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/25">
              <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
              <div className="text-xs text-zinc-300">
                You can permanently delete your user profile and all associated chat logs at any time directly from the Profile & Settings modal. The system executes a hard cascade purge across all databases with zero retention backups.
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section id="analytics-telemetry" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">8.</span>
              <span>Privacy-Preserving Analytics</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              We employ <strong className="text-white">Vercel Web Analytics</strong> to measure Core Web Vitals (Largest Contentful Paint, Cumulative Layout Shift, Interaction to Next Paint).
            </p>
            <ul className="space-y-1.5 text-xs sm:text-sm text-zinc-400 list-disc list-inside">
              <li>Cookieless tracking (no cookies placed for analytics).</li>
              <li>IP addresses are completely anonymized and discarded at the edge.</li>
              <li>Zero cross-site ad networks, pixel beacons, or data broker integration.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section id="third-party-providers" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">9.</span>
              <span>Model Provider Protocols</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              When routing queries to external foundational model APIs, requests are bound by each provider's zero-day retention enterprise policies:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="font-mono text-xs font-bold text-white">OpenRouter Gateway</div>
                <div className="text-[11px] text-zinc-400">Zero data retention flags enforced on upstream inference providers.</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="font-mono text-xs font-bold text-white">Google Gemini API</div>
                <div className="text-[11px] text-zinc-400">Governed by Google Cloud Enterprise terms; queries not used for model training.</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="font-mono text-xs font-bold text-white">Groq LPU Acceleration</div>
                <div className="text-[11px] text-zinc-400">Ultra-low latency hardware inference with immediate transient buffer release.</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="font-mono text-xs font-bold text-white">DeepSeek Architecture</div>
                <div className="text-[11px] text-zinc-400">Dispatched via secure gateway proxies without persistent storage.</div>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section id="contact" className="scroll-mt-24 space-y-3 p-6 rounded-3xl bg-[#0c0d14]/70 border border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span className="text-blue-400 font-mono">10.</span>
              <span>Security Inquiries & Contact</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              If you have security disclosures, data privacy inquiries, or wish to audit your data telemetry, you can contact the Thunder Engineering & Security Team:
            </p>
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 font-mono text-xs space-y-1">
              <div>Thunder AI Engineering & Governance</div>
              <div>Security Lead: security@thunder-ai.internal</div>
              <div>Platform Gateway: https://thunder-ai-mu.vercel.app</div>
              <div>Cluster Node: vercel_edge_iad1</div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-10 border-t border-white/10 mt-16 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500 relative z-10">
        <div>© 2026 Thunder AI · Enterprise Privacy & Security Protocol</div>
        <div className="flex items-center space-x-5">
          <button onClick={() => navigate('/')} className="hover:text-zinc-300 transition cursor-pointer">Home</button>
          <button onClick={() => navigate('/chat')} className="hover:text-zinc-300 transition cursor-pointer">Chat Workspace</button>
          <a href="/sitemap.xml" className="hover:text-zinc-300 transition">Sitemap</a>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-zinc-300 transition cursor-pointer">
            Back to Top ↑
          </button>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicyPage;
