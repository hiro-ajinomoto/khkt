import dotenv from 'dotenv'

dotenv.config()

export const config = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB || 'khkt_math_grader',
  },
  imageUpload: {
    dir: process.env.IMAGE_UPLOAD_DIR || 'uploads',
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    bucketName: process.env.AWS_S3_BUCKET_NAME || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    /** Vision: low = ít token ảnh, thường nhanh hơn; high = chi tiết hơn, chậm hơn */
    visionDetail: ['low', 'high', 'auto'].includes(
      (process.env.OPENAI_VISION_DETAIL || 'low').toLowerCase()
    )
      ? (process.env.OPENAI_VISION_DETAIL || 'low').toLowerCase()
      : 'low',
    /** Giới hạn độ dài JSON trả về — tránh sinh văn bản dài làm tăng latency */
    maxCompletionTokens: (() => {
      const n = parseInt(process.env.OPENAI_MAX_COMPLETION_TOKENS || '8192', 10);
      if (!Number.isFinite(n) || n <= 0) return 8192;
      return Math.min(Math.max(n, 512), 16384);
    })(),
    requestTimeoutMs: (() => {
      const n = parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS || '180000', 10);
      return Number.isFinite(n) && n >= 30000 ? n : 180000;
    })(),
    /**
     * Resize/nén ảnh trước khi gửi Vision API — giảm payload, thường rút latency.
     * Tắt: OPENAI_VISION_OPTIMIZE_IMAGES=false
     */
    visionOptimizeImages: (() => {
      const v = (process.env.OPENAI_VISION_OPTIMIZE_IMAGES || 'true').toLowerCase();
      return v !== 'false' && v !== '0' && v !== 'no';
    })(),
    /** Cạnh dài tối đa sau resize (px), 512–4096 */
    visionImageMaxEdgePx: (() => {
      const n = parseInt(process.env.OPENAI_VISION_MAX_EDGE_PX || '2048', 10);
      if (!Number.isFinite(n)) return 2048;
      return Math.min(Math.max(n, 512), 4096);
    })(),
    /** Chất lượng JPEG đầu ra (60–95) */
    visionImageJpegQuality: (() => {
      const n = parseInt(process.env.OPENAI_VISION_JPEG_QUALITY || '84', 10);
      if (!Number.isFinite(n)) return 84;
      return Math.min(Math.max(n, 60), 95);
    })(),
    visionFetchTimeoutMs: (() => {
      const n = parseInt(process.env.OPENAI_VISION_FETCH_TIMEOUT_MS || '30000', 10);
      return Number.isFinite(n) && n >= 5000 ? n : 30000;
    })(),
    visionFetchMaxBytes: (() => {
      const n = parseInt(process.env.OPENAI_VISION_FETCH_MAX_BYTES || String(20 * 1024 * 1024), 10);
      if (!Number.isFinite(n) || n < 1024 * 1024) return 20 * 1024 * 1024;
      return Math.min(n, 40 * 1024 * 1024);
    })(),
  },
  server: {
    port: parseInt(process.env.PORT || '8000', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*', // For production, set to your frontend URL
  },
}
