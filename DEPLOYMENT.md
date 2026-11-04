# 🚀 Modern Cloud Deployment Guide: Cloudflare Pages + Koyeb (Docker)

This guide walks you through migrating **Thunder AI** from Render to a high-performance decoupled architecture:
* 🌐 **Frontend**: **Cloudflare Pages** (100% Free, 0ms Cold Start, Global Edge CDN for Three.js 3D assets).
* ⚡ **Backend**: **Koyeb** (Free Eco Tier, **Runs 24/7 without sleeping**, Native SSE Streaming, Dockerized).

---

## 🏗️ Architecture Overview

```mermaid
flowchart LR
    User[Browser Client]
    
    subgraph Cloudflare["Cloudflare Global Edge (300+ Cities)"]
        CF[Cloudflare Pages<br/>React 19 + Three.js 3D Assets]
    end
    
    subgraph Koyeb["Koyeb Cloud (24/7 Container)"]
        Backend[Docker Express 5 Server<br/>SSE Streaming & Gateway]
    end
    
    subgraph DataMesh["Cloud Infrastructure Mesh"]
        Mongo[(MongoDB Atlas)]
        Redis[(Upstash / Redis Cloud)]
        AI[OpenRouter LLM Mesh]
    end
    
    User -->|Static Assets & 3D Shaders| CF
    User -->|API & Real-Time SSE Streams| Backend
    Backend --> Mongo
    Backend --> Redis
    Backend --> AI
```

---

## 🛠️ Step 1: Deploy Backend to Koyeb (with Docker)

1. Sign up or log in to **[koyeb.com](https://app.koyeb.com/)**.
2. Click **Create Service** and select **GitHub**.
3. Authorize Koyeb and select your repository: **`chandan0000001/ThunderAI`**.
4. In the **Deployment method** section:
   * Select **Dockerfile** (Koyeb automatically detects the root `Dockerfile`).
5. In the **Instance type** section:
   * Choose **Eco** (Nano / Micro) — runs **24/7 for free without sleeping**.
   * Select the region closest to you (e.g., Frankfurt, Washington D.C., or Singapore).
6. In the **Exposed Ports** section:
   * Port: `3000`
   * Protocol: `HTTP`
   * Path: `/health` (Koyeb health check)
7. In the **Environment Variables** section, add:
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
   FRONTEND_URL=https://thunderai.pages.dev
   ```
   *(You can update `FRONTEND_URL` once Cloudflare Pages gives you your `.pages.dev` URL).*
8. Click **Deploy**.
9. Once deployed, Koyeb will assign a public domain like:
   `https://thunder-ai-<your-username>.koyeb.app`

Test it by visiting `https://thunder-ai-<your-username>.koyeb.app/health` in your browser. It should return:
```json
{"status":"healthy","timestamp":"2026-11-04T..."}
```

---

## 🌐 Step 2: Deploy Frontend to Cloudflare Pages

1. Log in to the **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. Navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select the repository: **`chandan0000001/ThunderAI`** and branch: **`main`**.
4. Configure the build settings:
   * **Framework preset**: `Vite`
   * **Root directory**: `Frontend`
   * **Build command**: `npm run build`
   * **Build output directory**: `dist`
5. Under **Environment variables (Advanced)**, add:
   ```env
   VITE_API_BASE_URL=https://thunder-ai-<your-username>.koyeb.app
   ```
   *(Substitute your actual Koyeb backend URL from Step 1).*
6. Click **Save and Deploy**.
7. Cloudflare will build and publish your site in ~30 seconds, giving you a custom URL like:
   `https://thunderai.pages.dev`

---

## 🔄 Step 3: Link the Domains

1. Go back to your **Koyeb Dashboard** > your service settings > **Environment Variables**.
2. Set `FRONTEND_URL` to your Cloudflare URL:
   ```env
   FRONTEND_URL=https://thunderai.pages.dev
   ```
3. Koyeb will automatically trigger a zero-downtime redeploy.

---

## ✨ Why this is 10x better than Render:

| Feature | Render (Free Tier) | Cloudflare Pages + Koyeb (Docker) |
| :--- | :--- | :--- |
| **Cold Starts** | 🐢 60–90 seconds sleep | ⚡ **0ms for Frontend, 24/7 alive on Koyeb** |
| **3D Three.js Performance** | Loaded from single origin container | ⚡ **Served from 300+ global Cloudflare edge locations** |
| **SSE Streaming** | Occasional proxy buffering | ⚡ **Dedicated HTTP/2 streaming pipeline** |
| **Portability** | Locked to Render blueprint | 🐳 **Containerized Dockerfile runs anywhere (Koyeb, Fly, Railway, VPS)** |
| **Bandwidth** | 100 GB cap | ⚡ **Unlimited free static bandwidth on Cloudflare** |
