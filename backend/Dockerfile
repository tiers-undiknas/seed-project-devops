# syntax=docker/dockerfile:1.7
# ============================================================
# Backend Multi-Stage Dockerfile (Node.js 20 Alpine)
# ============================================================

# ---------- Stage 1: Builder (Test & Dependencies) ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Menggunakan npm ci untuk reproducible build
RUN npm ci
COPY . .

# Stage Test (untuk menjalankan Vitest)
FROM builder AS test
CMD ["npm", "test"]

# ---------- Stage 2: Runtime (Production) ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Hanya install dependency production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code dari builder
COPY --from=builder --chown=node:node /app/src ./src

# Security Hardening: Jalankan sebagai non-root user
USER node
EXPOSE 3000

# Healthcheck: Mengecek endpoint /healthz/live
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/healthz/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]