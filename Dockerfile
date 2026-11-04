# Multi-stage Dockerfile for Thunder AI (Optimized for Koyeb, Fly.io, Railway, and VPS)

# ----------------------------------------------------------------------
# Stage 1: Build React 19 Frontend SPA Assets
# ----------------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /frontend

# Copy frontend dependency manifests and install dependencies
COPY Frontend/package*.json ./
RUN npm install

# Copy frontend source and build static bundle
COPY Frontend/ ./
RUN npm run build

# ----------------------------------------------------------------------
# Stage 2: Production Node.js & Express 5 Server
# ----------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only for Backend
COPY Backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source files
COPY Backend/ ./

# Copy compiled frontend build to the location expected by Express static serving
COPY --from=frontend-builder /frontend/dist ../Frontend/dist

# Expose backend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start Express server
CMD ["npm", "start"]
