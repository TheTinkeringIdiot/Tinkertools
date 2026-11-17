# Build context: the repository root (see docker-compose.yml); package.json
# and the lockfile live there.

# --- Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Builder ---
FROM node:22-alpine AS builder
WORKDIR /app
# Compiled into the bundle. The API is served from the page's own origin
# (deploy/Caddyfile proxies /api), and the hostname decides which game family
# a first visit opens (frontend/src/composables/useGameVersion.ts).
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_VERSION_HOSTNAME_MAP='{"prk.tinkeringidiot.com":"prk"}'
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_VERSION_HOSTNAME_MAP=$VITE_VERSION_HOSTNAME_MAP
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY frontend ./frontend
RUN npm run build

# --- Runner ---
FROM caddy:2-alpine AS runner
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/frontend/dist /srv
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/healthz || exit 1
