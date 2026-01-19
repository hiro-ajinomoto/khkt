# 🚀 Hướng dẫn Deploy lại lên AWS EC2 (Nhanh)

## ⚡ Quy trình nhanh (3 bước)

### Bước 1: Push code lên GitHub (Local)

```bash
cd /Users/adam/my-space/soft-skills-space/KHKT
git add -A
git commit -m "Mô tả thay đổi"
git push origin main
```

### Bước 2: SSH vào EC2

```bash
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_IP
```

### Bước 3: Deploy (trên EC2)

**Cách 1: Dùng script tự động (Khuyến nghị)**

```bash
cd /home/ec2-user/khkt
git pull origin main
./deploy-ec2.sh all
```

**Cách 2: Deploy thủ công**

```bash
# Pull code mới
cd /home/ec2-user/khkt
git pull origin main

# Deploy Backend
cd be
pm2 restart khkt-backend

# Deploy Frontend
cd ../fe/khkt
npm run build
sudo rm -rf /var/www/khkt/*
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt
sudo systemctl reload nginx
```

---

## 📋 Các trường hợp cụ thể

### Chỉ sửa Frontend

```bash
cd /home/ec2-user/khkt
git pull origin main
cd fe/khkt
npm run build
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt
```

### Chỉ sửa Backend

```bash
cd /home/ec2-user/khkt
git pull origin main
cd be
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

### Thêm package mới (Backend)

```bash
cd /home/ec2-user/khkt
git pull origin main
cd be
npm install --production
pm2 restart khkt-backend
```

---

## 🔍 Kiểm tra sau khi deploy

### Test Backend
```bash
curl http://localhost:8000/health
# hoặc
curl http://YOUR_EC2_IP/api/health
```

### Test Frontend
- Mở browser: `http://YOUR_EC2_IP`
- Hard refresh: `Ctrl+Shift+R` (Windows) hoặc `Cmd+Shift+R` (Mac)

### Xem logs
```bash
# Backend logs
pm2 logs khkt-backend

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🐛 Troubleshooting

### Backend không chạy
```bash
pm2 logs khkt-backend
pm2 restart khkt-backend
```

### Frontend không hiển thị
```bash
# Kiểm tra files
ls -la /var/www/khkt

# Kiểm tra nginx
sudo nginx -t
sudo systemctl status nginx
```

---

## 💡 Lệnh nhanh nhất

```bash
# Trên EC2, chạy lệnh này để deploy tất cả:
cd /home/ec2-user/khkt && git pull origin main && ./deploy-ec2.sh all
```
