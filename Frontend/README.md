# Thunder AI Frontend // Conversational Intelligence Platform

A high-performance React 19 + TypeScript frontend crafted for multi-model AI routing, Redis token governance, and real-time streaming intelligence.

## Key Experiences

### 1. Landing Page & Telemetry Matrix
- **Panoramic Alpine Hero**: Cinematic full-screen twilight mountain backdrop, floating capsule navigation, and above-the-fold CTA layout.
- **Active Session Telemetry**: Real-time visitor device form-factor (`Laptop`, `Smartphone`, `Tablet`), client browser engine, and public IP address detection.
- **Micro-Benchmark Observability**: Isolated live security event tape and real-time throughput sparkline waveform.
- **Interactive Multi-Model Showcase**: Preview cards and live latency metrics for OpenRouter, Groq LPU, DeepSeek R1, and Claude 3.5 Sonnet.
- **Privacy & Security Protocols**: Direct access to the 10-clause Privacy Policy, Sitemap, and Custom 404 Route.

### 2. Chat Workspace (Gemini-Inspired Interface)
- **Collapsible Sidebar**: Gemini hamburger menu toggle, "+ New Chat" pill with colorful plus icon, time-sorted conversation history, search filter, and individual chat deletion.
- **Optimized Rendering**: Zero-flashing memoized `UserAvatar` and decoupled state management avoiding redundant re-render cascades.
- **Conversational Message Thread**: High-throughput SSE streaming, syntax-highlighted code blocks with copy-to-clipboard, token metrics badges (`Prompt`, `Completion`, `Total`), and typing indicators.
- **Floating Prompt Dock**: Frosted glass bottom input pill with multiline expansion, model tag, attachment button, and BYOK engine toggle.
- **Token Quota HUD**: Real-time sliding-window token usage meter hooked to Redis in-memory sorted sets.
- **Settings & Profile Drawer**: User details display, live quota telemetry, Bring-Your-Own-Key management, and danger-zone account deletion.

## Tech Stack
- **Framework**: React 19 + TypeScript (Strict mode, Vite v8)
- **Styling**: Tailwind CSS v4 + Lucide Icons
- **Observability**: `@vercel/analytics` + `@vercel/speed-insights`
- **Animation & Effects**: Canvas Confetti, custom CSS keyframes
- **Routing & SEO**: React Router v7 + Dynamic Page SEO Synchronizer

## Running the Frontend

```bash
# In the Frontend directory
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and automatically proxies requests (`/user`, `/chat`, `/msg`) to the backend server at `http://localhost:3000`.
