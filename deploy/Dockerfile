# ==========================================================
# Multi-stage Production Dockerfile for Self-Hosted Server
# Ready for December Cloud VPS + Custom Domain Deployment
# ==========================================================

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_STANDALONE=1

# Stage 1: Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Validate dataset & build standalone Next.js output
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run validate:data && npm run build

# Stage 3: Minimal production runtime
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
