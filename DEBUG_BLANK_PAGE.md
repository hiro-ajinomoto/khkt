# 🔍 Debug "Không hiển thị gì hết" (Blank Page)

## ✅ Đã sửa

1. ✅ **Thêm Vite proxy** cho dev mode (`vite.config.js`)
   - `/api` → `http://localhost:8000` (backend)
   - Hoạt động trong dev mode

2. ✅ **Sửa AuthContext** 
   - Định nghĩa `logout()` trước khi dùng trong `useEffect`
   - Xử lý lỗi tốt hơn

3. ✅ **Build thành công** - Không có lỗi syntax

---

## 🚀 Các bước khắc phục

### 1. Nếu đang chạy dev mode:

**Restart dev server:**
```bash
cd fe/khkt
# Dừng server hiện tại (Ctrl+C)
npm run dev
```

**Kiểm tra:**
- Mở: `http://localhost:5173`
- Mở Console (F12) → Xem có lỗi không

---

### 2. Kiểm tra Console Errors

**Mở Browser Console (F12) và kiểm tra:**

#### Lỗi thường gặp:

**a) "Failed to fetch" hoặc "Network Error":**
- Backend không chạy → Chạy backend:
  ```bash
  cd be
  npm run dev
  ```

**b) "Cannot read property 'X' of undefined":**
- Có thể do API trả về data không đúng format
- Kiểm tra Network tab → Xem response của API

**c) "Uncaught SyntaxError":**
- Có thể do cache cũ → Hard refresh: `Ctrl+Shift+R` (Windows) hoặc `Cmd+Shift+R` (Mac)

---

### 3. Kiểm tra Network Requests

**Mở DevTools → Network tab:**

1. **Refresh trang**
2. **Kiểm tra các request:**
   - `/api/auth/me` → Phải trả về 200 hoặc 401 (nếu chưa login)
   - `/api/assignments` → Phải trả về 200 hoặc 401
   - Nếu có request bị đỏ → Đó là nguyên nhân

---

### 4. Kiểm tra Backend

**Backend phải chạy:**
```bash
cd be
npm run dev
```

**Test backend:**
```bash
curl http://localhost:8000/health
# Phải trả về: {"status":"ok"}
```

---

### 5. Clear Cache và Hard Refresh

**Trên browser:**
- **Chrome/Edge:** `Ctrl+Shift+R` (Windows) hoặc `Cmd+Shift+R` (Mac)
- **Firefox:** `Ctrl+F5` (Windows) hoặc `Cmd+Shift+R` (Mac)
- **Safari:** `Cmd+Option+R`

**Hoặc:**
- Mở DevTools (F12)
- Right-click vào nút Refresh
- Chọn "Empty Cache and Hard Reload"

---

### 6. Kiểm tra localStorage

**Mở Console và chạy:**
```javascript
// Xem token và user trong localStorage
console.log('Token:', localStorage.getItem('khkt_auth_token'));
console.log('User:', localStorage.getItem('khkt_auth_user'));

// Nếu có token cũ/invalid → Clear
localStorage.clear();
location.reload();
```

---

## 🔧 Script Debug Nhanh

**Mở Console (F12) và chạy:**

```javascript
// 1. Kiểm tra API
fetch('/api/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend OK:', d))
  .catch(e => console.error('❌ Backend Error:', e));

// 2. Kiểm tra Auth
console.log('Token:', localStorage.getItem('khkt_auth_token'));
console.log('User:', localStorage.getItem('khkt_auth_user'));

// 3. Kiểm tra React
console.log('React root:', document.getElementById('root'));
```

---

## 📋 Checklist

- [ ] Backend đang chạy (`npm run dev` trong `be/`)
- [ ] Frontend dev server đã restart sau khi sửa `vite.config.js`
- [ ] Console không có lỗi JavaScript
- [ ] Network tab: API requests trả về 200 hoặc 401 (không phải 404/500)
- [ ] Đã hard refresh (Ctrl+Shift+R)
- [ ] localStorage không có token cũ/invalid

---

## 🎯 Nếu vẫn không hiển thị

**Gửi cho tôi:**
1. **Screenshot Console** (F12 → Console tab)
2. **Screenshot Network tab** (F12 → Network tab → Filter: XHR)
3. **Lỗi cụ thể** (nếu có)

---

## 💡 Lưu ý

1. **Dev mode:** Cần backend chạy ở `http://localhost:8000`
2. **Production:** Không cần backend local, dùng `/api` (Nginx proxy)
3. **Sau khi sửa code:** Luôn restart dev server

---

## 🚀 Deploy lên Production

**Nếu dev mode OK, deploy lên EC2:**

```bash
# Commit và push
git add -A
git commit -m "fix: Thêm Vite proxy và sửa AuthContext"
git push origin main

# Trên EC2:
cd /home/ec2-user/khkt
git pull origin main
cd fe/khkt
npm run build
sudo rm -rf /var/www/khkt/*
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt
sudo systemctl reload nginx
```
