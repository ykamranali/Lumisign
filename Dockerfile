# syntax=docker/dockerfile:1

# ---------- Stage 1: build the Next.js dashboard as a static export ----------
FROM node:18-alpine AS webbuild
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY web/ ./
ENV NEXT_PUBLIC_API_URL="" \
    NEXT_PUBLIC_SOCKET_URL=""
RUN npm run build

# ---------- Stage 2: runtime — API server also serves the dashboard ----------
FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=webbuild /web/out /app/web/out
EXPOSE 4000
CMD ["node", "src/index.js"]
