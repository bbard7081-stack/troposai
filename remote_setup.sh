#!/bin/bash
set -e

echo "🔧 Starting Remote Setup..."

# 1. Resource Optimization (Enable Swap for 1GB VPS)
if [ ! -f /swapfile ]; then
    echo "💾 Creating 2GB Swap file for build stability..."
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
fi

# 2. Stop existing containers to release Port 80
echo "🛑 Releasing port 80..."
if [ -d "/root/careq" ]; then
    cd /root/careq && (docker compose down || true)
fi

# Determine which services to start
START_MODE="all"
case "$1" in
    "--staging-only") START_MODE="staging" ;;
    "--production-only") START_MODE="production" ;;
esac

echo "Starting deployment in $START_MODE mode..."
# Stop any other stray containers safely
CONTAINERS=$(docker ps -q)
if [ ! -z "$CONTAINERS" ]; then
    docker stop $CONTAINERS || true
fi

# 3. Install Docker if missing
if ! command -v docker > /dev/null 2>&1; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
fi

# 4. Install Nginx, Certbot and Utilities
if ! command -v nginx > /dev/null 2>&1 || ! command -v dig > /dev/null 2>&1; then
    echo "🌐 Installing Nginx, Certbot and Utilities (dnsutils)..."
    apt-get update
    apt-get install -y nginx certbot python3-certbot-nginx dnsutils
fi

# 5. Configure Nginx for troposai.com
if grep -q "listen 443" /etc/nginx/sites-available/troposai.com 2>/dev/null; then
    echo "✅ Nginx already has SSL configuration. Skipping overwrite to protect certificates."
else
    echo "⚙️ Configuring Nginx reverse proxy..."
    cat > /etc/nginx/sites-available/troposai.com <<EOF
server {
    listen 80;
    server_name 74.208.170.62 troposai.com www.troposai.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase timeouts for long-running RingCentral requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /testing/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase timeouts for long-running RingCentral requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
fi

ln -sf /etc/nginx/sites-available/troposai.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "🚀 Starting Nginx..."
systemctl enable nginx
systemctl restart nginx || systemctl start nginx

# 6. Obtain SSL Certificate
echo "🔒 Checking SSL Status..."
if [ ! -d "/etc/letsencrypt/live/troposai.com" ]; then
    echo "🌐 Attempting SSL Certificate issuance for troposai.com..."
    # Check if DNS is actually pointing here before trying
    DNS_IP=$(dig +short troposai.com | tail -n1)
    if [ "$DNS_IP" == "74.208.170.62" ]; then
        certbot --nginx -d troposai.com -d www.troposai.com --non-interactive --agree-tos -m admin@troposai.com --redirect || echo "⚠️ certbot failed, but DNS looks correct."
    else
        echo "⚠️ DNS for troposai.com is NOT yet pointing to this IP ($DNS_IP). SSL issuance will fail."
    fi
fi

# 7. Deploy CRM
echo "📦 Extracting and Starting CRM..."
mkdir -p /root/careq/data /root/careq/backups
tar -xzf /root/careq_deploy.tar.gz -C /root/careq || { echo "❌ Tar extraction failed"; exit 1; }

# If the database exists in the package, move it to the data volume
if [ -f "/root/careq/crm_data.db" ]; then
    echo "💾 Restoring database to volume..."
    mv /root/careq/crm_data.db /root/careq/data/crm_data.db
fi

# Match .env.local to .env for Docker Compose
rm -rf /root/careq/.env
if [ -f "/root/careq/.env.local" ]; then
    cp /root/careq/.env.local /root/careq/.env
elif [ -f "/root/careq/.env" ]; then
    echo "⚠️ .env.local missing, using existing .env"
else
    echo "❌ CRITICAL: No environment file found (.env or .env.local)!"
    exit 1
fi

cd /root/careq
echo "🧹 Clearing Docker builder cache to fix layer corruption..."
docker builder prune -f || true

# Start Docker containers based on mode
if [ "$START_MODE" == "staging" ]; then
    docker compose build --no-cache crm_staging
    docker compose up -d crm_staging
elif [ "$START_MODE" == "production" ]; then
    docker compose build --no-cache crm_app
    docker compose up -d crm_app
else
    docker compose build --no-cache
    docker compose up -d
fi

echo "✅ REMOTE SETUP COMPLETE!"
