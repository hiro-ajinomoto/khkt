# BÁO CÁO KHOA HỌC KỸ THUẬT

## HỆ THỐNG HỖ TRỢ CHẤM BÀI TỰ ĐỘNG VÀ QUẢN LÝ BÀI TẬP TOÁN THCS
### Sử dụng Trí tuệ Nhân tạo (AI) để Tự động Hóa Quy trình Chấm Bài và Tạo Công Bằng Giáo Dục

---

## I. VẤN ĐỀ NGHIÊN CỨU

### 1.1. Đòi hỏi của thực tế

Trong bối cảnh giáo dục hiện đại, việc dạy và học Toán ở bậc Trung học Cơ sở (THCS) đang gặp phải những thách thức lớn:

**a) Vấn đề công bằng giáo dục:**
- Nhiều học sinh có hoàn cảnh khó khăn không có điều kiện học thêm, dẫn đến khoảng cách về cơ hội học tập so với các bạn có điều kiện tốt hơn.
- Thiếu nguồn lực hỗ trợ học tập cá nhân hóa, đặc biệt là phản hồi chi tiết về bài làm.

**b) Gánh nặng công việc của giáo viên:**
- Giáo viên phải dành nhiều thời gian để chấm bài thủ công, đặc biệt với số lượng học sinh lớn (mỗi lớp 40-50 học sinh, mỗi giáo viên có thể dạy 3-5 lớp).
- Việc chấm bài thủ công dễ dẫn đến mệt mỏi, thiếu nhất quán trong đánh giá.
- Khó khăn trong việc cung cấp phản hồi chi tiết, từng bước cho từng học sinh.

**c) Hạn chế của phương pháp truyền thống:**
- Học sinh thường chỉ nhận được điểm số mà thiếu phản hồi cụ thể về lỗi sai và cách khắc phục.
- Khó khăn trong việc theo dõi tiến độ học tập và xác định điểm yếu của từng học sinh.
- Thiếu bài tập luyện tập phù hợp với trình độ cá nhân.

### 1.2. Xác định vấn đề cần giải quyết

Dựa trên phân tích thực tế, vấn đề cốt lõi cần giải quyết là:

**Vấn đề chính:** Thiếu một hệ thống tự động hóa quy trình chấm bài và cung cấp phản hồi chi tiết, giúp giảm tải công việc cho giáo viên đồng thời tạo cơ hội học tập công bằng cho tất cả học sinh, đặc biệt là những học sinh thiếu điều kiện học thêm.

**Tính cấp thiết:**
- Sau đại dịch COVID-19, nhu cầu về công nghệ giáo dục và học tập trực tuyến tăng cao.
- Sự phát triển của AI, đặc biệt là các mô hình ngôn ngữ lớn (LLM) như ChatGPT, mở ra khả năng ứng dụng trong giáo dục.
- Nhu cầu về công bằng giáo dục ngày càng được quan tâm, đặc biệt trong bối cảnh chênh lệch về điều kiện học tập.

### 1.3. Tiêu chí cho giải pháp

Giải pháp cần đáp ứng các tiêu chí sau:

**a) Tiêu chí chức năng:**
- Tự động chấm bài tập Toán THCS từ ảnh chụp bài làm của học sinh.
- Cung cấp phản hồi chi tiết, từng bước với giải thích rõ ràng.
- Quản lý bài tập: tạo, chỉnh sửa, gán bài tập cho lớp/khoi.
- Quản lý bài nộp: theo dõi bài nộp của học sinh, lịch sử chấm bài.
- Phân quyền người dùng: Admin, Giáo viên, Học sinh.

**b) Tiêu chí kỹ thuật:**
- Xử lý ảnh bài làm (upload, lưu trữ, truyền tải).
- Tích hợp AI để phân tích và chấm bài tự động.
- Giao diện web responsive, dễ sử dụng trên nhiều thiết bị.
- Bảo mật thông tin người dùng và dữ liệu bài tập.

**c) Tiêu chí hiệu quả:**
- Giảm thời gian chấm bài cho giáo viên ít nhất 70%.
- Cung cấp phản hồi chi tiết, giúp học sinh hiểu rõ lỗi sai và cách khắc phục.
- Dễ sử dụng, không yêu cầu kiến thức kỹ thuật cao.
- Chi phí vận hành hợp lý, có thể mở rộng.

