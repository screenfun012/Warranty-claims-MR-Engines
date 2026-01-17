#!/bin/bash
# Tailscale Proxy Server Setup Script
# Run this on the DigitalOcean Droplet

set -e

echo "=========================================="
echo "Tailscale Proxy Server Setup"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Update system
echo -e "${YELLOW}[1/10] Updating system...${NC}"
apt-get update -qq

# Install Tailscale
echo -e "${YELLOW}[2/10] Installing Tailscale...${NC}"
if ! command -v tailscale &> /dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
else
    echo "Tailscale already installed"
fi

# Install Node.js
echo -e "${YELLOW}[3/10] Installing Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Create directory
echo -e "${YELLOW}[4/10] Creating directory...${NC}"
mkdir -p /opt/tailscale-proxy
cd /opt/tailscale-proxy

# Install dependencies
echo -e "${YELLOW}[5/10] Installing npm dependencies...${NC}"
if [ -f "package.json" ]; then
    npm install --silent
else
    echo "ERROR: package.json not found!"
    exit 1
fi

# Create .env file if it doesn't exist
echo -e "${YELLOW}[6/10] Creating .env file...${NC}"
if [ ! -f ".env" ]; then
    cat > .env << EOF
SYNO_IMAP_HOST=100.80.235.71
SYNO_IMAP_PORT=993
SYNO_SMTP_HOST=100.80.235.71
SMTP_PORT=465
IMAP_TCP_PORT=1993
SMTP_TCP_PORT=1465
HEALTH_PORT=3000
EOF
    echo "Created .env file. Please update SYNO_IMAP_HOST and SYNO_SMTP_HOST with your Synology Tailscale IP!"
else
    echo ".env file already exists"
fi

# Install PM2
echo -e "${YELLOW}[7/10] Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo "PM2 already installed"
fi

# Setup firewall
echo -e "${YELLOW}[8/10] Configuring firewall...${NC}"
ufw allow 1993/tcp
ufw allow 1465/tcp
ufw allow 3000/tcp
ufw --force enable

# Start server with PM2
echo -e "${YELLOW}[9/10] Starting server...${NC}"
pm2 delete email-proxy 2>/dev/null || true
pm2 start server.js --name email-proxy
pm2 save

# Setup PM2 startup
echo -e "${YELLOW}[10/10] Setting up PM2 startup...${NC}"
pm2 startup | grep -v "PM2" | bash || true

echo ""
echo -e "${GREEN}=========================================="
echo "Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Run: tailscale up"
echo "   (Copy the link and authorize in browser)"
echo ""
echo "2. Check Tailscale IP:"
echo "   tailscale ip"
echo ""
echo "3. Update .env file with Synology Tailscale IP:"
echo "   nano /opt/tailscale-proxy/.env"
echo ""
echo "4. Restart server:"
echo "   pm2 restart email-proxy"
echo ""
echo "5. Check status:"
echo "   pm2 status"
echo "   pm2 logs email-proxy"
echo ""
echo "6. Test health check:"
echo "   curl http://localhost:3000/health"
echo ""
