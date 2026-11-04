# Production Dockerfile for Thunder AI Backend (Koyeb / Cloud Containers)
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies for the backend
COPY Backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy backend source code
COPY Backend/ ./

# Expose backend service port
EXPOSE 3000

# Container health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the Express server
CMD ["npm", "start"]
