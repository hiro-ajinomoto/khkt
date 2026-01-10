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
    
    # Pull latest code
    print_info "Pulling latest code..."
    git pull origin main
    
    # Install dependencies
    print_info "Installing dependencies..."
    npm install --production
    
    # Check if .env exists
    if [ ! -f .env ]; then
        print_error ".env file not found! Please create it first."
        exit 1
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Restart with PM2
    print_info "Restarting backend with PM2..."
    pm2 restart khkt-backend || pm2 start ecosystem.config.js
    pm2 save
    
    print_success "Backend deployed successfully!"
}

# Deploy Frontend
deploy_frontend() {
    print_info "Deploying frontend..."
    
    cd $FRONTEND_DIR
    
    # Pull latest code
    print_info "Pulling latest code..."
    git pull origin main
    
    # Install dependencies
    print_info "Installing dependencies..."
    npm install
    
    # Build production
    print_info "Building frontend..."
    npm run build
    
    # Copy to nginx directory
    print_info "Copying files to nginx directory..."
    sudo rm -rf $FRONTEND_BUILD_DIR/*
    sudo cp -r dist/* $FRONTEND_BUILD_DIR/
    sudo chown -R nginx:nginx $FRONTEND_BUILD_DIR
    sudo chmod -R 755 $FRONTEND_BUILD_DIR
    
    # Reload nginx
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