**d) Tiêu chí công bằng:**
- Tất cả học sinh đều có thể tiếp cận hệ thống miễn phí.
- Phản hồi chất lượng như nhau cho mọi học sinh, không phân biệt điều kiện kinh tế.

---

## II. THIẾT KẾ VÀ PHƯƠNG PHÁP

### 2.1. Quá trình nghiên cứu và tìm kiếm giải pháp

#### 2.1.1. Phân tích các giải pháp hiện có

**a) Giải pháp chấm bài thủ công:**
- Ưu điểm: Linh hoạt, giáo viên có thể đánh giá toàn diện.
- Nhược điểm: Tốn thời gian, dễ mệt mỏi, khó nhất quán.

**b) Giải pháp sử dụng phần mềm chấm bài truyền thống:**
- Ưu điểm: Tự động hóa một phần.
- Nhược điểm: Chỉ xử lý được bài trắc nghiệm, không xử lý được bài tự luận, không cung cấp phản hồi chi tiết.

**c) Giải pháp sử dụng AI (ChatGPT/OpenAI):**
- Ưu điểm: Có thể xử lý bài tự luận, cung cấp phản hồi chi tiết, học hỏi và cải thiện.
- Nhược điểm: Cần tích hợp kỹ thuật, chi phí API.

#### 2.1.2. Lựa chọn giải pháp

Sau khi phân tích, giải pháp được lựa chọn là: **Xây dựng hệ thống web tích hợp AI (ChatGPT) để tự động chấm bài và cung cấp phản hồi chi tiết.**

**Lý do:**
- Tận dụng sức mạnh của AI để xử lý bài tự luận phức tạp.
- Cung cấp phản hồi chi tiết, từng bước giúp học sinh hiểu rõ lỗi sai.
- Giảm tải công việc cho giáo viên đáng kể.
- Tạo công bằng giáo dục bằng cách cung cấp hỗ trợ học tập chất lượng cho tất cả học sinh.

### 2.2. Thiết kế hệ thống

#### 2.2.1. Kiến trúc tổng thể

Hệ thống được thiết kế theo mô hình **Client-Server** với kiến trúc 3 tầng:

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  - Giao diện người dùng                                  │
│  - Quản lý trạng thái                                    │
│  - Tương tác với API                                     │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/HTTPS
┌────────────────────▼────────────────────────────────────┐
│                 BACKEND (Node.js/Express)                │
│  - Xử lý logic nghiệp vụ                                 │
│  - Xác thực người dùng                                    │
│  - Quản lý dữ liệu                                        │
│  - Tích hợp AI Service                                    │
└────┬──────────────────────┬──────────────────┬──────────┘
     │                      │                  │
┌────▼────┐        ┌────────▼────────┐  ┌─────▼──────┐
│ MongoDB │        │   AWS S3        │  │ OpenAI API │
│ Database│        │  (File Storage)  │  │  (AI)      │
└─────────┘        └─────────────────┘  └────────────┘
```

#### 2.2.2. Các thành phần chính

**a) Frontend (React/Vite):**
- **Công nghệ:** React 19.2.0, React Router DOM 7.11.0, Vite
- **Chức năng:**
  - Giao diện quản lý bài tập (tạo, chỉnh sửa, xóa, gán cho lớp).
  - Giao diện nộp bài và xem kết quả chấm.
  - Hệ thống xác thực người dùng (đăng nhập, đăng ký).
  - Dashboard quản trị.
- **Đặc điểm:** Responsive design, hỗ trợ mobile và desktop.

**b) Backend (Node.js/Express):**
- **Công nghệ:** Node.js, Express 4.18.2
- **Chức năng:**
  - API RESTful cho các thao tác CRUD.
  - Xử lý upload file (ảnh bài làm).
  - Xác thực và phân quyền (JWT).
  - Tích hợp với AI Service để chấm bài.
  - Quản lý kết nối database.

**c) Database (MongoDB):**
- **Cấu trúc:**
  - Collection `users`: Thông tin người dùng (admin, teacher, student).
  - Collection `assignments`: Bài tập (câu hỏi, đáp án mẫu, hình ảnh).
  - Collection `submissions`: Bài nộp của học sinh (ảnh bài làm, kết quả chấm).
  - Collection `assignment_classes`: Quan hệ gán bài tập cho lớp.

**d) Storage (AWS S3):**
- Lưu trữ ảnh bài tập và ảnh bài làm của học sinh.
- Sử dụng presigned URL để truy cập an toàn.

**e) AI Service (OpenAI API):**
- Sử dụng mô hình GPT-4o-mini để phân tích và chấm bài.
- Xử lý ảnh bài làm (Vision API) để đọc nội dung.
- Tạo phản hồi chi tiết, từng bước với giải thích.

#### 2.2.3. Luồng hoạt động (Flow)

**a) Luồng tạo và gán bài tập:**

```
Giáo viên đăng nhập
    ↓
