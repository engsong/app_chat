#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Starting Automated Deployment on Server"
echo "=========================================="

APP_DIR="/var/www/chat-app"
cd "$APP_DIR"

# Update Host Nginx Configuration if changed
if [ -f "./nginx/chat.on-excapp.app.conf" ]; then
  echo "🛡️ Updating Nginx Anti-DDoS Configuration..."
  cp ./nginx/chat.on-excapp.app.conf /etc/nginx/sites-available/chat.on-excapp.app.conf
  ln -sf /etc/nginx/sites-available/chat.on-excapp.app.conf /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx || true
fi

echo "🐳 Building Docker images..."
docker compose build

echo "🔄 Removing previous container instances to prevent conflict..."
docker rm -f whatsapp_frontend whatsapp_backend 2>/dev/null || true
sleep 1

echo "🚀 Starting Docker containers..."
docker compose up -d --remove-orphans

echo "🧹 Cleaning up old unused Docker images..."
docker image prune -f

echo "✅ Deployment completed successfully!"
docker compose ps
