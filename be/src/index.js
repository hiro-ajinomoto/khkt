import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db.js";
import assignmentsRouter from "./routers/assignments.js";
import submissionsRouter from "./routers/submissions.js";
import authRouter from "./routers/auth.js";
import adminRouter from "./routers/admin.js";
import { config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(
  cors({
    origin: config.cors.origin === "*" ? "*" : config.cors.origin.split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Increase body size limits for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from uploads directory (for backward compatibility only)
const uploadsDir = path.join(__dirname, "..", config.imageUpload.dir);
app.use("/uploads", express.static(uploadsDir));

// Routes
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/assignments", assignmentsRouter);
app.use("/submissions", submissionsRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ detail: "Internal server error" });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Express server
    app.listen(config.server.port, () => {
      console.log(
        `🚀 Server running on http://localhost:${config.server.port}`
      );
      console.log(
        `📚 API Documentation available at http://localhost:${config.server.port}/health`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  const { closeDB } = await import("./db.js");
  await closeDB();
  process.exit(0);
});
