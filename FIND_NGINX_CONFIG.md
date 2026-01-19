# 🔍 Tìm và sửa Nginx config

## ❓ Lệnh không hiển thị gì?

Có thể do:
1. File config không tồn tại
2. File ở vị trí khác
3. File có tên khác

---

## 🔍 Bước 1: Tìm file Nginx config

**Chạy các lệnh này trên EC2:**

```bash
# 1. Kiểm tra file có tồn tại không
ls -la /etc/nginx/conf.d/khkt.conf

# 2. Tìm tất cả file config Nginx
sudo find /etc/nginx -name "*.conf" -type f

# 3. Tìm file có chứa "khkt" hoặc "client_max_body_size"
sudo grep -r "khkt\|client_max_body_size" /etc/nginx/

# 4. Kiểm tra sites-enabled (nếu dùng)
ls -la /etc/nginx/sites-enabled/

# 5. Xem Nginx config chính
cat /etc/nginx/nginx.conf | grep -A 5 "include"
```

---

## 🔍 Bước 2: Kiểm tra Nginx đang dùng config nào

```bash
# Xem Nginx đang chạy với config nào
sudo nginx -T 2>&1 | grep -A 10 "server_name\|client_max_body_size"

# Hoặc xem tất cả server blocks
sudo nginx -T 2>&1 | grep -B 5 -A 20 "server {"
```

---

## 🔧 Bước 3: Tạo/Sửa file config

### Nếu file không tồn tại:

**Tạo file mới:**
```bash
# Copy từ template
cd /home/ec2-user/khkt
sudo cp nginx.conf.example /etc/nginx/conf.d/khkt.conf

# Sửa IP/domain
sudo nano /etc/nginx/conf.d/khkt.conf
# Tìm: YOUR_DOMAIN_OR_IP
# Thay bằng: IP thực tế của EC2 (hoặc để trống)
```

**Hoặc tạo file mới từ đầu:**
```bash
sudo nano /etc/nginx/conf.d/khkt.conf
```

**Paste nội dung này (thay YOUR_EC2_IP bằng IP thực tế):**
```nginx
# Backend API upstream
upstream backend {
    server localhost:8000;
}

# Frontend + Backend server
server {
    listen 80;
    server_name YOUR_EC2_IP;

    # Increase body size for file uploads (allow multiple images)
    client_max_body_size 50M;

    # Frontend static files
    location / {
        root /var/www/khkt;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Don't cache index.html - always get fresh version
        location = /index.html {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
        
        # Cache static assets (JS, CSS, images) - they are hashed by Vite
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings (increased for large file uploads)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Increase buffer sizes for large uploads
        proxy_request_buffering off;
        proxy_buffering off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

### Nếu file đã tồn tại nhưng không có `client_max_body_size`:

**Thêm vào:**
```bash
sudo nano /etc/nginx/conf.d/khkt.conf
```

**Tìm dòng `server {` và thêm ngay sau đó:**
```nginx
server {
    listen 80;
    server_name YOUR_EC2_IP;
    
    # Thêm dòng này:
    client_max_body_size 50M;
    
    # ... rest of config
}
```

---

## 🔧 Bước 4: Sửa file hiện có

**Nếu file tồn tại nhưng chưa có giới hạn:**

```bash
# Xem nội dung file
sudo cat /etc/nginx/conf.d/khkt.conf

# Thêm client_max_body_size vào đầu server block
sudo sed -i '/server {/a\    client_max_body_size 50M;' /etc/nginx/conf.d/khkt.conf

# Hoặc thêm vào sau listen
sudo sed -i '/listen 80;/a\    client_max_body_size 50M;' /etc/nginx/conf.d/khkt.conf
```

---

## ✅ Bước 5: Test và reload

```bash
# Test config
sudo nginx -t

# Nếu OK, reload
sudo systemctl reload nginx

# Kiểm tra lại
sudo grep client_max_body_size /etc/nginx/conf.d/khkt.conf
# Phải hiển thị: client_max_body_size 50M;
```

---

## 🔍 Script tự động tìm và sửa

**Chạy script này trên EC2:**

```bash
cat > find-and-fix-nginx.sh << 'EOF'
#!/bin/bash

echo "🔍 Finding Nginx config..."

# 1. Find all config files
echo ""
echo "1. All Nginx config files:"
sudo find /etc/nginx -name "*.conf" -type f

# 2. Find config with khkt or client_max_body_size
echo ""
echo "2. Files containing 'khkt' or 'client_max_body_size':"
sudo grep -r "khkt\|client_max_body_size" /etc/nginx/ 2>/dev/null

# 3. Check main config
echo ""
echo "3. Main Nginx config includes:"
sudo grep "include" /etc/nginx/nginx.conf

# 4. Check active config
echo ""
echo "4. Active server blocks:"
sudo nginx -T 2>&1 | grep -B 2 -A 15 "server {" | head -30

# 5. Try to find or create khkt.conf
echo ""
echo "5. Checking /etc/nginx/conf.d/khkt.conf:"
if [ -f /etc/nginx/conf.d/khkt.conf ]; then
  echo "   ✅ File exists"
  echo "   Content:"
  sudo cat /etc/nginx/conf.d/khkt.conf | head -20
else
  echo "   ❌ File does not exist"
  echo "   Creating from template..."
  cd /home/ec2-user/khkt
  if [ -f nginx.conf.example ]; then
    sudo cp nginx.conf.example /etc/nginx/conf.d/khkt.conf
    echo "   ✅ Created from template"
    echo "   ⚠️  Remember to edit server_name!"
  else
    echo "   ❌ Template not found"
  fi
fi

# 6. Add client_max_body_size if missing
echo ""
echo "6. Adding client_max_body_size if missing..."
if ! grep -q "client_max_body_size" /etc/nginx/conf.d/khkt.conf 2>/dev/null; then
  sudo sed -i '/server {/a\    client_max_body_size 50M;' /etc/nginx/conf.d/khkt.conf
  echo "   ✅ Added client_max_body_size 50M;"
else
  echo "   ✅ Already exists"
  sudo grep client_max_body_size /etc/nginx/conf.d/khkt.conf
fi

# 7. Test
echo ""
echo "7. Testing Nginx config:"
sudo nginx -t

# 8. Reload
echo ""
echo "8. Reloading Nginx..."
sudo systemctl reload nginx
echo "   ✅ Done!"
EOF

chmod +x find-and-fix-nginx.sh
./find-and-fix-nginx.sh
```

---

## 📋 Checklist

- [ ] Đã tìm thấy file Nginx config
- [ ] File có `client_max_body_size 50M;`
- [ ] File có timeout settings (300s)
- [ ] Nginx test thành công (`sudo nginx -t`)
- [ ] Nginx đã reload (`sudo systemctl reload nginx`)
- [ ] Kiểm tra lại: `sudo grep client_max_body_size /etc/nginx/conf.d/khkt.conf`

---

## 💡 Lưu ý

1. **Nếu dùng `sites-enabled`:**
   - File có thể ở: `/etc/nginx/sites-enabled/khkt`
   - Hoặc: `/etc/nginx/sites-available/khkt`

2. **Nếu config trong `nginx.conf` chính:**
   - Sửa trực tiếp: `sudo nano /etc/nginx/nginx.conf`

3. **Sau khi sửa:**
   - Luôn chạy `sudo nginx -t` trước
   - Sau đó `sudo systemctl reload nginx`
