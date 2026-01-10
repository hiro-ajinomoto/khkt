# 🚀 Hướng dẫn Deploy lên EC2 (Frontend + Backend)

## 📋 Tổng quan

Deploy cả frontend và backend lên một EC2 instance, sử dụng:
- **Nginx**: Serve frontend static files và reverse proxy cho backend
- **PM2**: Quản lý Node.js backend process
- **Let's Encrypt**: SSL certificate miễn phí
- **MongoDB Atlas**: Database (hoặc MongoDB trên EC2)

---

## 💰 Chi phí ước tính

- **EC2 t2.micro**: Free 12 tháng đầu (AWS Free Tier), sau đó ~$10/tháng
- **EBS Storage**: 30GB free (Free Tier), sau đó ~$3/tháng
- **MongoDB Atlas**: Free (M0) hoặc ~$9/tháng (M2)
- **Domain**: ~$10-15/năm (tùy chọn)
- **Tổng**: **~$0/tháng** (Free Tier) hoặc **~$20-30/tháng** (sau Free Tier)

---

## 📝 Checklist trước khi bắt đầu

- [ ] AWS Account đã có
- [ ] EC2 instance đã tạo (t2.micro free tier)
- [ ] Security Group đã config (port 22, 80, 443)
- [ ] Key pair (.pem file) đã download
- [ ] MongoDB Atlas đã setup (hoặc MongoDB trên EC2)
- [ ] Domain đã có (tùy chọn, có thể dùng Elastic IP)

---

## 🔧 Bước 1: Tạo EC2 Instance

### 1.1. Tạo EC2 trên AWS Console

1. Vào **AWS Console** → **EC2** → **Launch Instance**
2. **Name**: `khkt-server`
3. **AMI**: Amazon Linux 2023 (free tier eligible)
4. **Instance Type**: `t2.micro` (free tier)
5. **Key Pair**: Tạo mới hoặc chọn existing
   - Download `.pem` file (cần để SSH)
6. **Network Settings**: 
   - **Security Group**: Tạo mới với rules:
     - SSH (22): My IP
     - HTTP (80): Anywhere (0.0.0.0/0)
     - HTTPS (443): Anywhere (0.0.0.0/0)
7. **Storage**: 20GB (free tier)
8. Click **"Launch Instance"**

### 1.2. Lấy Public IP

1. Vào **EC2** → **Instances**
2. Copy **Public IPv4 address** (ví dụ: `54.123.45.67`)

### 1.3. Allocate Elastic IP (Tùy chọn - Khuyến nghị)

1. **EC2** → **Elastic IPs** → **Allocate Elastic IP address**
2. **Allocate**
3. **Actions** → **Associate Elastic IP address**
4. Chọn instance vừa tạo
5. **Associate**

**Lưu ý**: Elastic IP giúp IP không đổi khi restart instance.

---

## 🔐 Bước 2: SSH vào EC2

### 2.1. SSH từ Terminal (Mac/Linux)

```bash
# Thay đổi quyền cho key file
chmod 400 /path/to/your-key.pem

# SSH vào EC2 (thay YOUR_IP và YOUR_KEY)
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_IP
```

### 2.2. SSH từ Windows

- Dùng **PuTTY** hoặc **WSL**
- Convert `.pem` sang `.ppk` nếu dùng PuTTY

---

## 🛠️ Bước 3: Setup Server Environment

### 3.1. Update System

```bash
sudo dnf update -y
```

### 3.2. Install Node.js 18

```bash
# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Verify
node --version  # Should be v18.x.x
npm --version
```

### 3.3. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 3.4. Install Nginx

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 3.5. Install Git

```bash
sudo dnf install -y git
```

---

## 📦 Bước 4: Clone và Setup Backend

### 4.1. Clone Repository

```bash
cd /home/ec2-user
git clone https://github.com/hiro-ajinomoto/khkt.git
cd khkt/be
```

### 4.2. Install Dependencies

```bash
npm install --production
```

### 4.3. Tạo .env File

```bash
nano .env
```

Thêm nội dung sau (thay các giá trị thực tế):

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/khkt_math_grader?retryWrites=true&w=majority
MONGODB_DB=khkt_math_grader

# AWS S3
AWS_ACCESS_KEY_ID=JYFvUaOK5vqfYYkXvrXXui139bFdt6GpwYfdtmYm
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET_NAME=khkt-s3

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# Server
PORT=8000

# JWT
JWT_SECRET=your-very-secure-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# CORS (sẽ update sau khi có domain)
CORS_ORIGIN=*
```

Lưu file: `Ctrl+O`, `Enter`, `Ctrl+X`

### 4.4. Test Backend

```bash
node src/index.js
```

Nếu chạy OK, dừng bằng `Ctrl+C`

---

## 🎨 Bước 5: Build và Setup Frontend

### 5.1. Build Frontend

```bash
cd /home/ec2-user/khkt/fe/khkt

# Install dependencies
npm install

# Build production
npm run build
```

### 5.2. Copy Build Files

```bash
# Tạo thư mục cho frontend
sudo mkdir -p /var/www/khkt

