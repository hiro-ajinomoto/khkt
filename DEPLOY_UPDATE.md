# 🔄 Hướng dẫn Deploy lại sau khi chỉnh sửa code

## 📋 Quy trình tổng quát

1. **Commit và push code lên GitHub**
2. **SSH vào EC2**
3. **Pull code mới**
4. **Update dependencies (nếu cần)**
5. **Rebuild (nếu là frontend)**
6. **Restart services**

---

## 🚀 Quy trình chi tiết

### Bước 1: Commit và Push code lên GitHub (Local)

```bash
# Trên máy local của bạn
cd /path/to/KHKT

# Kiểm tra thay đổi
git status

# Add các file đã sửa
git add .

# Commit
git commit -m "Mô tả thay đổi của bạn"

# Push lên GitHub
git push origin main
```

---

### Bước 2: SSH vào EC2

```bash
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_IP
```

---

### Bước 3: Pull code mới

```bash
cd /home/ec2-user/khkt
git pull origin main
```

---

### Bước 4: Update Backend (nếu có thay đổi)

```bash
cd /home/ec2-user/khkt/be

# Nếu có thêm dependencies mới
npm install --production

# Restart backend với PM2
pm2 restart khkt-backend

# Kiểm tra logs
pm2 logs khkt-backend --lines 20
```

**Lưu ý:**
- Nếu chỉ sửa code (không thêm package mới), chỉ cần `pm2 restart khkt-backend`
- Nếu có thay đổi `.env`, cần restart: `pm2 restart khkt-backend`

---

### Bước 5: Update Frontend (nếu có thay đổi)

```bash
cd /home/ec2-user/khkt/fe/khkt

# Nếu có thêm dependencies mới
npm install

# Rebuild frontend
npm run build

# Copy files vào nginx directory
sudo rm -rf /var/www/khkt/*
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt
sudo chmod -R 755 /var/www/khkt
```

**Lưu ý:**
- Nếu chỉ sửa code frontend, cần rebuild và copy lại
- Nếu có thay đổi `.env.production`, cần rebuild

---

## ⚡ Script tự động (Khuyến nghị)

Sử dụng script `deploy-ec2.sh` đã có sẵn:

```bash
cd /home/ec2-user/khkt

# Pull code mới
git pull origin main

# Chạy script deploy
chmod +x deploy-ec2.sh
./deploy-ec2.sh all
```

Script này sẽ tự động:
- Update backend và restart PM2
- Rebuild frontend và copy vào nginx

---

## 📝 Các trường hợp cụ thể

### Chỉ sửa Backend code

```bash
cd /home/ec2-user/khkt
git pull origin main
cd be
pm2 restart khkt-backend
```

### Chỉ sửa Frontend code

```bash
cd /home/ec2-user/khkt
git pull origin main
cd fe/khkt
npm run build
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt
```

### Thêm package mới (Backend)

```bash
cd /home/ec2-user/khkt
git pull origin main
cd be
npm install --production
pm2 restart khkt-backend
```

### Thêm package mới (Frontend)

```bash
cd /home/ec2-user/khkt
git pull origin main
cd fe/khkt
npm install
npm run build
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt
```

### Sửa .env (Backend)

```bash
cd /home/ec2-user/khkt/be
nano .env
# Sửa các giá trị cần thiết
pm2 restart khkt-backend
```

### Sửa Nginx config

```bash
sudo nano /etc/nginx/conf.d/khkt.conf
# Sửa config
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔍 Kiểm tra sau khi deploy

### Test Backend

```bash
# Test health check
curl http://localhost:8000/health

# Test qua nginx
curl http://YOUR_EC2_IP/api/health

# Xem logs
pm2 logs khkt-backend
```

### Test Frontend

- Mở browser: `http://YOUR_EC2_IP`
- Hard refresh: `Ctrl+Shift+R` (hoặc `Cmd+Shift+R`)
- Mở Developer Tools (F12) → Console để xem lỗi

---

## 🐛 Troubleshooting

### Backend không start

```bash
# Xem logs chi tiết
pm2 logs khkt-backend

# Test chạy thủ công
cd /home/ec2-user/khkt/be
node src/index.js
```

### Frontend không hiển thị

```bash
# Kiểm tra files
ls -la /var/www/khkt

# Kiểm tra nginx
sudo nginx -t
sudo systemctl status nginx
```

### Lỗi dependencies

```bash
# Backend
cd /home/ec2-user/khkt/be
rm -rf node_modules
npm install --production

# Frontend
cd /home/ec2-user/khkt/fe/khkt
rm -rf node_modules
npm install
npm run build
```

---

## 📋 Checklist nhanh

- [ ] Code đã commit và push lên GitHub
- [ ] SSH vào EC2
- [ ] Pull code mới: `git pull origin main`
- [ ] Backend: `pm2 restart khkt-backend` (hoặc `npm install` nếu có package mới)
- [ ] Frontend: `npm run build` và copy vào `/var/www/khkt`
- [ ] Test backend: `curl http://YOUR_IP/api/health`
- [ ] Test frontend trên browser

---

## 💡 Tips

1. **Luôn test trên local trước** khi push lên production
2. **Kiểm tra logs** sau mỗi lần deploy: `pm2 logs khkt-backend`
3. **Backup .env** trước khi sửa: `cp .env .env.backup`
4. **Dùng script deploy** để tránh quên bước
5. **Hard refresh browser** sau khi deploy frontend

---

## 🎯 Tóm tắt lệnh nhanh

```bash
# Full deploy (backend + frontend)
cd /home/ec2-user/khkt
git pull origin main
./deploy-ec2.sh all

# Chỉ backend
cd /home/ec2-user/khkt
git pull origin main
cd be && pm2 restart khkt-backend

# Chỉ frontend
cd /home/ec2-user/khkt
git pull origin main
cd fe/khkt && npm run build && sudo cp -r dist/* /var/www/khkt/ && sudo chown -R nginx:nginx /var/www/khkt
```
