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

# 1.5 Automated Pre-Deployment Backup
echo "💾 Performing safety backup of production database..."
if [ -f "/root/careq/data/crm_data.db" ]; then
    mkdir -p /root/careq/backups
    BACKUP_NAME="crm_auto_backup_$(date +%Y-%m-%dT%H-%M-%S).db"
    cp /root/careq/data/crm_data.db "/root/careq/backups/$BACKUP_NAME"
    echo "✅ Backup created: $BACKUP_NAME"
else
    echo "⚠️ No existing database found to backup (this is normal for fresh installs)."
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
    echo "⚙️  Forcing Nginx Configuration Update (SSL + Staging)..."
    cat > /etc/nginx/sites-available/troposai.com <<EOF
server {
    server_name 74.208.170.62 troposai.com www.troposai.com;

    # Production (Port 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_next_upstream error timeout invalid_header http_502 http_503 http_504;
    }

    # Staging (Port 3001)
    location /testing/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_next_upstream error timeout invalid_header http_502 http_503 http_504;
    }

    # SSL Configuration (Managed by remote_setup.sh to persist Certbot paths)
    listen 443 ssl; 
    ssl_certificate /etc/letsencrypt/live/troposai.com/fullchain.pem; 
    ssl_certificate_key /etc/letsencrypt/live/troposai.com/privkey.pem; 
    include /etc/letsencrypt/options-ssl-nginx.conf; 
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; 
}

# HTTP Redirect
server {
    if (\$host = www.troposai.com) { return 301 https://\$host\$request_uri; }
    if (\$host = troposai.com) { return 301 https://\$host\$request_uri; }
    listen 80;
    server_name 74.208.170.62 troposai.com www.troposai.com;
    return 404; 
}
EOF

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
echo "🔄 Running Data Migration (Fixing Tenant ID Typo)..."
cd /root/careq && node migrate_tenants.js || echo "⚠️ Migration script failed (non-critical if DB empty)"
echo "🔄 Running Schema Migration (Adding Interaction Logs)..."
cd /root/careq && node migrate_interaction_cols.js || echo "⚠️ Interaction migration failed"


# Match .env.local to .env for Docker Compose
rm -rf /root/careq/.env
cp /root/careq/.env.local /root/careq/.env

cd /root/careq
echo "🧹 Clearing Docker builder cache to fix layer corruption..."
docker builder prune -f || true

# Start Docker containers based on mode
if [ "$START_MODE" == "staging" ]; then
    docker compose up -d --build crm_staging
elif [ "$START_MODE" == "production" ]; then
    docker compose up -d --build crm_app
else
    docker compose up -d --build
fi

echo "✅ REMOTE SETUP COMPLETE!"
