import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Luôn đọc `be/.env` dù chạy `node src/index.js` từ thư mục khác (cwd).
dotenv.config({ path: path.join(__dirname, "../.env") });

/** Cùng key env với backend KHKT (`be/src/config.js`). */
export const config = {
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.MONGODB_DB || "khkt_math_grader",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "bang-doanh-thu-dev-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  /** Đặt trong `.env` — đăng ký tài khoản & đăng ký nhanh (people) bắt buộc khớp mã này. */
  registrationCode: process.env.REGISTRATION_CODE ?? "",
};
