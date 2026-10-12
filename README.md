# ⚡ Thunder AI // Conversational Intelligence Platform

A high-performance, full-stack AI platform inspired by modern 3D interactive web experiences and enterprise multi-model orchestration.

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

## ☁️ Deploying to Render (Free Single-Service Deployment)

Thunder AI is preconfigured to build and serve both the React SPA frontend and the Express backend as a single unified service on Render's free tier with zero CORS or cookie domain issues.

### Option 1: Automatic Blueprint (Recommended)
1. Push your repository to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com).
3. Click **New +** > **Blueprint**.
4. Connect `chandan0000001/ThunderAI`. Render reads `render.yaml` automatically.
5. Fill in your environment variables (`MONGO_URI`, `OPENROUTER_API_KEY`, `REDIS_URL`, `EMAIL_USER`, `EMAIL_PASS`).
6. Click **Apply**.

### Option 2: Manual Web Service
1. Click **New +** > **Web Service** on Render.
2. Connect your GitHub repository.
3. Configure the service:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
   - **Health Check Path**: `/health`
4. Add the following **Environment Variables**:
   - `NODE_ENV`: `production`
   - `MONGO_URI`: Your MongoDB Atlas URI
   - `JWT_SECRET`: A secure random string
   - `OPENROUTER_API_KEY`: Your OpenRouter API key
   - `REDIS_URL`: Your Redis connection URL (e.g., from Upstash)
   - `EMAIL_USER`: Your Gmail address
   - `EMAIL_PASS`: Your 16-character Google App Password
   - `TOKEN_LIMIT`: `10000`
   - `TOKEN_WINDOW_SECONDS`: `18000`
5. Click **Create Web Service**.

---

## 📄 License
ISC

