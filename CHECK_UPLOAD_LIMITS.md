# 🔍 Kiểm tra và sửa lỗi "Request entity too large"

## ❓ Vẫn còn lỗi sau khi sửa?

Có thể do một trong các nguyên nhân sau:

---

## 1. Nginx config chưa được cập nhật trên EC2

**Kiểm tra:**
```bash
# SSH vào EC2
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_IP

# Kiểm tra giới hạn hiện tại
sudo grep client_max_body_size /etc/nginx/conf.d/khkt.conf
```

**Phải hiển thị:**
```
client_max_body_size 50M;
```

**Nếu vẫn là `10M`:**
```bash
# Sửa trực tiếp
sudo sed -i 's/client_max_body_size 10M;/client_max_body_size 50M;/' /etc/nginx/conf.d/khkt.conf

# Hoặc sửa thủ công
sudo nano /etc/nginx/conf.d/khkt.conf
# Tìm và đổi: client_max_body_size 10M; → 50M;

# Test và reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## 2. Nginx config có nhiều file

**Kiểm tra tất cả Nginx configs:**
```bash
# Tìm tất cả config files
sudo grep -r "client_max_body_size" /etc/nginx/

# Có thể có config ở:
# - /etc/nginx/nginx.conf (global)
# - /etc/nginx/conf.d/khkt.conf (site-specific)
# - /etc/nginx/sites-enabled/khkt (nếu dùng sites-enabled)
```

**Sửa tất cả:**
```bash
# Sửa global config (nếu có)
sudo sed -i 's/client_max_body_size [0-9]*M;/client_max_body_size 50M;/' /etc/nginx/nginx.conf

# Sửa site config
sudo sed -i 's/client_max_body_size [0-9]*M;/client_max_body_size 50M;/' /etc/nginx/conf.d/khkt.conf

# Test và reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3. Backend chưa được restart

**Kiểm tra:**
```bash
cd /home/ec2-user/khkt
git log --oneline -1
# Phải thấy commit: "fix: Tăng giới hạn file upload..."

# Nếu chưa pull
git pull origin main

# Restart backend
cd be
pm2 restart khkt-backend

# Kiểm tra logs
pm2 logs khkt-backend --lines 20
```

---

## 4. Kiểm tra timeout settings

**Kiểm tra Nginx timeout:**
```bash
sudo grep -A 5 "location /api" /etc/nginx/conf.d/khkt.conf
```

**Phải có:**
```nginx
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;
proxy_request_buffering off;
proxy_buffering off;
```

**Nếu thiếu, thêm vào:**
```bash
sudo nano /etc/nginx/conf.d/khkt.conf
# Tìm block "location /api"
# Thêm các dòng trên vào sau proxy_read_timeout
```

---

## 5. Kiểm tra Express body parser limits

**Kiểm tra file `be/src/index.js`:**
```bash
cd /home/ec2-user/khkt/be
grep -A 2 "express.json\|express.urlencoded" src/index.js
```

**Nếu có giới hạn, sửa:**
```javascript
// Thay vì:
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Thành:
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
```

---

## 6. Script tự động kiểm tra và sửa

**Chạy script này trên EC2:**

```bash
cat > check-and-fix-upload.sh << 'EOF'
#!/bin/bash

echo "🔍 Checking upload limits..."

# 1. Check Nginx
echo ""
echo "1. Nginx client_max_body_size:"
NGINX_LIMIT=$(sudo grep -h "client_max_body_size" /etc/nginx/conf.d/khkt.conf /etc/nginx/nginx.conf 2>/dev/null | head -1)
echo "   Current: $NGINX_LIMIT"

if [[ "$NGINX_LIMIT" != *"50M"* ]]; then
  echo "   ⚠️  Need to update to 50M"
  sudo sed -i 's/client_max_body_size [0-9]*M;/client_max_body_size 50M;/' /etc/nginx/conf.d/khkt.conf
  echo "   ✅ Updated"
else
  echo "   ✅ OK"
fi

# 2. Check Nginx timeout
echo ""
echo "2. Nginx timeout settings:"
if grep -q "proxy_read_timeout 300s" /etc/nginx/conf.d/khkt.conf; then
  echo "   ✅ Timeout settings OK"
else
  echo "   ⚠️  Need to add timeout settings"
  # Add after proxy_read_timeout 60s
  sudo sed -i '/proxy_read_timeout 60s;/a\        proxy_connect_timeout 300s;\n        proxy_send_timeout 300s;\n        proxy_read_timeout 300s;\n        proxy_request_buffering off;\n        proxy_buffering off;' /etc/nginx/conf.d/khkt.conf
  echo "   ✅ Added"
fi

# 3. Test Nginx
echo ""
echo "3. Testing Nginx config:"
sudo nginx -t

# 4. Reload Nginx
echo ""
echo "4. Reloading Nginx..."
sudo systemctl reload nginx
echo "   ✅ Reloaded"

# 5. Check backend
echo ""
echo "5. Backend status:"
cd /home/ec2-user/khkt/be
git log --oneline -1 | head -1
pm2 status | grep khkt-backend

# 6. Restart backend
echo ""
echo "6. Restarting backend..."
pm2 restart khkt-backend
echo "   ✅ Restarted"

echo ""
echo "✅ Done! Test upload again."
EOF

chmod +x check-and-fix-upload.sh
./check-and-fix-upload.sh
```

---

## 7. Kiểm tra logs để xem lỗi cụ thể

**Nginx error log:**
```bash
sudo tail -f /var/log/nginx/error.log
```

**Backend logs:**
```bash
pm2 logs khkt-backend --lines 50
```

**Khi upload file, xem log để biết lỗi ở đâu:**
- Nginx log → Lỗi ở Nginx
- Backend log → Lỗi ở Backend

---

## 8. Test upload với curl

**Test từ server:**
```bash
# Tạo file test 5MB
dd if=/dev/zero of=/tmp/test-5mb.jpg bs=1M count=5

# Test upload
curl -X POST http://localhost/api/submissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "assignment_id=YOUR_ASSIGNMENT_ID" \
  -F "files=@/tmp/test-5mb.jpg"

# Nếu thành công → Backend OK
# Nếu lỗi → Xem lỗi cụ thể
```

---

## 9. Kiểm tra file size thực tế

**Có thể file quá lớn:**
- Ảnh từ điện thoại có thể rất lớn (10-20MB mỗi ảnh)
- Nếu upload nhiều ảnh → Tổng có thể > 50MB

**Giải pháp:**
1. Tăng `client_max_body_size` lên `100M` hoặc `200M`
2. Hoặc compress ảnh trước khi upload (frontend)

---

## 10. Checklist cuối cùng

- [ ] Nginx `client_max_body_size` = `50M` (hoặc lớn hơn)
- [ ] Nginx timeout = `300s`
- [ ] Nginx `proxy_request_buffering` = `off`
- [ ] Backend đã pull code mới
- [ ] Backend đã restart (pm2 restart)
- [ ] Nginx đã reload (systemctl reload)
- [ ] Test upload với file < 10MB → Phải OK
- [ ] Test upload với file 10-50MB → Phải OK

---

## 💡 Nếu vẫn lỗi

**Gửi cho tôi:**
1. Output của: `sudo grep client_max_body_size /etc/nginx/conf.d/khkt.conf`
2. Output của: `pm2 logs khkt-backend --lines 20`
3. Output của: `sudo tail -20 /var/log/nginx/error.log`
4. Kích thước file bạn đang upload (bao nhiêu MB?)
5. Số lượng files (bao nhiêu files?)
