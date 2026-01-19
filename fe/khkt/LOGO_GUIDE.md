# Hướng dẫn thêm Logo trường

## Bước 1: Đặt file logo

Đặt file logo của bạn vào một trong các vị trí sau:

### Option 1: Thư mục `public/` (Khuyến nghị)
```
fe/khkt/public/logo.png
```
- ✅ Truy cập trực tiếp: `/logo.png`
- ✅ Không cần import
- ✅ Phù hợp cho logo tĩnh

### Option 2: Thư mục `src/assets/`
```
fe/khkt/src/assets/logo.png
```
- ✅ Được Vite optimize
- ✅ Cần import trong component
- ✅ Phù hợp khi cần xử lý thêm

## Bước 2: Định dạng file

- **PNG**: Cho logo có nền trong suốt (khuyến nghị)
- **SVG**: Cho logo vector, chất lượng cao
- **JPG**: Cho logo có nền màu

**Kích thước khuyến nghị:**
- Logo header: 40-60px chiều cao
- Logo trang đăng nhập: 80-120px chiều cao

## Bước 3: Sử dụng logo trong code

### Nếu đặt trong `public/`:
```jsx
<img src="/logo.png" alt="Logo trường" className="logo" />
```

### Nếu đặt trong `src/assets/`:
```jsx
import logo from '../assets/logo.png';

<img src={logo} alt="Logo trường" className="logo" />
```

## Bước 4: Vị trí hiển thị logo

Logo có thể được thêm vào:

1. **Header của trang danh sách bài tập** (`AssignmentsList.jsx`)
   - Bên cạnh hoặc thay thế title "Danh sách bài tập"

2. **Trang đăng nhập/đăng ký** (`AuthPage.jsx`)
   - Ở đầu form, trên title

3. **Header admin** (`AdminDashboard.jsx`)
   - Bên cạnh title "Quản trị hệ thống"

4. **Favicon** (icon trên tab trình duyệt)
   - Đặt trong `public/` và cập nhật `index.html`

## CSS mẫu

```css
.logo {
  height: 50px; /* Điều chỉnh theo kích thước logo */
  width: auto;
  object-fit: contain;
}

.logo-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-header img {
  height: 40px;
  width: auto;
}

.logo-auth {
  display: block;
  margin: 0 auto 1.5rem;
  height: 80px;
  width: auto;
}
```

## Ví dụ: Thêm logo vào header

```jsx
<div className="assignments-header">
  <div className="logo-header">
    <img src="/logo.png" alt="Logo trường" className="logo" />
    <h1>Danh sách bài tập</h1>
  </div>
  {/* ... rest of header ... */}
</div>
```
