#!/bin/bash
set -e

DOMAIN="chat.on-excapp.app"
EMAIL="admin@on-excapp.app"
WEBROOT="/var/www/certbot"
CONF_FILE="/etc/nginx/sites-available/chat.on-excapp.app.conf"

echo "=========================================================="
echo "🔐 Setting up Nginx & SSL for $DOMAIN on Cloud Server"
echo "=========================================================="

# Ensure webroot folder exists for Let's Encrypt validation
mkdir -p "$WEBROOT"

# Copy site config to Nginx sites-available
cp ./nginx/chat.on-excapp.app.conf "$CONF_FILE"

# Check if SSL cert already exists
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "⚠️ SSL certificate for $DOMAIN not found. Obtaining from Let's Encrypt..."

    # Create temporary HTTP-only config to allow certbot challenge
    cat <<EOF > /etc/nginx/sites-available/chat-temp.conf
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ {
        root $WEBROOT;
        allow all;
    }
    location / {
        return 200 "Certbot Challenge Server Ready";
        add_header Content-Type text/plain;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/chat-temp.conf /etc/nginx/sites-enabled/
    nginx -t
    systemctl reload nginx

    # Request official SSL certificate
    certbot certonly --webroot -w "$WEBROOT" \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive

    # Remove temp config
    rm -f /etc/nginx/sites-available/chat-temp.conf /etc/nginx/sites-enabled/chat-temp.conf
fi

# Enable the production High-Security config
ln -sf "$CONF_FILE" /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo "=========================================================="
echo "🎉 Successfully configured https://$DOMAIN with Anti-DDoS!"
echo "=========================================================="
