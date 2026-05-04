import cors from "cors";
import express from "express";
import { connectDB, getDB } from "./db.js";
import { requireAuth } from "./authMiddleware.js";
import { authRouter } from "./authRouter.js";
import { revenueRouter } from "./revenueRouter.js";

const app = express();
const PORT = Number(process.env.PORT) || 8010;

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  let mongoOk = false;
  try {
    getDB();
    mongoOk = true;
  } catch {
    /* chưa connect */
  }
  res.json({ ok: true, service: "bang-doanh-thu-backend", mongo: mongoOk });
});

app.get("/api/health", (_req, res) => {
  let mongoOk = false;
  try {
    getDB();
    mongoOk = true;
  } catch {
    /* chưa connect */
  }
  res.json({ ok: true, service: "bang-doanh-thu-backend", mongo: mongoOk });
});

app.use("/api/auth", authRouter);
app.use("/api/revenue", requireAuth, revenueRouter);

async function main() {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`API: http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Stop the other process (e.g. old nodemon), or set PORT in .env to another value.`,
      );
    } else {
      console.error("HTTP server error:", err);
    }
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
