#!/bin/bash
set -e

echo "=========================================================="
echo "⚡ Initializing Production Cloud Server (Docker & Nginx)"
echo "=========================================================="

# 1. Update OS packages
if [ -x "$(command -v apt-get)" ]; then
    echo "📦 Detected Debian / Ubuntu system. Updating packages..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release ufw git openssl

    # 2. Install Docker if not present
    if ! [ -x "$(command -v docker)" ]; then
        echo "🐳 Installing Docker Engine..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl enable docker
        systemctl start docker
    fi

    # 3. Configure Firewall (UFW)
    echo "🛡️ Configuring Firewall..."
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw --force enable

elif [ -x "$(command -v yum)" ]; then
    echo "📦 Detected CentOS / RHEL system. Updating packages..."
    yum update -y
    yum install -y curl git openssl firewalld
    if ! [ -x "$(command -v docker)" ]; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl enable docker
        systemctl start docker
    fi
fi

# Verify Docker and Docker Compose
echo "✅ Docker version: $(docker --version)"
echo "✅ Docker Compose version: $(docker compose version)"

echo "=========================================================="
echo "🚀 Server is fully prepared for automated GitHub Deployments!"
echo "=========================================================="
