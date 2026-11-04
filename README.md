# ⚡ Thunder AI // Conversational Intelligence Platform

A high-performance, full-stack AI platform inspired by modern 3D interactive web experiences and enterprise multi-model orchestration.

---

## 🎓 Academic Technical Seminar Report (30 Pages)

A comprehensive, publication-grade 30-page engineering technical seminar report is available in this repository:
- 📄 **[Download / View 30-Page Seminar Report PDF](./ThunderAI_Seminar_Report.pdf)**
- 📖 **[Read Full Seminar Markdown Documentation](./ThunderAI_Seminar_Report.md)**
- ⚙️ **[PDF Generator Script (`docs/generate_seminar_pdf.py`)](./docs/generate_seminar_pdf.py)**

The report covers:
1. Historical Evolution of Conversational Systems & LLM Architectures
2. Literature Survey: Streaming Protocols (SSE vs. WebSockets) & WebGL Shaders
3. Three-Tier Decoupled System Architecture & OpenRouter AI Gateway
4. Interactive 3D WebGL Graphics Engine, Trigonometric Vertex Displacement & PBR Shading
5. Express 5 Asynchronous Streaming, Proxy Chunk Flushing & Recursive Context Summarization
6. Distributed Redis In-Memory State Governance, Sliding-Window Quotas & Cryptographic Auth
7. MongoDB Atlas Document Persistence, Compound Indexing & Cascading Deletion
8. Empirical Latency (TTFT), Concurrency Stress Testing & GPU Profiling
9. Single-Service Zero-CORS Cloud Deployment on Render
10. Conclusion, Future Scope (WebGPU & RAG), and Academic Bibliography (IEEE/ACM citations)

---

## ✨ Features

- **🌐 Interactive 3D Landing Page**: Three.js iridescent procedural energy orb with dynamic day/night light mode toggle, orbit camera controls, and smooth responsive layout.
- **⚡ Real-Time Streaming Output**: High-throughput Server-Sent Events (SSE) token streaming with animated electric pulse cursor and markdown rendering.
- **🧠 Multi-Model AI Routing**: Powered by OpenRouter free and low-latency open weights models (with graceful fallback handling).
- **🛡️ Live Redis Token Metering**: Sliding-window rate governance, lifetime usage telemetry, and live consumption indicators.
- **🧭 Dynamic Routing & History**: Full URL routing (`/`, `/chat`, `/chat/:chatId`, `/profile`), automatic session persistence, and instant conversation switching.
- **💎 High-Voltage Profile & Account Control**: Live telemetry gauge, Redis TTL sliding-window tracker, and secure danger-confirmation account purge modal.

---

## 🛠️ Architecture & Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite 8
- **3D Graphics**: Three.js
- **Styling**: Tailwind CSS v4 + Lucide Icons
- **Routing**: React Router v7
- **Markdown**: ReactMarkdown + remark-gfm

### Backend
- **Runtime**: Node.js + Express 5
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Cache & Rate Governance**: Redis (Sliding window rate-limiter & token limiter)
- **AI Engine**: OpenRouter SDK (`@openrouter/sdk`)
- **Authentication**: JWT in secure HTTP-only cookies + Bcrypt

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Redis instance (Upstash or local Redis)
- MongoDB Atlas cluster

### 2. Setup Backend
```bash
cd Backend
npm install
```

Configure `Backend/.env`:
```env
PORT=3000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
OPENROUTER_API_KEY=your_openrouter_api_key
DEFAULT_AI_MODEL=openrouter/free
REDIS_URL=your_redis_connection_url
TOKEN_LIMIT=10000
TOKEN_WINDOW_SECONDS=18000
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_character_app_password
```

Start the backend:
```bash
npm run dev
```

### 3. Setup Frontend
```bash
cd Frontend
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## ☁️ Production Cloud Deployment (Cloudflare Pages + Zeabur / Railway)

Thunder AI is fully configured for a high-performance decoupled cloud architecture:
- 🌐 **Frontend**: **Cloudflare Pages / Workers** (0ms cold start, 300+ global edge locations, free unlimited static bandwidth).
- ⚡ **Backend**: **Zeabur / Railway** (Dockerized, **No 60-Second Sleep**, Native HTTP/2 Server-Sent Events).

---

### 1. Deploy Backend to Zeabur (Free & Instant)
1. Go to [zeabur.com](https://zeabur.com) and log in with **GitHub**.
2. Click **Create Project** > **Deploy New Service** > select `chandan0000001/ThunderAI`.
3. Zeabur automatically detects the root [`Dockerfile`](./Dockerfile).
4. In **Variables**, add your environment variables:
   ```env
   NODE_ENV=production
   PORT=3000
   MONGO_URI=your_mongodb_atlas_connection_string
   JWT_SECRET=your_jwt_secret_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   DEFAULT_AI_MODEL=openrouter/free
   REDIS_URL=your_redis_connection_url
   TOKEN_LIMIT=10000
   TOKEN_WINDOW_SECONDS=18000
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_app_password
   FRONTEND_URL=https://thunder-ai.pages.dev
   ```
5. In **Networking**, click **Generate Domain** to get your backend HTTPS URL (e.g. `https://thunder-ai.zeabur.app`).

*(Alternative: You can also deploy to **[Railway](https://railway.com)** using the same Dockerfile).*

---

### 2. Deploy Frontend to Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Select repository: `chandan0000001/ThunderAI` (branch: `main`).
3. Build Settings:
   - **Framework preset**: `Vite`
   - **Root directory**: `Frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Environment Variables:
   - `VITE_API_BASE_URL`: `https://thunder-ai.zeabur.app` (your backend URL)
5. Click **Save and Deploy**.

*(Optional)* Or deploy directly via CLI:
```bash
cd Frontend
npm run deploy
```

---

📖 **For detailed setup, proxy routing, and troubleshooting, read the full [DEPLOYMENT.md](./DEPLOYMENT.md) guide.**

---

## 📄 License
ISC

