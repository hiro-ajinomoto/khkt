# 🔧 Sửa lỗi "Request entity too large" trên Mobile

## 🔍 Vấn đề

- **Desktop (Laptop)**: Upload file OK ✅
- **Mobile (Điện thoại)**: Lỗi "Request entity too large" ❌

## 🎯 Nguyên nhân

### Desktop:
- Có thể đang test trực tiếp với backend: `http://localhost:8000`
- **Bỏ qua Nginx** → Không bị giới hạn `client_max_body_size`
- Hoặc Nginx config đã được cập nhật trên desktop (cache?)

### Mobile:
- **Luôn đi qua Nginx**: `http://EC2_IP/api`
- Nginx mặc định chỉ cho phép **1MB**
- File > 1MB → Lỗi "Request entity too large"

---

## ✅ Giải pháp

### Cách 1: Dùng script tự động (Khuyến nghị)

**Trên EC2, chạy:**
```bash
# Copy script lên EC2
cd /home/ec2-user/khkt
git pull origin main

# Chạy script
chmod +x fix-nginx-upload-limit.sh
./fix-nginx-upload-limit.sh
```

**Script sẽ:**
1. Tìm file Nginx config
2. Tạo mới nếu chưa có
3. Thêm/cập nhật `client_max_body_size 50M;`
4. Thêm timeout settings
5. Test và reload Nginx

---

### Cách 2: Sửa thủ công

**Bước 1: Tìm file Nginx config**
```bash
# Tìm file config
sudo find /etc/nginx -name "*.conf" -type f | xargs sudo grep -l "8000\|khkt"

# Hoặc kiểm tra
ls -la /etc/nginx/conf.d/khkt.conf
ls -la /etc/nginx/sites-enabled/khkt
```

**Bước 2: Tạo file nếu chưa có**
```bash
cd /home/ec2-user/khkt
git pull origin main

# Copy từ template
sudo cp nginx.conf.example /etc/nginx/conf.d/khkt.conf

# Sửa IP (tùy chọn)
sudo nano /etc/nginx/conf.d/khkt.conf
# Tìm: YOUR_DOMAIN_OR_IP
# Thay bằng: IP thực tế hoặc xóa dòng server_name
```

**Bước 3: Thêm/cập nhật client_max_body_size**
```bash
# Xem file hiện tại
sudo cat /etc/nginx/conf.d/khkt.conf

# Thêm sau "server {"
sudo sed -i '/server {/a\    client_max_body_size 50M;' /etc/nginx/conf.d/khkt.conf

# Hoặc thủ công
sudo nano /etc/nginx/conf.d/khkt.conf
# Tìm dòng "server {" và thêm ngay sau đó:
#     client_max_body_size 50M;
```

**Bước 4: Thêm timeout settings (trong location /api)**
```bash
sudo nano /etc/nginx/conf.d/khkt.conf
```

**Tìm block `location /api {` và thêm:**
```nginx
location /api {
    # ... existing config ...
    
    # Thêm các dòng này:
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    proxy_request_buffering off;
    proxy_buffering off;
}
```

**Bước 5: Test và reload**
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

## 🧪 Kiểm tra sau khi sửa

### 1. Kiểm tra Nginx config:
```bash
# Phải hiển thị: client_max_body_size 50M;
sudo grep client_max_body_size /etc/nginx/conf.d/khkt.conf

# Phải có timeout settings
sudo grep "proxy_read_timeout 300s" /etc/nginx/conf.d/khkt.conf
```

### 2. Test trên Desktop (qua Nginx):
```bash
# Trên desktop, mở: http://EC2_IP
# Thử upload file 3MB
# Phải OK (giống mobile)
```

### 3. Test trên Mobile:
```bash
# Trên mobile, mở: http://EC2_IP
# Thử upload file 3MB
# Phải OK ✅
```

---

## 📋 Config mẫu đầy đủ

**File: `/etc/nginx/conf.d/khkt.conf`**

```nginx
# Backend API upstream
upstream backend {
    server localhost:8000;
}

# Frontend + Backend server
server {
    listen 80;
    server_name YOUR_EC2_IP;  # Hoặc xóa dòng này

    # ⭐ QUAN TRỌNG: Tăng giới hạn upload
    client_max_body_size 50M;

    # Frontend static files
    location / {
        root /var/www/khkt;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        location = /index.html {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
        
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
        
        # ⭐ QUAN TRỌNG: Timeout cho upload lớn
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_request_buffering off;
        proxy_buffering off;
    }

    # Health check
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

---

## 🔍 Debug nếu vẫn lỗi

### 1. Kiểm tra Nginx logs:
```bash
# Error log
sudo tail -f /var/log/nginx/error.log

# Access log
sudo tail -f /var/log/nginx/access.log
```

### 2. Kiểm tra backend logs:
```bash
pm2 logs khkt-backend --lines 50
```

### 3. Test trực tiếp:
```bash
# Test từ server
curl -X POST http://localhost/api/submissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "assignment_id=YOUR_ASSIGNMENT_ID" \
  -F "files=@/tmp/test-3mb.jpg" \
  -v
```

### 4. Kiểm tra giới hạn thực tế:
```bash
# Xem tất cả config có client_max_body_size
sudo grep -r "client_max_body_size" /etc/nginx/

# Xem config chính
sudo grep "client_max_body_size" /etc/nginx/nginx.conf
```

---

## 💡 Lưu ý

1. **Sau khi sửa Nginx:**
   - Phải chạy `sudo nginx -t` để test
   - Phải reload: `sudo systemctl reload nginx`

2. **Desktop và Mobile:**
   - Cả hai đều phải đi qua Nginx (`http://EC2_IP`)
   - Desktop không nên test trực tiếp `localhost:8000` nữa

3. **Giới hạn hiện tại:**
   - Nginx: 50MB tổng
   - Multer: 10MB mỗi file
   - Express: 50MB body parser

---

## ✅ Checklist

- [ ] Nginx config có `client_max_body_size 50M;`
- [ ] Nginx config có timeout settings (300s)
- [ ] Nginx test thành công (`sudo nginx -t`)
- [ ] Nginx đã reload (`sudo systemctl reload nginx`)
- [ ] Test upload trên desktop (qua Nginx) → OK
- [ ] Test upload trên mobile → OK

---

## 🚀 Quick Fix

**Chạy 1 lệnh này trên EC2:**
```bash
cd /home/ec2-user/khkt && git pull origin main && \
chmod +x fix-nginx-upload-limit.sh && \
./fix-nginx-upload-limit.sh
```

Sau đó test lại trên mobile!
