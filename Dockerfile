# Stage 1: Build Frontend (reads Web/.env during Vite build)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/Web
COPY Web/package*.json ./
RUN npm ci
COPY Web/ ./
RUN npm run build

# Stage 2: Build Backend & Unified Nginx + PM2 Runtime
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache nginx wget \
    && npm install -g pm2

# Setup Backend
WORKDIR /app/Backend
COPY Backend/package*.json ./
RUN npm ci --omit=dev
COPY Backend/ ./

# Copy Frontend Build
WORKDIR /app/Web
COPY --from=frontend-builder /app/Web/dist ./dist

# Copy Unified Nginx Reverse Proxy Config
COPY nginx/nginx-unified.conf /etc/nginx/http.d/default.conf

# Setup Entrypoint
WORKDIR /app
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3010

CMD ["./entrypoint.sh"]
