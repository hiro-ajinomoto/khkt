# 🚀 Đề xuất Phương án Deploy

## 📊 Tổng quan dự án
- **Backend**: Node.js/Express, MongoDB, AWS S3, OpenAI API
- **Frontend**: React/Vite
- **Database**: MongoDB
- **Storage**: AWS S3 (đã có)

---

## 🏆 Phương án được đề xuất

### **Option 0: EC2 (Full-stack trên một server)** ⭐⭐ RECOMMENDED FOR CONTROL

#### Ưu điểm:
- ✅ **Kiểm soát hoàn toàn** server và cấu hình
- ✅ **Chi phí thấp** sau free tier (~$10-20/tháng)
- ✅ **Deploy một lần** cả frontend và backend
- ✅ **Không phụ thuộc** vào third-party services
- ✅ **Dễ scale** khi cần (upgrade instance type)
- ✅ **Free tier 12 tháng** đầu (t2.micro)

#### Nhược điểm:
- ❌ Cần kiến thức Linux/Server
- ❌ Tự quản lý SSL, backup, monitoring
- ❌ Cần setup ban đầu (15-20 phút)

#### Chi phí:
- **EC2 t2.micro**: Free 12 tháng đầu, sau đó ~$10/tháng
- **EBS Storage**: 30GB free, sau đó ~$3/tháng
- **MongoDB Atlas**: Free (M0) hoặc ~$9/tháng
- **Tổng**: **~$0/tháng** (Free Tier) hoặc **~$20-30/tháng**

#### Hướng dẫn:
- Xem file **`EC2_QUICK_START.md`** để deploy trong 15-20 phút
- Hoặc xem **`DEPLOY_EC2.md`** để hướng dẫn chi tiết

---

### **Option 1: Vercel (Frontend) + Railway (Backend)** ⭐ RECOMMENDED FOR EASE

#### Ưu điểm:
- ✅ **Miễn phí** cho dự án nhỏ/trung bình
- ✅ **Deploy tự động** từ GitHub (push code = auto deploy)
- ✅ **HTTPS tự động**, domain miễn phí
- ✅ **CDN toàn cầu** cho frontend (Vercel)
- ✅ **Dễ setup**, không cần config phức tạp
- ✅ **MongoDB Atlas** free tier 512MB (đủ cho MVP)

#### Chi phí:
- **Vercel**: Free (100GB bandwidth/tháng)
- **Railway**: Free $5 credit/tháng, sau đó ~$5-10/tháng
- **MongoDB Atlas**: Free (M0 cluster)
- **AWS S3**: ~$0.023/GB/tháng (đã có)

#### Các bước deploy:

**1. Frontend (Vercel):**
```bash
cd fe/khkt
npm run build
# Upload dist/ lên Vercel hoặc connect GitHub repo
```

**2. Backend (Railway):**
- Connect GitHub repo
- Railway tự detect Node.js
- Thêm environment variables
- Deploy tự động

**3. MongoDB Atlas:**
- Tạo cluster miễn phí
- Lấy connection string
- Update `MONGODB_URI` trong Railway

---

### **Option 2: Render.com (Full-stack)** ⭐ ALTERNATIVE

#### Ưu điểm:
- ✅ **Free tier** cho cả frontend và backend
- ✅ **Auto-deploy** từ GitHub
- ✅ **HTTPS tự động**
- ✅ **Dễ dùng**, UI đơn giản
- ✅ **PostgreSQL/MongoDB** có sẵn (hoặc dùng Atlas)

#### Chi phí:
- **Free tier**: 
  - Web service: Sleep sau 15 phút không dùng
  - Database: Free PostgreSQL (không sleep)
- **Paid**: $7/tháng cho web service (không sleep)

#### Các bước deploy:
1. Tạo **Web Service** cho backend
2. Tạo **Static Site** cho frontend
3. Connect GitHub, set environment variables
4. Deploy!

---

### **Option 3: AWS (EC2/ECS + S3)** 💼 ENTERPRISE

#### Ưu điểm:
- ✅ **Đã có S3** rồi, dùng luôn AWS ecosystem
- ✅ **Kiểm soát hoàn toàn**
- ✅ **Scale tốt** cho production lớn
- ✅ **AWS Free Tier** 12 tháng đầu

#### Nhược điểm:
- ❌ **Phức tạp hơn**, cần kiến thức AWS
- ❌ **Chi phí cao hơn** nếu scale lớn
- ❌ **Cần setup** EC2, Load Balancer, RDS, etc.

#### Chi phí ước tính:
- **EC2 t2.micro**: Free 12 tháng đầu, sau đó ~$10/tháng
- **RDS MongoDB**: ~$15-30/tháng
- **S3**: Đã có
- **Route 53**: ~$0.50/tháng/domain

