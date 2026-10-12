# Nexus AI Frontend // Dogstudio Aesthetic & Gemini Interface

A high-performance React + TypeScript frontend crafted for the multi-model intelligence backend.

## 🚀 Key Experiences

### 1. Landing Page (Inspired by [Dogstudio](https://dogstudio.co/))
- **Interactive Three.js 3D Centerpiece**: Real-time WebGL icosahedron core with mathematical sinusoidal vertex displacement, dynamic particle galaxy, floating astrolabe rings, tone mapping, and cursor-reactive damping.
- **Editorial Typography & HUD Telemetry**: Styled with `Syne`, `Space Grotesk`, `Inter`, and `JetBrains Mono`. Features high-contrast brutalist numbers, live FPS counter, shader mode toggling, and sound wave fx.
- **Infinite Marquee Ticker**: Continuous typography showcasing the backend's token limiter, memory compression, and OpenRouter integration.
- **Manifesto & Architecture Matrix**: Deep dive into Redis sliding-window token governance, context condensation, and stateless JWT blocklisting.
- **Interactive Neural Model Switcher**: Live inspect profiles of OpenRouter Free tier, Gemini 2.0 Flash, Claude 3.5 Sonnet, and DeepSeek R1.
- **Live Prompt Sandbox**: Quick test playground before entering the full conversational workspace.

### 2. Inside Application (Google Gemini Interface)
- **Collapsible Sidebar**: Gemini hamburger menu toggle, "+ New Chat" pill with colorful plus icon, time-sorted conversation history, search filter, and individual chat deletion.
- **Signature Empty State**: Iconic Gemini sparkling starburst icon, "Hello, Chandan — How can I help you today?" in animated gradient typography, and 4 quick-action suggestion prompt cards.
- **Conversational Message Thread**: Formatted markdown rendering, syntax-highlighted code blocks with copy-to-clipboard, token metrics badges (`Prompt`, `Completion`, `Total`), and typing indicators.
- **Floating Prompt Dock**: Frosted glass bottom input pill with multiline expansion, model tag, attachment button, web search toggle, and gradient send action.
- **Token Quota & Rate Limit HUD**: Real-time sliding-window token usage meter hooked to Redis keys and MongoDB user statistics.
- **Settings & Profile Drawer**: User details display, token metrics inspection, and account deletion.

## 🛠️ Tech Stack
- **Framework**: React 19 + TypeScript (Strict mode, Vite v8)
- **3D Graphics**: Three.js (WebGL 2.0, procedural geometry deformation, point cloud particles)
- **Styling**: Tailwind CSS v4, Lucide Icons
- **Animation & Effects**: Canvas Confetti, custom CSS keyframes

## ⚡ Running the Frontend

```bash
# In the Frontend directory
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and automatically proxies requests (`/user`, `/chat`, `/msg`) to the backend server at `http://localhost:3000`.
