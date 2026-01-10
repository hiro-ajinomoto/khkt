# 🚀 Quick Start Deploy Guide

## Phương án được đề xuất: **Vercel (Frontend) + Railway (Backend)**

---

## 📋 Checklist trước khi deploy

- [ ] Code đã push lên GitHub
- [ ] MongoDB Atlas cluster đã tạo (free tier M0)
- [ ] AWS S3 bucket đã setup
- [ ] OpenAI API key đã có

---

## 🔧 Bước 1: Setup MongoDB Atlas (5 phút)

1. Vào https://www.mongodb.com/cloud/atlas
2. Đăng ký/Đăng nhập
3. Tạo **Free Cluster** (M0)
4. Chọn region gần nhất (ví dụ: Singapore)
5. Tạo database user:
   - Username: `khkt-admin`
   - Password: (tạo password mạnh)
6. **Network Access**: Add IP Address → "Allow Access from Anywhere" (0.0.0.0/0)
7. **Connect** → "Connect your application" → Copy connection string
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority`

---

## 🚂 Bước 2: Deploy Backend trên Railway (10 phút)

### 2.1. Tạo project trên Railway

1. Vào https://railway.app
2. Đăng nhập bằng GitHub
3. Click **"New Project"**
4. Chọn **"Deploy from GitHub repo"**
5. Chọn repository của bạn
6. Railway sẽ tự detect Node.js

### 2.2. Cấu hình project

1. Click vào project vừa tạo
2. Click vào service → **Settings** → **Root Directory**: `be`
3. **Deploy** → Railway sẽ tự build và deploy

### 2.3. Thêm Environment Variables

Vào **Variables** tab, thêm các biến sau:

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
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# Server
PORT=8000

# JWT
JWT_SECRET=your-very-secure-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# CORS (sẽ update sau khi có frontend URL)
CORS_ORIGIN=*
```

### 2.4. Lấy Backend URL

1. Sau khi deploy xong, Railway sẽ tự tạo domain
2. Copy URL (ví dụ: `https://your-app.railway.app`)
3. Test: Mở `https://your-app.railway.app/health` → phải thấy `{"status":"ok"}`

---

## ⚡ Bước 3: Deploy Frontend trên Vercel (5 phút)

### 3.1. Tạo project trên Vercel

1. Vào https://vercel.com
2. Đăng nhập bằng GitHub
3. Click **"Add New..."** → **"Project"**
4. Import GitHub repository
5. **Root Directory**: Chọn `fe/khkt`

### 3.2. Cấu hình Build

Vercel sẽ tự detect Vite, nhưng kiểm tra:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3.3. Thêm Environment Variables

Vào **Settings** → **Environment Variables**, thêm:

```env
VITE_API_BASE_URL=https://your-backend.railway.app
```

⚠️ **Lưu ý**: Thay `your-backend.railway.app` bằng URL backend thực tế từ Railway

### 3.4. Deploy

Click **"Deploy"** → Vercel sẽ build và deploy tự động

### 3.5. Lấy Frontend URL

1. Sau khi deploy xong, Vercel sẽ tạo domain
2. Copy URL (ví dụ: `https://your-app.vercel.app`)

---

## 🔄 Bước 4: Update CORS (2 phút)

### 4.1. Update CORS trong Railway

1. Vào Railway project → **Variables**
2. Tìm `CORS_ORIGIN`
3. Update giá trị thành frontend URL:
   ```
   CORS_ORIGIN=https://your-app.vercel.app
   ```
4. Railway sẽ tự restart với config mới

### 4.2. Test CORS

Mở browser console trên frontend, thử login → không có CORS error là OK

---

## ✅ Bước 5: Test toàn bộ hệ thống

1. **Frontend**: Mở URL Vercel
2. **Đăng ký** tài khoản mới
3. **Đăng nhập**
4. **Tạo bài tập** (nếu là teacher)
5. **Nộp bài** (nếu là student)
6. Kiểm tra **AI grading** hoạt động

---

## 🐛 Troubleshooting

### Backend không start
- Kiểm tra logs trong Railway
- Kiểm tra environment variables đã đủ chưa
- Kiểm tra MongoDB connection string

### Frontend không kết nối được backend
- Kiểm tra `VITE_API_BASE_URL` trong Vercel
- Kiểm tra CORS trong Railway
- Mở browser console xem lỗi gì

### MongoDB connection failed
- Kiểm tra IP whitelist trong Atlas (phải allow 0.0.0.0/0)
- Kiểm tra username/password trong connection string
- Kiểm tra cluster đã start chưa

### S3 upload failed
- Kiểm tra AWS credentials
- Kiểm tra bucket name và region
- Kiểm tra bucket permissions

---

## 📊 Monitoring

### Railway
- **Metrics**: Xem CPU, Memory, Network
- **Logs**: Xem real-time logs
- **Deployments**: Xem lịch sử deploy

### Vercel
- **Analytics**: Xem traffic, performance
- **Logs**: Xem build logs, function logs
- **Deployments**: Xem lịch sử deploy

---

## 💰 Chi phí ước tính

| Service | Free Tier | Paid |
|---------|-----------|------|
| **Vercel** | 100GB bandwidth/tháng | $20/tháng (Pro) |
| **Railway** | $5 credit/tháng | ~$5-10/tháng |
| **MongoDB Atlas** | 512MB storage | $9/tháng (M2) |
| **AWS S3** | 5GB free | ~$0.023/GB |
| **Tổng** | **~$0/tháng** | **~$20-40/tháng** |

---

## 🎉 Hoàn thành!

Sau khi deploy xong, bạn sẽ có:
- ✅ Frontend: `https://your-app.vercel.app`
- ✅ Backend: `https://your-backend.railway.app`
- ✅ Database: MongoDB Atlas
- ✅ Storage: AWS S3
- ✅ Auto-deploy: Push code → tự động deploy

**Chúc mừng! 🚀**