---

### **Option 4: Docker + Fly.io** 🐳 MODERN

#### Ưu điểm:
- ✅ **Containerized**, dễ scale
- ✅ **Global edge network**
- ✅ **Free tier** 3 VMs
- ✅ **Deploy nhanh** với Docker

#### Nhược điểm:
- ❌ Cần tạo Dockerfile
- ❌ Free tier giới hạn

---

## 📝 So sánh nhanh

| Phương án | Độ khó | Chi phí/tháng | Tốc độ deploy | Phù hợp |
|-----------|--------|---------------|---------------|---------|
| **EC2 (Full-stack)** | ⭐⭐ Trung bình | $0-30 | ⚡⚡ Nhanh | Production, Control |
| **Vercel + Railway** | ⭐ Dễ | $0-10 | ⚡⚡⚡ Rất nhanh | MVP, Startup |
| **Render.com** | ⭐ Dễ | $0-7 | ⚡⚡⚡ Rất nhanh | MVP, Prototype |
| **AWS EC2 (Complex)** | ⭐⭐⭐ Khó | $25-50+ | ⚡ Chậm | Enterprise |
| **Fly.io** | ⭐⭐ Trung bình | $0-20 | ⚡⚡ Nhanh | Modern apps |

---

## 🎯 Khuyến nghị

### **Cho dự án hiện tại:**

**Nếu muốn kiểm soát hoàn toàn và deploy một lần: EC2 (Full-stack)**
- Xem **`EC2_QUICK_START.md`** để bắt đầu

**Nếu muốn deploy nhanh và dễ dàng: Vercel + Railway** 

**Lý do:**
1. ✅ **Tiện nhất**: Deploy trong 15 phút
2. ✅ **Miễn phí** cho giai đoạn đầu
3. ✅ **Auto-deploy** từ GitHub
4. ✅ **HTTPS tự động**
5. ✅ **Dễ maintain**

### **Các bước cụ thể:**

#### **Bước 1: Chuẩn bị**
```bash
# 1. Push code lên GitHub (nếu chưa có)
git remote add origin <your-github-repo>
git push -u origin main

# 2. Tạo MongoDB Atlas (free)
# - Vào https://www.mongodb.com/cloud/atlas
# - Tạo cluster M0 (free)
# - Lấy connection string
```

#### **Bước 2: Deploy Backend (Railway)**
1. Vào https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Chọn repo, chọn folder `be/`
4. Thêm environment variables:
   ```
   MONGODB_URI=mongodb+srv://...
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=ap-southeast-2
   AWS_S3_BUCKET_NAME=khkt-s3
   OPENAI_API_KEY=...
   JWT_SECRET=...
   PORT=8000
   ```
5. Railway tự deploy, lấy URL (ví dụ: `https://your-app.railway.app`)

#### **Bước 3: Deploy Frontend (Vercel)**
1. Vào https://vercel.com
2. "New Project" → Import GitHub repo
3. Root Directory: `fe/khkt`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Thêm environment variable:
   ```
   VITE_API_URL=https://your-app.railway.app
   ```
7. Deploy!

#### **Bước 4: Update Frontend API URL**
- Tạo file `fe/khkt/.env.production`:
  ```
  VITE_API_URL=https://your-backend.railway.app
  ```
- Hoặc dùng Vercel environment variables

---

## 🔧 Files cần tạo thêm

### 1. `be/Dockerfile` (nếu dùng Docker)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8000
CMD ["node", "src/index.js"]
```

### 2. `be/.dockerignore`
```
node_modules
uploads
.env
.git
```

### 3. `fe/khkt/.env.production`
```
VITE_API_URL=https://your-backend-url.com
```

### 4. `be/railway.json` (Railway config)
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 📚 Tài liệu tham khảo

- **Vercel**: https://vercel.com/docs
- **Railway**: https://docs.railway.app
- **Render**: https://render.com/docs
- **MongoDB Atlas**: https://www.mongodb.com/docs/atlas

---

## ⚠️ Lưu ý quan trọng

1. **Environment Variables**: Không commit `.env` vào Git
2. **CORS**: Update `BASE_URL` trong backend để cho phép frontend domain
3. **MongoDB**: Dùng Atlas connection string với IP whitelist
4. **S3**: Đảm bảo bucket có public access hoặc dùng presigned URLs
5. **JWT Secret**: Dùng secret mạnh trong production
6. **HTTPS**: Tất cả services đều có HTTPS tự động

---

## 🚀 Quick Start (Vercel + Railway)

```bash
# 1. Setup MongoDB Atlas
# 2. Deploy backend trên Railway
# 3. Deploy frontend trên Vercel
# 4. Update CORS và API URL
# 5. Done! 🎉
```

**Thời gian ước tính: 15-30 phút**