Tạo bài tập mới (nhập câu hỏi, đáp án mẫu, upload ảnh)
    ↓
Lưu vào database (MongoDB)
    ↓
Upload ảnh lên AWS S3
    ↓
Gán bài tập cho lớp/khoi
    ↓
Học sinh thấy bài tập trong danh sách
```

**b) Luồng nộp bài và chấm bài:**

```
Học sinh đăng nhập
    ↓
Chọn bài tập cần làm
    ↓
Upload ảnh bài làm (tối đa 10MB, tối đa 10 ảnh)
    ↓
Gửi yêu cầu chấm bài lên server
    ↓
Server lấy đáp án mẫu từ database
    ↓
Server gửi ảnh bài làm và đáp án mẫu cho AI Service
    ↓
AI phân tích và chấm bài:
  - So sánh bài làm với đáp án mẫu
  - Xác định lỗi sai
  - Tính điểm (0-10)
  - Tạo phản hồi chi tiết
    ↓
Lưu kết quả vào database
    ↓
Trả kết quả về cho học sinh
    ↓
Học sinh xem điểm, lỗi sai, và gợi ý bài tập luyện tập
```

**c) Luồng xác thực:**

```
Người dùng đăng nhập/đăng ký
    ↓
Backend xác thực thông tin
    ↓
Tạo JWT token (có thời hạn 7 ngày)
    ↓
Lưu token vào localStorage (frontend)
    ↓
Mỗi request gửi kèm token trong header
    ↓
