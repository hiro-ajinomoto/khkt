# Deploy tự động — hướng dẫn set-up một lần duy nhất

Sau khi set xong mấy secret bên dưới, mỗi lần `git push origin main`:

- **Frontend (Vercel)**: Vercel tự build + deploy qua GitHub integration (không cần workflow).
- **Backend (EC2 + nginx + PM2)**: GitHub Actions `deploy-ec2.yml` sẽ SSH vào EC2, `git pull`, `npm ci`, `pm2 reload`, rồi health-check `/health`.
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

## 3. Verify Vercel (frontend)

Vercel đã có `fe/khkt/vercel.json`. Kiểm tra:

1. Đăng nhập Vercel → **Project** của bạn.
2. **Settings → Git**: xác nhận repo `hiro-ajinomoto/khkt` đã connect, **Production Branch = `main`**, **Root Directory = `fe/khkt`**.
3. **Settings → Environment Variables**: thêm `VITE_API_BASE_URL`:
   - Value = URL backend public, ví dụ `https://api.khkt.com/api` hoặc `http://54.123.45.67/api`.
   - Scope: **Production** (và Preview nếu muốn).
4. Mỗi push `main` Vercel sẽ tự build lại. Không cần workflow.

Nếu muốn Vercel chỉ deploy khi `fe/khkt/**` thay đổi, vào **Settings → Git → Ignored Build Step** và dán:

```bash
git diff --quiet HEAD^ HEAD -- fe/khkt
```

(Exit code 0 = skip build, 1 = build. Lệnh này skip khi không có diff trong `fe/khkt`.)

---

## 4. Chuẩn bị một lần trên EC2

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

Nếu tất cả OK, sang bước 5.

---

## 5. Chạy deploy đầu tiên

Cách 1 — push code vào `main` như bình thường, workflow tự chạy.

Cách 2 — chạy tay: vào tab **Actions** → **Deploy to EC2** → **Run workflow** → chọn `scope`:

- `all`: deploy cả backend + frontend (nginx serve FE trên EC2 song song với Vercel).
- `backend`: chỉ pm2 reload backend. **Dùng cái này nếu FE chỉ sống trên Vercel.**
- `frontend`: chỉ rebuild + rsync dist ra nginx.

Khuyến nghị: nếu FE chính thức ở Vercel thì đặt thói quen chạy `backend` thôi để EC2 không mất RAM/thời gian build Vite (t2.micro build FE có thể 1–2 phút).

---

## 6. Theo dõi & rollback

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

## 7. Tóm tắt luồng

```
Dev push main
   │
   ├── GitHub Actions "CI"            → lint + build check
   │
   ├── GitHub Actions "Deploy to EC2" → SSH ec2 → git pull → npm ci
   │                                     → pm2 reload khkt-backend
   │                                     → curl /health (retry 5 lần)
   │
   └── Vercel GitHub integration       → npm ci → vite build → CDN deploy
```

Chỉ set một lần (secrets + Vercel env), sau đó mọi deploy là **push và quên**.
