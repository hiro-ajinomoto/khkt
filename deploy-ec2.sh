#!/bin/bash

# KHKT EC2 Deployment Script
# Usage: ./deploy-ec2.sh [backend|frontend|all]

set -e

DEPLOY_TYPE=${1:-all}
PROJECT_DIR="/home/ec2-user/khkt"
BACKEND_DIR="$PROJECT_DIR/be"
FRONTEND_DIR="$PROJECT_DIR/fe/khkt"
FRONTEND_BUILD_DIR="/var/www/khkt"

echo "🚀 Starting deployment: $DEPLOY_TYPE"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Deploy Backend
deploy_backend() {
    print_info "Deploying backend..."

    cd $BACKEND_DIR

    # Git pull đã được GitHub Actions gọi ở repo root trước khi chạy script
    # này, nhưng vẫn giữ lại ở đây cho trường hợp chạy tay trên máy EC2.
    print_info "Pulling latest code (idempotent)..."
    git pull origin main || true

    # Dùng ci thay vì install khi có package-lock để dependency lock chính xác
    # hơn và thường nhanh hơn khi cache có sẵn.
    print_info "Installing dependencies..."
    if [ -f package-lock.json ]; then
        npm ci --omit=dev
    else
        npm install --production
    fi

    if [ ! -f .env ]; then
        print_error ".env file not found! Please create it first."
        exit 1
    fi

    mkdir -p logs

    # PM2 ecosystem file hiện đã chuyển sang .cjs để tương thích với backend
    # ES module (package.json có "type": "module"). Reload để zero-downtime
    # thay vì restart (ngắt tạm các kết nối đang xử lý).
    print_info "Reloading backend with PM2..."
    if pm2 describe khkt-backend > /dev/null 2>&1; then
        pm2 reload ecosystem.config.cjs --update-env
    else
        pm2 start ecosystem.config.cjs
    fi
    pm2 save

    print_success "Backend deployed successfully!"
}

# Deploy Frontend
deploy_frontend() {
    print_info "Deploying frontend..."

    cd $FRONTEND_DIR

    print_info "Pulling latest code (idempotent)..."
    git pull origin main || true

    print_info "Installing dependencies..."
    if [ -f package-lock.json ]; then
        npm ci
    else
        npm install
    fi

    print_info "Building frontend..."
    npm run build

    # Sync ra thư mục nginx serve. Dùng rsync với --delete để xoá asset cũ
    # (file có hash tên khác nhau giữa các build) thay vì rm -rf rồi cp —
    # tránh gap thời gian nginx trả 404 cho người dùng đang mở trang.
    print_info "Syncing build output to $FRONTEND_BUILD_DIR..."
    sudo mkdir -p "$FRONTEND_BUILD_DIR"
    sudo rsync -a --delete dist/ "$FRONTEND_BUILD_DIR/"
    sudo chown -R nginx:nginx "$FRONTEND_BUILD_DIR" || true
    sudo chmod -R 755 "$FRONTEND_BUILD_DIR"

    print_info "Reloading nginx..."
    sudo systemctl reload nginx

    print_success "Frontend deployed successfully!"
}

# Main deployment logic
case $DEPLOY_TYPE in
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
    all)
        deploy_backend
        deploy_frontend
        ;;
    *)
        print_error "Invalid deployment type: $DEPLOY_TYPE"
        echo "Usage: ./deploy-ec2.sh [backend|frontend|all]"
        exit 1
        ;;
esac

print_success "Deployment completed!"
print_info "Check logs with: pm2 logs khkt-backend"
