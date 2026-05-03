#!/bin/sh

# Ensure nginx run directory exists
mkdir -p /run/nginx

# Start Nginx and Backend using PM2
echo "Starting Nginx and Backend via PM2..."
cd /app/Backend
pm2 start "nginx -g 'daemon off;'" --name nginx
pm2-runtime ecosystem.config.js
