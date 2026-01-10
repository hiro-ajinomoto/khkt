# 🚀 EC2 Deployment - Quick Start Guide

## 📋 Tổng quan

Deploy cả frontend và backend lên một EC2 instance trong **15-20 phút**.

---

## ⚡ Quick Start (Tóm tắt)

1. **Tạo EC2 instance** (t2.micro free tier)
2. **SSH vào server**
3. **Setup môi trường** (Node.js, PM2, Nginx)
4. **Clone code và config**
5. **Deploy và test**

---

## 🔧 Bước 1: Tạo EC2 Instance (5 phút)

### 1.1. AWS Console

1. Vào **AWS Console** → **EC2** → **Launch Instance**
2. **Name**: `khkt-server`
3. **AMI**: Amazon Linux 2023
4. **Instance Type**: `t2.micro` (free tier)
5. **Key Pair**: Tạo mới, download `.pem` file
6. **Network Settings**: 
   - **Security Group**: Tạo mới
   - **SSH (22)**: My IP
   - **HTTP (80)**: Anywhere (0.0.0.0/0)
   - **HTTPS (443)**: Anywhere (0.0.0.0/0)
7. **Storage**: 20GB
8. **Launch Instance**

### 1.2. Lấy IP

- Copy **Public IPv4 address** (ví dụ: `54.123.45.67`)
- Hoặc **Allocate Elastic IP** (khuyến nghị)

---

## 🔐 Bước 2: SSH vào Server (1 phút)

```bash
# Mac/Linux
chmod 400 /path/to/your-key.pem
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_IP
```

---

## 🛠️ Bước 3: Setup Môi trường (5 phút)

Chạy các lệnh sau trên EC2:

```bash
# Update system
sudo dnf update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Install Git
sudo dnf install -y git
```

---

## 📦 Bước 4: Clone và Setup (5 phút)

### 4.1. Clone Repository

```bash
cd /home/ec2-user
git clone https://github.com/hiro-ajinomoto/khkt.git
cd khkt
```

### 4.2. Setup Backend

```bash
cd be
npm install --production

# Tạo .env file
nano .env
```

Paste nội dung sau (thay các giá trị thực tế):

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/khkt_math_grader?retryWrites=true&w=majority
MONGODB_DB=khkt_math_grader
AWS_ACCESS_KEY_ID=JYFvUaOK5vqfYYkXvrXXui139bFdt6GpwYfdtmYm
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET_NAME=khkt-s3
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
PORT=8000
JWT_SECRET=your-very-secure-secret-key-min-32-chars
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
```

Lưu: `Ctrl+O`, `Enter`, `Ctrl+X`

### 4.3. Setup Frontend

```bash
cd ../fe/khkt

# Tạo .env.production (nếu dùng domain)
# Hoặc để trống nếu dùng relative path /api
echo "VITE_API_BASE_URL=http://YOUR_EC2_IP/api" > .env.production

npm install
npm run build
```

### 4.4. Copy Frontend Build

```bash
sudo mkdir -p /var/www/khkt
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt
sudo chmod -R 755 /var/www/khkt
```

---

## ⚙️ Bước 5: Configure Nginx (3 phút)

### 5.1. Tạo Nginx Config

```bash
sudo nano /etc/nginx/conf.d/khkt.conf
```

Paste nội dung sau (thay `YOUR_EC2_IP`):

```nginx
upstream backend {
    server localhost:8000;
}

server {
    listen 80;
    server_name YOUR_EC2_IP;

    client_max_body_size 10M;

    location / {
        root /var/www/khkt;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

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
    }

    location /health {
        proxy_pass http://backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Lưu: `Ctrl+O`, `Enter`, `Ctrl+X`

### 5.2. Test và Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🚀 Bước 6: Start Backend với PM2 (2 phút)

```bash
cd /home/ec2-user/khkt/be

# Tạo logs directory
mkdir -p logs

# Start với PM2
pm2 start ecosystem.config.js
pm2 save

# Setup auto-start on reboot
pm2 startup
# Copy và chạy lệnh mà PM2 hiển thị (có sudo)
```

---

## ✅ Bước 7: Test (1 phút)

### 7.1. Test Backend

```bash
# Test local
curl http://localhost:8000/health

# Test qua nginx
curl http://YOUR_EC2_IP/health
```

### 7.2. Test Frontend

- Mở browser: `http://YOUR_EC2_IP`
- Kiểm tra giao diện hiển thị
- Test đăng ký, đăng nhập

---

## 🔄 Update Code (Sau này)

Sử dụng script tự động:

```bash
cd /home/ec2-user/khkt
chmod +x deploy-ec2.sh

# Deploy tất cả
./deploy-ec2.sh all

# Hoặc chỉ backend
./deploy-ec2.sh backend

# Hoặc chỉ frontend
./deploy-ec2.sh frontend
```

Hoặc manual:

```bash
cd /home/ec2-user/khkt
git pull origin main

# Backend
cd be
npm install --production
pm2 restart khkt-backend

# Frontend
cd ../fe/khkt
npm install
npm run build
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt
```

---

## 🔒 Setup SSL (Nếu có Domain) - Tùy chọn

```bash
# Install Certbot
sudo dnf install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal đã được setup tự động
```

Sau đó update `.env`:
```env
CORS_ORIGIN=https://your-domain.com
```

Restart:
```bash
pm2 restart khkt-backend
```

---

## 📊 Useful Commands

```bash
# PM2
pm2 list
pm2 logs khkt-backend
pm2 restart khkt-backend
pm2 monit

# Nginx
sudo systemctl status nginx
sudo systemctl restart nginx
sudo tail -f /var/log/nginx/error.log

# System
htop          # CPU, Memory
df -h         # Disk space
```

---

## 🐛 Troubleshooting

### Backend không start
```bash
pm2 logs khkt-backend
cd /home/ec2-user/khkt/be
node src/index.js  # Test manually
```

### Frontend không hiển thị
```bash
sudo nginx -t
ls -la /var/www/khkt
sudo tail -f /var/log/nginx/error.log
```

### Port 8000 đã được dùng
```bash
sudo lsof -i :8000
sudo kill -9 PID
```

---

## 🎉 Hoàn thành!

Sau khi hoàn thành:
- ✅ Frontend: `http://YOUR_EC2_IP`
- ✅ Backend API: `http://YOUR_EC2_IP/api`
- ✅ Health check: `http://YOUR_EC2_IP/health`

**Chúc mừng! 🚀**
