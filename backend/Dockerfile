# syntax=docker/dockerfile:1

# ---- deps: install once, reused by both build and (via cache) prod stages ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript -> dist/ ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

# ---- production: only prod deps + compiled output, nothing else ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Runs as an unprivileged user rather than root inside the container.
RUN addgroup -S obx && adduser -S obx -G obx
USER obx

EXPOSE 5000

# Matches GET /api/health defined in src/routes/index.ts - used by
# docker-compose, Kubernetes, or any PaaS that does container-level health checks.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