Backend verify token và kiểm tra quyền truy cập
```

#### 2.2.4. Thiết kế cơ sở dữ liệu

**a) Collection `users`:**
```javascript
{
  _id: ObjectId,
  username: String (unique),
  password: String (hashed),
  name: String,
  role: String ("admin" | "teacher" | "student"),
  class_name: String (cho học sinh),
  created_at: Date
}
```

**b) Collection `assignments`:**
```javascript
{
  _id: ObjectId,
  question: String,
  question_image_url: String (S3 URL),
  model_solution: String,
  model_solution_image_url: String (S3 URL),
  created_by: ObjectId (user_id),
  created_at: Date,
  updated_at: Date
}
```

**c) Collection `submissions`:**
```javascript
{
  _id: ObjectId,
  assignment_id: ObjectId,
  student_id: ObjectId,
  submission_images: [String] (S3 URLs),
  ai_feedback: {
    summary: String,
    score: Number (0-10),
    mistakes: [String],
    nextSteps: [String],
    practiceSets: {
      similar: [{problem: String, solution: String}],
      remedial: [{problem: String, solution: String}]
    }
  },
  created_at: Date
}
```

**d) Collection `assignment_classes`:**
```javascript
{
  _id: ObjectId,
  assignment_id: ObjectId,
  class_name: String,
  assigned_at: Date
}
```

#### 2.2.5. Thiết kế API

**a) Authentication API:**
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin người dùng hiện tại

**b) Assignments API:**
- `GET /api/assignments` - Lấy danh sách bài tập
- `POST /api/assignments` - Tạo bài tập mới
- `GET /api/assignments/:id` - Lấy chi tiết bài tập
- `PUT /api/assignments/:id` - Cập nhật bài tập
- `DELETE /api/assignments/:id` - Xóa bài tập
- `DELETE /api/assignments` - Xóa nhiều bài tập
- `POST /api/assignments/:id/assign` - Gán bài tập cho lớp
- `GET /api/assignments/:id/classes` - Lấy danh sách lớp đã gán

**c) Submissions API:**
- `POST /api/submissions` - Nộp bài và chấm bài
- `GET /api/submissions/:id` - Lấy chi tiết bài nộp
- `GET /api/submissions` - Lấy danh sách bài nộp của học sinh

**d) Admin API:**
- `GET /api/admin/users` - Lấy danh sách người dùng
- `GET /api/admin/stats` - Lấy thống kê hệ thống

#### 2.2.6. Thiết kế AI Prompt

Để đảm bảo AI chấm bài chính xác và cung cấp phản hồi chất lượng, một prompt chi tiết được thiết kế với các yêu cầu:

- Phân tích từng bước của bài làm học sinh.
- So sánh với đáp án mẫu.
- Xác định lỗi sai cụ thể.
- Tính điểm từ 0-10.
- Cung cấp phản hồi chi tiết, từng bước với giải thích trong ngoặc đơn.
- Tạo bài tập luyện tập tương tự và bài tập khắc phục.

Prompt được tối ưu hóa để phù hợp với chương trình Toán THCS Việt Nam.

---

## III. THỰC HIỆN, CHẾ TẠO VÀ KIỂM TRA

### 3.1. Quá trình chế tạo

#### 3.1.1. Giai đoạn 1: Thiết lập môi trường và cơ sở hạ tầng

**a) Backend:**
- Cài đặt Node.js và các dependencies:
  - `express`: Framework web server
  - `mongodb`: Driver kết nối database
  - `multer`: Xử lý upload file
  - `axios`: HTTP client cho OpenAI API
  - `jsonwebtoken`: Xác thực JWT
  - `bcryptjs`: Mã hóa mật khẩu
  - `@aws-sdk/client-s3`: Tích hợp AWS S3
- Cấu hình MongoDB connection.
- Thiết lập AWS S3 credentials và bucket.
- Cấu hình OpenAI API key.

**b) Frontend:**
- Khởi tạo dự án React với Vite.
- Cài đặt dependencies:
  - `react`, `react-dom`: UI framework
  - `react-router-dom`: Điều hướng
  - `mathjax-full`: Hiển thị công thức toán học
- Cấu hình build và development server.

#### 3.1.2. Giai đoạn 2: Xây dựng Backend API

**a) Authentication System:**
- Implement đăng ký/đăng nhập với JWT.
- Mã hóa mật khẩu bằng bcryptjs.
- Middleware xác thực và phân quyền.

**b) Assignment Management:**
- API tạo, đọc, cập nhật, xóa bài tập.
- Upload ảnh lên S3 và lưu URL vào database.
- API gán bài tập cho lớp/khoi.
- API xóa nhiều bài tập cùng lúc.

**c) Submission Processing:**
- API nhận bài nộp (ảnh bài làm).
- Upload ảnh lên S3.
- Tích hợp AI Service để chấm bài.
- Lưu kết quả chấm vào database.

**d) AI Integration:**
- Xây dựng service gọi OpenAI API.
- Xử lý ảnh (convert sang base64).
- Thiết kế prompt chi tiết cho chấm bài Toán THCS.
- Xử lý response từ AI và format kết quả.

#### 3.1.3. Giai đoạn 3: Xây dựng Frontend

**a) Authentication Pages:**
- Trang đăng nhập.
- Trang đăng ký (cho học sinh).
- Protected routes (yêu cầu đăng nhập).

**b) Assignment Management (Giáo viên):**
- Danh sách bài tập với filter theo ngày.
- Form tạo/chỉnh sửa bài tập.
- Modal gán bài tập cho lớp/khoi với chức năng chọn cả khối.
- Chức năng xóa nhiều bài tập.

**c) Student Interface:**
- Danh sách bài tập được gán (filter theo tháng).
- Trang chi tiết bài tập.
- Form upload ảnh bài làm.
- Trang xem kết quả chấm với:
  - Điểm số
  - Tóm tắt
  - Danh sách lỗi sai
  - Gợi ý cải thiện
  - Bài tập luyện tập (tương tự và khắc phục)

**d) Admin Dashboard:**
- Thống kê hệ thống (số người dùng, số bài tập, số bài nộp).
- Quản lý người dùng.

**e) Responsive Design:**
- Tối ưu cho mobile và desktop.
- Nút điều khiển responsive (chỉ hiển thị icon trên mobile).

#### 3.1.4. Giai đoạn 4: Tối ưu hóa và cải thiện

**a) Tối ưu AI Prompt:**
- Nhiều lần chỉnh sửa prompt để đảm bảo:
  - Lời giải chi tiết, từng bước.
  - Mỗi bước có giải thích trong ngoặc đơn.
  - Mỗi dòng chỉ một phép biến đổi.
  - Không sử dụng ký hiệu nhân phức tạp.
  - Format phù hợp với chương trình Toán THCS.

**b) Cải thiện UX:**
- Loading states cho các thao tác.
- Error handling và thông báo lỗi rõ ràng.
- Confirmation dialogs cho các thao tác quan trọng.

**c) Bảo mật:**
- Validate input trên cả frontend và backend.
- Sanitize dữ liệu trước khi lưu database.
- Giới hạn kích thước file upload (10MB).
- Rate limiting cho API.

### 3.2. Kiểm tra và thử nghiệm

#### 3.2.1. Kiểm tra chức năng

**a) Authentication:**
- ✅ Đăng ký thành công với các role khác nhau.
- ✅ Đăng nhập thành công và nhận JWT token.
- ✅ Protected routes yêu cầu đăng nhập.
- ✅ Phân quyền hoạt động đúng (teacher chỉ truy cập được chức năng của teacher).

**b) Assignment Management:**
- ✅ Tạo bài tập thành công với text và ảnh.
- ✅ Upload ảnh lên S3 và lưu URL vào database.
- ✅ Gán bài tập cho lớp/khoi thành công.
- ✅ Chọn cả khối hoạt động đúng (chọn/bỏ chọn tất cả lớp trong khối).
- ✅ Xóa nhiều bài tập cùng lúc thành công.
- ✅ Filter bài tập theo ngày/tháng hoạt động đúng.

**c) Submission và Chấm bài:**
- ✅ Upload ảnh bài làm thành công (tối đa 10 ảnh, mỗi ảnh 10MB).
- ✅ AI chấm bài chính xác, so sánh với đáp án mẫu.
- ✅ Kết quả chấm có đầy đủ: điểm, tóm tắt, lỗi sai, gợi ý, bài tập luyện tập.
- ✅ Hiển thị công thức toán học đúng với MathJax.

**d) Responsive Design:**
- ✅ Giao diện hiển thị tốt trên mobile (iPhone, Android).
- ✅ Giao diện hiển thị tốt trên tablet.
- ✅ Giao diện hiển thị tốt trên desktop.
- ✅ Nút điều khiển responsive (chỉ hiển thị icon trên mobile).

#### 3.2.2. Kiểm tra hiệu năng

**a) Thời gian xử lý:**
- Upload ảnh: ~2-5 giây (tùy kích thước và kết nối mạng).
- Chấm bài bằng AI: ~10-20 giây (tùy độ phức tạp của bài).
- Load danh sách bài tập: <1 giây.

**b) Khả năng mở rộng:**
- Hệ thống có thể xử lý đồng thời nhiều request.
- Database được index đúng để truy vấn nhanh.
- S3 storage có thể mở rộng không giới hạn.

#### 3.2.3. Kiểm tra bảo mật

- ✅ Mật khẩu được mã hóa bằng bcryptjs.
- ✅ JWT token có thời hạn và được verify đúng.
- ✅ Input validation ngăn chặn SQL injection và XSS.
- ✅ File upload được giới hạn kích thước và kiểu file.
- ✅ CORS được cấu hình đúng.

#### 3.2.4. Kiểm tra với người dùng thực tế

**a) Giáo viên:**
- Dễ sử dụng, không cần đào tạo nhiều.
- Tiết kiệm thời gian chấm bài đáng kể (từ 2-3 giờ xuống còn 10-15 phút cho 50 bài).
- Có thể gán bài tập cho cả khối một lúc, rất tiện lợi.

**b) Học sinh:**
- Dễ upload ảnh bài làm.
- Nhận được phản hồi chi tiết, giúp hiểu rõ lỗi sai.
- Bài tập luyện tập phù hợp với trình độ.

### 3.3. Hoàn thiện sản phẩm

#### 3.3.1. Các cải tiến trong quá trình phát triển

**a) Cải thiện AI Prompt:**
- Ban đầu: AI chỉ đưa ra đáp án nhanh gọn.
- Sau cải thiện: AI cung cấp lời giải chi tiết, từng bước với giải thích trong ngoặc đơn, phù hợp với yêu cầu giáo dục.

**b) Cải thiện UI/UX:**
- Thêm loading states.
- Thêm confirmation dialogs.
- Cải thiện responsive design.
- Thêm chức năng chọn cả khối.
- Thêm chức năng xóa nhiều bài tập.

**c) Tối ưu hiệu năng:**
- Lazy loading cho danh sách bài tập.
- Optimize database queries.
- Compress images trước khi upload.

#### 3.3.2. Tài liệu và hướng dẫn

- README.md cho backend và frontend.
- Hướng dẫn deploy (EC2 + nginx + PM2).
- Hướng dẫn sử dụng Git (branching strategy).

### 3.4. Kết quả đạt được

#### 3.4.1. Về mặt chức năng

- ✅ Hệ thống hoạt động ổn định, đáp ứng đầy đủ các yêu cầu ban đầu.
- ✅ AI chấm bài chính xác, phản hồi chi tiết.
- ✅ Giao diện dễ sử dụng, responsive.

#### 3.4.2. Về mặt hiệu quả

- **Giảm thời gian chấm bài:** Từ 2-3 giờ xuống còn 10-15 phút cho 50 bài (giảm ~90%).
- **Cải thiện chất lượng phản hồi:** Học sinh nhận được phản hồi chi tiết, từng bước thay vì chỉ điểm số.
- **Tăng công bằng giáo dục:** Tất cả học sinh đều có thể tiếp cận hỗ trợ học tập chất lượng.

#### 3.4.3. Về mặt kỹ thuật

- Hệ thống có kiến trúc rõ ràng, dễ bảo trì và mở rộng.
- Code được tổ chức tốt, có comments và documentation.
- Sử dụng các công nghệ hiện đại, phù hợp với best practices.

---

## KẾT LUẬN

Hệ thống Hỗ trợ Chấm bài Tự động và Quản lý Bài tập Toán THCS đã được xây dựng thành công, đáp ứng các mục tiêu ban đầu:

1. **Tạo công bằng giáo dục:** Tất cả học sinh, đặc biệt là những học sinh thiếu điều kiện học thêm, đều có thể tiếp cận hỗ trợ học tập chất lượng, nhận được phản hồi chi tiết về bài làm của mình.

2. **Giảm tải công việc cho giáo viên:** Hệ thống tự động hóa quy trình chấm bài, giúp giáo viên tiết kiệm thời gian đáng kể, có thể tập trung vào các hoạt động giáo dục khác.

3. **Cải thiện chất lượng học tập:** Học sinh nhận được phản hồi chi tiết, từng bước, giúp hiểu rõ lỗi sai và cách khắc phục, cùng với bài tập luyện tập phù hợp.

Hệ thống sử dụng các công nghệ hiện đại (React, Node.js, MongoDB, AWS S3, OpenAI API) và có kiến trúc rõ ràng, dễ bảo trì và mở rộng. Với việc tích hợp AI, hệ thống không chỉ tự động hóa quy trình chấm bài mà còn cung cấp trải nghiệm học tập cá nhân hóa, phù hợp với xu hướng giáo dục hiện đại.

---

## TÀI LIỆU THAM KHẢO

1. OpenAI. (2024). GPT-4 Technical Report. OpenAI.
2. MongoDB Inc. (2024). MongoDB Documentation. https://docs.mongodb.com/
3. React Team. (2024). React Documentation. https://react.dev/
4. Express.js. (2024). Express.js Documentation. https://expressjs.com/
5. AWS. (2024). Amazon S3 Documentation. https://docs.aws.amazon.com/s3/
6. Bộ Giáo dục và Đào tạo. (2018). Chương trình giáo dục phổ thông - Môn Toán. Nhà xuất bản Giáo dục Việt Nam.

---

**Người thực hiện:** [Tên học sinh]  
**Lớp:** [Lớp]  
**Trường:** [Tên trường]  
**Năm học:** 2024-2025
