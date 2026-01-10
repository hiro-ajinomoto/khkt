# KHKT Backend - Node.js/Express

AI Handwritten Math Grading Support System - Backend API

## Cấu trúc thư mục

```
be/
├── src/
│   ├── index.js              # Entry point
│   ├── config.js             # Configuration
│   ├── db.js                 # MongoDB connection
│   ├── routers/
│   │   ├── assignments.js    # Assignment endpoints
│   │   └── submissions.js    # Submission endpoints
│   └── services/
│       └── aiService.js       # ChatGPT integration
├── package.json
└── .env.example
```

## Cài đặt

1. **Cài đặt dependencies:**
```bash
cd be
npm install
```

2. **Tạo file `.env` từ `.env.example`:**
```bash
cp .env.example .env
```

3. **Cấu hình biến môi trường trong `.env`:**
- `MONGODB_URI`: MongoDB connection string
- `MONGODB_DB`: Database name (default: khkt_math_grader)
- `OPENAI_API_KEY`: OpenAI API key cho ChatGPT
- `IMAGE_UPLOAD_DIR`: Thư mục lưu ảnh (default: uploads)
- `PORT`: Port server (default: 8000)

## Chạy ứng dụng

**Development mode (với auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server sẽ chạy tại: `http://localhost:8000`

## API Endpoints

### Assignments
- `GET /assignments` - Lấy danh sách assignments
- `POST /assignments` - Tạo assignment mới

### Submissions
- `GET /submissions/:id` - Lấy submission theo ID
- `POST /submissions` - Tạo submission với upload ảnh (multipart/form-data)

### Health Check
- `GET /health` - Kiểm tra trạng thái server

## Dependencies chính

- **express**: Web framework
- **mongodb**: MongoDB driver
- **multer**: File upload handling
- **axios**: HTTP client cho ChatGPT API
- **dotenv**: Environment variables
- **cors**: CORS middleware