# Copy build files
sudo cp -r dist/* /var/www/khkt/

# Set permissions
sudo chown -R nginx:nginx /var/www/khkt
sudo chmod -R 755 /var/www/khkt
```

---

## ⚙️ Bước 6: Configure Nginx

### 6.1. Tạo Nginx Config

```bash
sudo nano /etc/nginx/conf.d/khkt.conf
```

Thêm nội dung sau (thay `YOUR_DOMAIN` hoặc `YOUR_IP`):

```nginx
# Backend API
upstream backend {
    server localhost:8000;
}

# Frontend + Backend
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Frontend static files
    location / {
        root /var/www/khkt;
        try_files $uri $uri/ /index.html;
        index index.html;
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
    }

    # Health check
    location /health {
        proxy_pass http://backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Lưu file: `Ctrl+O`, `Enter`, `Ctrl+X`

### 6.2. Test Nginx Config

```bash
sudo nginx -t
```

Nếu OK, reload nginx:

```bash
sudo systemctl reload nginx
```

---

## 🚀 Bước 7: Start Backend với PM2

### 7.1. Tạo PM2 Ecosystem File

```bash
cd /home/ec2-user/khkt/be
nano ecosystem.config.js
```

Thêm nội dung:

```javascript
export default {
  apps: [{
    name: 'khkt-backend',
    script: 'src/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    error_file: '/home/ec2-user/logs/khkt-error.log',
    out_file: '/home/ec2-user/logs/khkt-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M'
  }]
}
```

Lưu file.

### 7.2. Tạo Log Directory

```bash
mkdir -p /home/ec2-user/logs
```

### 7.3. Start với PM2

```bash
cd /home/ec2-user/khkt/be
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Copy lệnh `sudo env PATH=...` mà PM2 hiển thị và chạy để PM2 tự start khi server reboot.

### 7.4. PM2 Commands

```bash
pm2 list          # Xem danh sách processes
pm2 logs          # Xem logs
pm2 restart khkt-backend  # Restart 
pm2 stop khkt-backend     # Stop
pm2 delete khkt-backend   # Delete
```

---

## 🔒 Bước 8: Setup SSL với Let's Encrypt (Nếu có Domain)

### 8.1. Install Certbot

```bash
sudo dnf install -y certbot python3-certbot-nginx
```

### 8.2. Get SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

Làm theo hướng dẫn:
- Email: Nhập email của bạn
- Agree to terms: Y
- Redirect HTTP to HTTPS: Y

### 8.3. Auto Renewal

Certbot tự setup cron job để renew certificate.

Test renewal:
```bash
sudo certbot renew --dry-run
```

### 8.4. Update CORS trong Backend

Sau khi có HTTPS, update `.env`:

```bash
cd /home/ec2-user/khkt/be
nano .env
```

Thay `CORS_ORIGIN=*` bằng:
```
CORS_ORIGIN=https://your-domain.com
```

Restart backend:
```bash
pm2 restart khkt-backend
```

---

## 🔄 Bước 9: Update Frontend API URL

### 9.1. Nếu dùng Domain

Frontend đã được build với API URL từ environment variable. Nếu cần rebuild:

```bash
cd /home/ec2-user/khkt/fe/khkt

# Tạo .env.production
echo "VITE_API_BASE_URL=https://your-domain.com/api" > .env.production

# Rebuild
npm run build

# Copy lại
sudo cp -r dist/* /var/www/khkt/
sudo chown -R nginx:nginx /var/www/khkt
```

### 9.2. Nếu dùng IP

Frontend sẽ dùng relative path `/api` (đã config trong nginx), không cần rebuild.

---

## ✅ Bước 10: Test Hệ thống

### 10.1. Test Backend

```bash
# Test health check
curl http://localhost:8000/health

# Test từ nginx
curl http://YOUR_IP/health
```

### 10.2. Test Frontend

- Mở browser: `http://YOUR_IP` hoặc `https://your-domain.com`
- Kiểm tra giao diện hiển thị đúng
- Test đăng ký, đăng nhập
- Test tạo bài tập, nộp bài

---

## 🔧 Maintenance Commands

### Update Code

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

### View Logs

```bash
# Backend logs
pm2 logs khkt-backend

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Restart Services

```bash
# Restart backend
pm2 restart khkt-backend

# Restart nginx
sudo systemctl restart nginx
```

---

## 🐛 Troubleshooting

### Backend không start
```bash
# Check logs
pm2 logs khkt-backend

# Check .env file
cat /home/ec2-user/khkt/be/.env

# Test manually
cd /home/ec2-user/khkt/be
node src/index.js
```

### Nginx không serve frontend
```bash
# Check nginx config
sudo nginx -t

# Check permissions
ls -la /var/www/khkt

# Check nginx error log
sudo tail -f /var/log/nginx/error.log
```

### Port 8000 đã được sử dụng
```bash
# Check process
sudo lsof -i :8000

# Kill process
sudo kill -9 PID
```

### CORS errors
- Kiểm tra `CORS_ORIGIN` trong `.env`
- Restart backend: `pm2 restart khkt-backend`

---

## 📊 Monitoring

### PM2 Monitoring

```bash
pm2 monit
```

### System Resources

```bash
# CPU, Memory
htop

# Disk space
df -h

# Network
sudo netstat -tulpn
```

---

## 🔐 Security Best Practices

1. **Firewall**: Chỉ mở port 22, 80, 443
2. **SSH Key**: Dùng SSH key, tắt password login
3. **Update**: Thường xuyên update system packages
4. **Backup**: Backup database và code định kỳ
5. **SSL**: Luôn dùng HTTPS trong production
6. **Environment Variables**: Không commit `.env` vào Git

---

## 🎉 Hoàn thành!

Sau khi hoàn thành, bạn sẽ có:
- ✅ Frontend: `http://YOUR_IP` hoặc `https://your-domain.com`
- ✅ Backend API: `http://YOUR_IP/api` hoặc `https://your-domain.com/api`
- ✅ HTTPS: Nếu setup SSL
- ✅ Auto-restart: PM2 tự restart khi crash
- ✅ Logs: Dễ dàng xem logs

**Chúc mừng! 🚀**
