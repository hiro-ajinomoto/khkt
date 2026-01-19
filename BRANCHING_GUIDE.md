# 🌿 Hướng dẫn sử dụng nhánh Git

## 📋 Cấu trúc nhánh

### `main` (Production)
- **Mục đích:** Code ổn định, đã test kỹ
- **Sử dụng:** Deploy lên production
- **Quy tắc:** Chỉ merge từ `minor` khi đã test xong

### `minor` (Development/Updates)
- **Mục đích:** Phát triển các tính năng mới, sửa lỗi
- **Sử dụng:** Làm việc hàng ngày, tạo các bản cập nhật
- **Quy tắc:** Merge vào `main` khi hoàn thành và test xong

---

## 🚀 Workflow cơ bản

### 1. Làm việc trên nhánh `minor`

```bash
# Chuyển sang nhánh minor
git checkout minor

# Pull code mới nhất
git pull origin minor

# Tạo nhánh mới cho tính năng (tùy chọn)
git checkout -b feature/tên-tính-năng

# Hoặc làm việc trực tiếp trên minor
# ... code, commit, push ...
```

### 2. Commit và push lên `minor`

```bash
# Xem thay đổi
git status

# Thêm file
git add -A

# Commit
git commit -m "feat: Mô tả tính năng mới"
# hoặc
git commit -m "fix: Mô tả sửa lỗi"

# Push lên remote
git push origin minor
```

### 3. Merge `minor` vào `main` (khi sẵn sàng)

```bash
# Chuyển sang main
git checkout main

# Pull code mới nhất
git pull origin main

# Merge minor vào main
git merge minor

# Push lên remote
git push origin main

# Quay lại minor để tiếp tục làm việc
git checkout minor
```

---

## 📝 Quy ước commit message

### Format:
```
<type>: <mô tả ngắn gọn>

<giải thích chi tiết (tùy chọn)>
```

### Types:
- `feat:` - Tính năng mới
- `fix:` - Sửa lỗi
- `docs:` - Cập nhật tài liệu
- `style:` - Format code, không ảnh hưởng logic
- `refactor:` - Refactor code
- `test:` - Thêm/sửa test
- `chore:` - Cập nhật build, config, dependencies

### Ví dụ:
```bash
git commit -m "feat: Thêm chức năng export báo cáo"
git commit -m "fix: Sửa lỗi upload file trên mobile"
git commit -m "docs: Cập nhật hướng dẫn deploy"
```

---

## 🔄 Các tình huống thường gặp

### 1. Tạo nhánh mới cho tính năng cụ thể

```bash
# Từ minor
git checkout minor
git pull origin minor

# Tạo nhánh mới
git checkout -b feature/export-report

# Làm việc, commit...
git add -A
git commit -m "feat: Thêm export báo cáo"

# Push nhánh mới
git push -u origin feature/export-report

# Khi xong, merge vào minor
git checkout minor
git merge feature/export-report
git push origin minor

# Xóa nhánh local (tùy chọn)
git branch -d feature/export-report
```

### 2. Cập nhật minor từ main

```bash
# Nếu main có thay đổi mới
git checkout minor
git merge main
git push origin minor
```

### 3. Hotfix (sửa lỗi khẩn cấp trên production)

```bash
# Tạo nhánh hotfix từ main
git checkout main
git checkout -b hotfix/sửa-lỗi-khẩn-cấp

# Sửa lỗi, commit
git add -A
git commit -m "fix: Sửa lỗi khẩn cấp"

# Merge vào main
git checkout main
git merge hotfix/sửa-lỗi-khẩn-cấp
git push origin main

# Merge vào minor
git checkout minor
git merge hotfix/sửa-lỗi-khẩn-cấp
git push origin minor
```

---

## 📊 Xem lịch sử và so sánh

### Xem commits trên mỗi nhánh:
```bash
# Xem commits trên minor
git log minor --oneline -10

# Xem commits trên main
git log main --oneline -10

# Xem commits khác nhau giữa minor và main
git log main..minor --oneline
```

### So sánh code:
```bash
# Xem diff giữa minor và main
git diff main..minor

# Xem file nào khác nhau
git diff --name-only main..minor
```

---

## 🎯 Best Practices

1. **Luôn pull trước khi push:**
   ```bash
   git pull origin minor
   git push origin minor
   ```

2. **Commit thường xuyên:**
   - Commit sau mỗi tính năng nhỏ hoàn thành
   - Commit message rõ ràng, mô tả đúng thay đổi

3. **Test trước khi merge vào main:**
   - Test kỹ trên nhánh minor
   - Chỉ merge vào main khi đã test xong

4. **Giữ main ổn định:**
   - Chỉ merge code đã test kỹ
   - Có thể dùng tag để đánh dấu version

---

## 🏷️ Tagging (Đánh dấu version)

### Tạo tag cho release:
```bash
# Trên nhánh main
git checkout main
git pull origin main

# Tạo tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Xem tags
git tag -l

# Xem thông tin tag
git show v1.0.0
```

### Semantic Versioning:
- `v1.0.0` - Major release (thay đổi lớn, breaking changes)
- `v1.1.0` - Minor release (tính năng mới, backward compatible)
- `v1.1.1` - Patch release (sửa lỗi)

---

## 📋 Checklist trước khi merge vào main

- [ ] Code đã được test kỹ
- [ ] Không có lỗi linter
- [ ] Commit messages rõ ràng
- [ ] Đã pull code mới nhất từ main
- [ ] Đã giải quyết conflicts (nếu có)
- [ ] Đã test trên môi trường tương tự production

---

## 🚨 Xử lý conflicts

### Khi merge có conflict:
```bash
# Merge minor vào main
git checkout main
git merge minor

# Nếu có conflict, Git sẽ báo
# Sửa file conflict, sau đó:
git add <file-đã-sửa>
git commit -m "Merge minor into main"

# Push
git push origin main
```

---

## 💡 Tips

1. **Sử dụng `.gitignore`** để bỏ qua file không cần thiết
2. **Không commit file nhạy cảm** (.env, keys, passwords)
3. **Review code** trước khi merge (nếu làm việc nhóm)
4. **Backup trước khi thao tác nguy hiểm** (force push, reset)

---

## 📚 Tài liệu tham khảo

- [Git Documentation](https://git-scm.com/doc)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [Conventional Commits](https://www.conventionalcommits.org/)
