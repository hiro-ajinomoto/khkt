# 📤 Sửa lỗi "Request entity too large" khi upload file

## 🔍 Nguyên nhân

Lỗi "Request entity too large" xảy ra khi:
1. **Nginx** giới hạn `client_max_body_size` quá nhỏ (hiện tại: 10M)
2. **Multer** không có giới hạn file size rõ ràng
3. **Timeout** quá ngắn cho upload lớn

---

## ✅ Đã sửa

### 1. Tăng giới hạn Nginx (`nginx.conf.example`)

**Trước:**
```nginx
client_max_body_size 10M;
```

**Sau:**
```nginx
client_max_body_size 50M;
```

**Và thêm timeout settings:**
```nginx
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;
proxy_request_buffering off;
proxy_buffering off;
```

### 2. Thêm giới hạn cho Multer (`be/src/routers/submissions.js`)

**Trước:**
```javascript
const upload = multer({ storage });
```

**Sau:**
```javascript
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files
  },
});
```

---

## 🚀 Deploy lên EC2

### 1. Cập nhật Nginx config trên EC2:

```bash
# SSH vào EC2
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_IP

# Backup config hiện tại
sudo cp /etc/nginx/conf.d/khkt.conf /etc/nginx/conf.d/khkt.conf.backup

# Sửa config
sudo nano /etc/nginx/conf.d/khkt.conf
```

**Thay đổi:**
1. Tìm dòng `client_max_body_size 10M;` → Đổi thành `50M;`
2. Thêm vào block `location /api`:
   ```nginx
   proxy_connect_timeout 300s;
   proxy_send_timeout 300s;
   proxy_read_timeout 300s;
   proxy_request_buffering off;
   proxy_buffering off;
   ```

**Hoặc copy từ file mới:**
```bash
cd /home/ec2-user/khkt
git pull origin main
sudo cp nginx.conf.example /etc/nginx/conf.d/khkt.conf
# Sửa YOUR_DOMAIN_OR_IP thành IP thực tế của EC2
sudo nano /etc/nginx/conf.d/khkt.conf
```

**Test và reload:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Cập nhật Backend:

```bash
cd /home/ec2-user/khkt
git pull origin main
cd be
pm2 restart khkt-backend
```

---

## 📋 Kiểm tra

### 1. Kiểm tra Nginx config:
```bash
sudo nginx -t
# Phải hiển thị: "syntax is ok" và "test is successful"
```

### 2. Kiểm tra giới hạn hiện tại:
```bash
# Xem Nginx config
sudo grep client_max_body_size /etc/nginx/conf.d/khkt.conf

# Phải hiển thị: client_max_body_size 50M;
```

### 3. Test upload:
- Thử upload file lớn hơn 10MB
- Phải không còn lỗi "Request entity too large"

---

## 💡 Giải thích

### Giới hạn hiện tại:
- **Nginx:** 50MB tổng (cho tất cả files trong một request)
- **Multer:** 10MB mỗi file, tối đa 10 files
- **Tổng tối đa:** 50MB (giới hạn bởi Nginx)

### Nếu cần upload lớn hơn:
1. Tăng `client_max_body_size` trong Nginx (ví dụ: `100M`)
2. Tăng `fileSize` trong Multer (ví dụ: `20 * 1024 * 1024`)
3. Lưu ý: Upload lớn sẽ tốn thời gian và băng thông

---

## ⚠️ Lưu ý

1. **Sau khi sửa Nginx config:**
   - Phải chạy `sudo nginx -t` để test
   - Phải reload: `sudo systemctl reload nginx`

2. **Sau khi sửa Backend:**
   - Phải restart: `pm2 restart khkt-backend`

3. **Nếu vẫn lỗi:**
   - Kiểm tra logs: `sudo tail -f /var/log/nginx/error.log`
   - Kiểm tra backend logs: `pm2 logs khkt-backend`

---

## 🔧 Script tự động sửa trên EC2

```bash
cat > fix-upload-size.sh << 'EOF'
#!/bin/bash

echo "🔧 Fixing file upload size limits..."

# 1. Update Nginx config
echo "📝 Updating Nginx config..."
sudo sed -i 's/client_max_body_size 10M;/client_max_body_size 50M;/' /etc/nginx/conf.d/khkt.conf

# 2. Add timeout settings if not exists
if ! grep -q "proxy_connect_timeout 300s" /etc/nginx/conf.d/khkt.conf; then
  sudo sed -i '/proxy_read_timeout 60s;/a\        proxy_connect_timeout 300s;\n        proxy_send_timeout 300s;\n        proxy_read_timeout 300s;\n        proxy_request_buffering off;\n        proxy_buffering off;' /etc/nginx/conf.d/khkt.conf
fi

# 3. Test Nginx config
echo "🧪 Testing Nginx config..."
sudo nginx -t

# 4. Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

# 5. Restart backend
echo "🔄 Restarting backend..."
cd /home/ec2-user/khkt/be
pm2 restart khkt-backend

echo "✅ Done! File upload limit increased to 50MB"
EOF

chmod +x fix-upload-size.sh
./fix-upload-size.sh
```
