#!/bin/bash

echo "🔧 Fixing Nginx upload limit for mobile..."

# 1. Find Nginx config file
CONFIG_FILE=""
if [ -f /etc/nginx/conf.d/khkt.conf ]; then
  CONFIG_FILE="/etc/nginx/conf.d/khkt.conf"
  echo "✅ Found config: $CONFIG_FILE"
elif [ -f /etc/nginx/sites-enabled/khkt ]; then
  CONFIG_FILE="/etc/nginx/sites-enabled/khkt"
  echo "✅ Found config: $CONFIG_FILE"
else
  echo "❌ Config file not found. Creating from template..."
  cd /home/ec2-user/khkt
  if [ -f nginx.conf.example ]; then
    sudo cp nginx.conf.example /etc/nginx/conf.d/khkt.conf
    CONFIG_FILE="/etc/nginx/conf.d/khkt.conf"
    echo "✅ Created: $CONFIG_FILE"
    # Replace YOUR_DOMAIN_OR_IP with actual IP or remove
    EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
    if [ -n "$EC2_IP" ]; then
      sudo sed -i "s/YOUR_DOMAIN_OR_IP/$EC2_IP/g" "$CONFIG_FILE"
    else
      sudo sed -i "s/server_name YOUR_DOMAIN_OR_IP;/# server_name;/g" "$CONFIG_FILE"
    fi
  else
    echo "❌ Template not found. Please create config manually."
    exit 1
  fi
fi

# 2. Check current limit
echo ""
echo "📊 Current client_max_body_size:"
CURRENT_LIMIT=$(sudo grep -i "client_max_body_size" "$CONFIG_FILE" 2>/dev/null || echo "NOT FOUND")
echo "   $CURRENT_LIMIT"

# 3. Add or update client_max_body_size
if [[ "$CURRENT_LIMIT" == *"NOT FOUND"* ]] || [[ "$CURRENT_LIMIT" == *"1M"* ]] || [[ "$CURRENT_LIMIT" == *"10M"* ]]; then
  echo ""
  echo "⚠️  Limit too small or missing. Updating to 50M..."
  
  if [[ "$CURRENT_LIMIT" == *"NOT FOUND"* ]]; then
    # Add after server {
    sudo sed -i '/server {/a\    client_max_body_size 50M;' "$CONFIG_FILE"
    echo "   ✅ Added client_max_body_size 50M;"
  else
    # Update existing
    sudo sed -i 's/client_max_body_size [0-9]*M;/client_max_body_size 50M;/' "$CONFIG_FILE"
    echo "   ✅ Updated to 50M"
  fi
else
  echo "   ✅ Limit OK: $CURRENT_LIMIT"
fi

# 4. Check and add timeout settings
echo ""
echo "📊 Checking timeout settings..."
if ! grep -q "proxy_read_timeout 300s" "$CONFIG_FILE" 2>/dev/null; then
  echo "   ➕ Adding timeout settings..."
  # Add after proxy_read_timeout 60s or in location /api block
  if grep -q "proxy_read_timeout 60s" "$CONFIG_FILE"; then
    sudo sed -i '/proxy_read_timeout 60s;/a\        proxy_connect_timeout 300s;\n        proxy_send_timeout 300s;\n        proxy_read_timeout 300s;\n        proxy_request_buffering off;\n        proxy_buffering off;' "$CONFIG_FILE"
  else
    # Add in location /api block
    sudo sed -i '/location \/api {/,/}/ {
      /proxy_cache_bypass/a\        proxy_connect_timeout 300s;\n        proxy_send_timeout 300s;\n        proxy_read_timeout 300s;\n        proxy_request_buffering off;\n        proxy_buffering off;
    }' "$CONFIG_FILE"
  fi
  echo "   ✅ Added timeout settings"
else
  echo "   ✅ Timeout settings OK"
fi

# 5. Test Nginx config
echo ""
echo "🧪 Testing Nginx config..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
  echo "   ✅ Config is valid"
else
  echo "   ❌ Config has errors!"
  sudo nginx -t
  exit 1
fi

# 6. Reload Nginx
echo ""
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx
if [ $? -eq 0 ]; then
  echo "   ✅ Nginx reloaded successfully"
else
  echo "   ❌ Failed to reload Nginx"
  exit 1
fi

# 7. Verify
echo ""
echo "✅ Verification:"
sudo grep -i client_max_body_size "$CONFIG_FILE"
echo ""
echo "✅ Done! Upload limit increased to 50MB"
echo ""
echo "📋 Test on mobile:"
echo "   - Upload file < 50MB should work"
echo "   - Both desktop and mobile now use same limit"
