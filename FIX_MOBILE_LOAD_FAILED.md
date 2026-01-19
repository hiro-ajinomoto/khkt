# 📱 Sửa lỗi "Load Failed" trên Mobile

## ✅ Đã sửa trong code

Đã thay đổi tất cả các file API để dùng **relative path `/api`** thay vì `http://localhost:8000`:

- ✅ `fe/khkt/src/api/auth.js`
- ✅ `fe/khkt/src/api/assignments.js`
- ✅ `fe/khkt/src/api/submissions.js`
- ✅ `fe/khkt/src/api/admin.js`

**Thay đổi:**
```javascript
// Trước:
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Sau:
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
```

---

## 🚀 Deploy lên AWS

### 1. Commit và push code mới:
```bash
cd /Users/adam/my-space/soft-skills-space/KHKT
git add -A
git commit -m "fix: Sửa API URL để hoạt động trên mobile - dùng relative path /api"
git push origin main
```

### 2. SSH vào EC2 và deploy:
```bash
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_IP
```

### 3. Trên EC2, pull code và rebuild:
```bash
cd /home/ec2-user/khkt

# Pull code mới
git pull origin main

# Rebuild frontend
cd fe/khkt
npm run build

# Copy files
sudo rm -rf /var/www/khkt/*
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt

# Restart backend (nếu cần)
cd ../../be
pm2 restart khkt-backend

# Reload Nginx
sudo systemctl reload nginx
```

---

## ✅ Kiểm tra

### Trên laptop:
- Mở: `http://YOUR_EC2_IP`
- Test đăng nhập, xem bài tập → Phải hoạt động bình thường

### Trên mobile:
- Mở: `http://YOUR_EC2_IP`
- Test đăng nhập → **Phải hoạt động được!**

---

## 🔍 Nếu vẫn lỗi trên mobile

### 1. Clear cache trên mobile:
- Chrome: Settings → Privacy → Clear browsing data
- Safari: Settings → Safari → Clear History and Website Data

### 2. Hard refresh:
- Android Chrome: Menu → Reload (hoặc Ctrl+Shift+R)
- iOS Safari: Long press refresh button → Reload Without Content

### 3. Kiểm tra console trên mobile:
- Chrome: `chrome://inspect` trên laptop → Connect device
- Xem lỗi cụ thể trong Console tab

---

## 💡 Giải thích

**Vấn đề:**
- Trên laptop: `localhost` = máy local → có thể test được
- Trên mobile: `localhost` = chính điện thoại → không tìm thấy server → **Load Failed**

**Giải pháp:**
- Dùng **relative path `/api`** → Browser tự động dùng domain hiện tại
- Nginx sẽ proxy `/api` → `http://localhost:8000` (backend)
- Hoạt động trên mọi thiết bị, mọi network

---

## 📝 Lưu ý cho Dev

**Khi dev local:**
- Tạo file `.env.local` với:
  ```
  VITE_API_BASE_URL=http://localhost:8000
  ```
- Hoặc config Vite proxy trong `vite.config.js`

**Khi production:**
- Không cần config gì → Tự động dùng `/api`
- Nginx sẽ xử lý proxy
