# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/Web
COPY Web/package*.json ./
RUN npm install
COPY Web/ ./
ARG VITE_API_URL=/api
RUN VITE_API_URL=$VITE_API_URL npm run build

# Stage 2: Build Backend and Final Image
FROM node:20-alpine
WORKDIR /app

# Set default internal port
ENV PORT=5000

# Install Nginx and PM2
RUN apk add --no-cache nginx \
    && npm install -g pm2

# Setup Backend
WORKDIR /app/Backend
COPY Backend/package*.json ./
RUN npm install --production
COPY Backend/ ./

# Copy Frontend Build
WORKDIR /app/Web
COPY --from=frontend-builder /app/Web/dist ./dist

# Copy Nginx Config
COPY nginx/nginx-unified.conf /etc/nginx/http.d/default.conf

# Setup Entrypoint
WORKDIR /app
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ["./entrypoint.sh"]
