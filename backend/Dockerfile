# syntax=docker/dockerfile:1.7
FROM node:24.18.0-bookworm-slim AS node-base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM node-base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM dependencies AS build
COPY backend backend
RUN npm run db:generate --workspace backend \
    && npm run build --workspace backend

FROM build AS operations
COPY scripts scripts
ENTRYPOINT []

FROM node:24.18.0-bookworm-slim AS production-dependencies
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev \
    && npm cache clean --force

FROM node-base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --chown=node:node backend/package.json ./backend/package.json
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 3000
WORKDIR /app/backend
CMD ["node", "dist/server.js"]
