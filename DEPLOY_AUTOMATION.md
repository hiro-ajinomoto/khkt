# Deploy tự động — hướng dẫn set-up một lần duy nhất

Sau khi set xong mấy secret bên dưới, mỗi lần `git push origin main`:

- **Backend + Frontend (EC2 + nginx + PM2)**: GitHub Actions `deploy-ec2.yml` SSH vào EC2, `git pull`, rồi chạy `./deploy-ec2.sh` với scope tự suy từ path đã đổi:
  - Chỉ `fe/khkt/**` đổi → `frontend` (build Vite + rsync `dist/` ra nginx + reload nginx).
  - Chỉ `be/**` đổi → `backend` (`npm ci --omit=dev` + `pm2 reload`).
  - Đổi `deploy-ec2.sh` / `nginx.conf.example` / workflow → `all`.
- **CI**: `ci.yml` chạy lint/build trên mọi PR và push để chặn code hỏng vào main.

---

## 1. Tạo GitHub Secrets cho deploy EC2

Vào repo trên GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Tạo các secret sau:

| Tên secret | Giá trị | Bắt buộc |
|-----------|---------|---------|
| `EC2_HOST` | IP hoặc domain EC2, ví dụ `54.123.45.67` hoặc `api.khkt.com` | ✅ |
| `EC2_USER` | User SSH, mặc định Amazon Linux là `ec2-user` | ✅ |
| `EC2_SSH_KEY` | Nội dung **full** của file `ec2-keypair.pem` (gồm `-----BEGIN ...-----` đến `-----END ...-----`) | ✅ |
| `EC2_SSH_PORT` | Port SSH nếu khác 22 | ❌ |
| `HEALTHCHECK_SCHEME` | `http` hoặc `https` (mặc định `http`). Set `https` nếu đã cấu hình SSL Let's Encrypt | ❌ |

Mẹo copy nhanh nội dung PEM vào clipboard trên máy Mac (từ thư mục repo):

```bash
pbcopy < ec2-keypair.pem
```

Rồi paste vào ô giá trị của `EC2_SSH_KEY`.

> **An toàn**: `ec2-keypair.pem` đã có trong `.gitignore` nên không bao giờ bị push lên GitHub. Secret chỉ tồn tại dưới dạng encrypted trong GitHub Actions.

---

## 2. Tạo Environment "production" (tùy chọn, khuyến nghị)

`deploy-ec2.yml` dùng `environment: production`. Vào **Settings → Environments → New environment → production**. Ở đây bạn có thể:

- Bắt buộc **Required reviewers** phải approve trước khi deploy (nếu muốn thêm 1 bước duyệt tay).
- Gắn secrets riêng cho production (thay vì repo-wide).

Nếu không cần gate duyệt, chỉ cần tạo environment trống là được — workflow sẽ chạy ngay.

---

## 3. Chuẩn bị một lần trên EC2

Workflow giả định trên EC2 đã có sẵn (theo `DEPLOY_EC2.md`):

- Node.js 18+, npm
- PM2 (`sudo npm install -g pm2`)
- nginx (đang serve `/var/www/khkt` + proxy `/api` → `localhost:8000`)
- Repo đã clone vào `/home/ec2-user/khkt`
- File `be/.env` đã tạo với đầy đủ `MONGODB_URI`, `OPENAI_API_KEY`, AWS S3, `JWT_SECRET`, `BASE_URL`, `CORS_ORIGIN`
- `pm2 startup` đã chạy (PM2 tự start lại khi server reboot)

Kiểm tra nhanh bằng 1 lệnh SSH từ máy local:

```bash
ssh -i ec2-keypair.pem ec2-user@YOUR_EC2_IP '
  node --version &&
  pm2 --version &&
  nginx -v &&
  ls /home/ec2-user/khkt/be/.env &&
  pm2 describe khkt-backend | head -5
'
```

Nếu tất cả OK, sang bước 4.

---

## 4. Chạy deploy đầu tiên

Cách 1 — push code vào `main` như bình thường, workflow tự chạy với scope `auto` (suy từ path đã đổi).

Cách 2 — chạy tay: vào tab **Actions** → **Deploy to EC2** → **Run workflow** → chọn `scope`:

- `auto` (mặc định): suy scope từ path commit gần nhất.
- `all`: deploy cả backend + frontend.
- `backend`: chỉ `pm2 reload` backend (không build FE).
- `frontend`: chỉ rebuild + rsync `dist/` ra nginx (không đụng PM2).

---

## 5. Theo dõi & rollback

- **Xem log deploy**: repo → **Actions** → run gần nhất.
- **Xem log backend sau deploy**:
  ```bash
  ssh -i ec2-keypair.pem ec2-user@YOUR_EC2_IP 'pm2 logs khkt-backend --lines 200'
  ```
- **Rollback nhanh** khi commit mới làm hỏng production: trên máy local
  ```bash
  git revert <commit-sha>
  git push origin main
  ```
  Workflow sẽ tự deploy lại bản đã revert. Không cần SSH.

  Rollback mạnh hơn (quay hẳn về commit cũ):
  ```bash
  git reset --hard <old-sha>
  git push origin main --force-with-lease
  ```
  ⚠️ Chỉ dùng khi thực sự cần.

---

## 6. Tóm tắt luồng

```
Dev push main
   │
   ├── GitHub Actions "CI"            → lint + build check (fail = chặn merge)
   │
   └── GitHub Actions "Deploy to EC2" → detect scope (auto) → SSH ec2
                                         → git reset --hard origin/main
                                         → ./deploy-ec2.sh <scope>
                                             ├── backend → npm ci --omit=dev → pm2 reload
                                             └── frontend → npm ci → vite build → rsync dist/
                                                              → /var/www/khkt/ → nginx reload
                                         → health check (/health và/hoặc /)
```

Set secrets một lần, sau đó mọi deploy là **push và quên**.
