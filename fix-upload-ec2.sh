#!/bin/bash

echo "🔧 Fixing file upload limits on EC2..."

# 1. Update Nginx config
echo ""
echo "1. Updating Nginx config..."
sudo sed -i 's/client_max_body_size [0-9]*M;/client_max_body_size 50M;/' /etc/nginx/conf.d/khkt.conf

# 2. Add timeout settings if not exists
if ! grep -q "proxy_read_timeout 300s" /etc/nginx/conf.d/khkt.conf; then
  echo "   Adding timeout settings..."
  sudo sed -i '/proxy_read_timeout 60s;/a\        proxy_connect_timeout 300s;\n        proxy_send_timeout 300s;\n        proxy_read_timeout 300s;\n        proxy_request_buffering off;\n        proxy_buffering off;' /etc/nginx/conf.d/khkt.conf
fi

# 3. Test Nginx
echo ""
echo "2. Testing Nginx config..."
sudo nginx -t

# 4. Reload Nginx
echo ""
echo "3. Reloading Nginx..."
sudo systemctl reload nginx

# 5. Update backend
echo ""
echo "4. Updating backend..."
cd /home/ec2-user/khkt
git pull origin main

# 6. Restart backend
echo ""
echo "5. Restarting backend..."
cd be
pm2 restart khkt-backend

echo ""
echo "✅ Done! File upload limit increased to 50MB"
echo ""
echo "📋 Check status:"
echo "   Nginx: sudo grep client_max_body_size /etc/nginx/conf.d/khkt.conf"
echo "   Backend: pm2 status"
