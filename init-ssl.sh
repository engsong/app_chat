#!/bin/bash
set -e

DOMAIN="chat.on-excapp.app"
EMAIL="admin@on-excapp.app"
DATA_PATH="./nginx/certbot"

echo "=================================================="
echo "🔐 Setting up SSL Certificate for: $DOMAIN"
echo "=================================================="

mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
mkdir -p "$DATA_PATH/www"

# 1. Create temporary self-signed certificate if none exists
if [ ! -f "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" ]; then
  echo "Creating temporary certificate to allow Nginx to start..."
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$DATA_PATH/conf/live/$DOMAIN/privkey.pem" \
    -out "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" \
    -subj "/CN=localhost"
fi

# 2. Start Nginx container
echo "Starting Nginx..."
docker compose up -d nginx

# 3. Request official certificate from Let's Encrypt
echo "Requesting official Let's Encrypt certificate..."
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $EMAIL \
    -d $DOMAIN \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal \
    --non-interactive" certbot

# 4. Reload Nginx with the official certificate
echo "Reloading Nginx with new certificate..."
docker compose exec nginx nginx -s reload

echo "=================================================="
echo "🎉 SSL Certificate successfully configured for $DOMAIN!"
echo "=================================================="
