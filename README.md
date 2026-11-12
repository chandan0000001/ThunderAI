# Thunder AI // Conversational Intelligence Platform

A high-performance, full-stack AI platform inspired by modern 3D interactive web experiences and enterprise multi-model orchestration.

---

## Features

- **Interactive Landing Page & Alpine Backdrop**: Cinematic panoramic hero, floating capsule navigation, and responsive above-the-fold layout with micro-guarantees.
- **Real-Time Device Governance & Telemetry**: Dynamic client browser, operating system form-factor (Laptop, Smartphone, Tablet), and live public IP address detection.
- **Real-Time Streaming Output**: High-throughput Server-Sent Events (SSE) token streaming with animated electric pulse cursor and markdown rendering.
- **Multi-Model AI Routing & BYOK**: OpenRouter free tier, Groq LPU, DeepSeek R1, and Claude 3.5 Sonnet with client-side Bring-Your-Own-Key encryption and round-robin fallback.
- **Live Redis Token Metering**: Sliding-window rate governance, lifetime usage telemetry, and live consumption indicators.
- **Dynamic Routing & History**: Full URL routing (`/`, `/chat`, `/chat/:chatId`, `/profile`, `/privacy`), custom 404 terminal page, automatic session persistence, and instant conversation switching.
- **Comprehensive Privacy Policy**: 10-clause governance specification covering zero persistent model training, ephemeral 61-second Redis sliding-window TTLs, and GDPR Article 17 hard erasure.
- **Observability & Web Vitals**: Built-in Vercel Web Analytics and Vercel Speed Insights with zero render-blocking penalties.

---

## Architecture & Tech Stack

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

## Getting Started

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
GROQ_API_KEY=your_groq_api_key
DEFAULT_AI_MODEL=openrouter/free
REDIS_URL=your_redis_connection_url
TOKEN_LIMIT=10000
TOKEN_WINDOW_SECONDS=18000
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_character_app_password
# Admin Bootstrap (wrap password in quotes if it contains '#' or special characters)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD="your_strong_admin_password"
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

## Production Cloud Deployment (Cloudflare Pages + Backend)

Thunder AI is fully configured for a high-performance decoupled cloud architecture:
- **Frontend**: **Cloudflare Pages / Workers** (0ms cold start, 300+ global edge locations, free unlimited static bandwidth).
- **Backend**: **Railway** or **Render (Lightweight Backend-Only)** (Fast Docker/Node builds, Native HTTP/2 Server-Sent Events).

---

### 1. Deploy Frontend to Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Select your repository: `chandan0000001/ThunderAI` (branch: `main`).
3. Build Settings:
   - **Framework preset**: `Vite`
   - **Root directory**: `Frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Environment Variables:
   - `VITE_API_BASE_URL`: Your backend URL (e.g. from Railway or Render)
5. Click **Save and Deploy**.

---

### 2. Deploy Backend
- **Option A (Railway)**: Deploy from GitHub repo using root [`Dockerfile`](./Dockerfile) in 1 click.
- **Option B (Render Backend-Only)**: Set Root Directory to `Backend`, Build Command to `npm install --omit=dev`, and ping `/health` with [cron-job.org](https://cron-job.org) to keep it awake 24/7 with zero cold starts.

**For full step-by-step instructions with environment variables, read the [DEPLOYMENT.md](./DEPLOYMENT.md) guide.**

*(Optional)* Or deploy directly via CLI:
```bash
cd Frontend
npm run deploy
```

---

**For detailed setup, proxy routing, and troubleshooting, read the full [DEPLOYMENT.md](./DEPLOYMENT.md) guide.**

---

## License
ISC

