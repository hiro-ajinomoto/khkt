import express from "express";
import multer from "multer";
import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDB } from "../db.js";
import { config } from "../config.js";
import { gradeSubmissionWithAI } from "../services/aiService.js";
import { uploadFileToS3 } from "../services/s3Service.js";
import { authenticate } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "..", config.imageUpload.dir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage });

/**
 * Convert local file path to accessible URL
 * @param {string} filePath - Local file path
 * @returns {string|null} URL or null if path is invalid
 */
function pathToUrl(filePath) {
  if (!filePath) return null;

  // If it's already a URL (http/https), return as is
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  // If it's a local path, convert to URL
  // Extract filename from path (e.g., /path/to/uploads/abc123.png -> abc123.png)
  const filename = path.basename(filePath);

  // Get base URL from config or use default
  const baseUrl =
    process.env.BASE_URL || `http://localhost:${process.env.PORT || 8000}`;

  // Return URL: http://localhost:8000/uploads/filename.png
  return `${baseUrl}/uploads/${filename}`;
}

/**
 * GET /submissions/mock
 * Return fake submission data (no database required)
 * For testing frontend/API format only
 * MUST be defined BEFORE /:id route to avoid conflicts
 */
router.get("/mock", (req, res) => {
  const now = new Date();
  const mockSubmission = {
    id: "mock-submission-123",
    assignment_id: "mock-assignment-456",
    image_paths: [
      "uploads/mock-student-work-1.jpg",
      "uploads/mock-student-work-2.jpg",
    ],
    created_at: now,
    ai_result: {
      summary:
        "Học sinh đã giải đúng phương trình nhưng thiếu bước kiểm tra nghiệm.",
      score: 7,
      mistakes: [
        "Thiếu bước thay nghiệm vào phương trình gốc để kiểm tra",
        "Chưa ghi rõ điều kiện của phương trình",
      ],
      nextSteps: [
        "Kiểm tra lại nghiệm bằng cách thay vào phương trình gốc",
        "Ghi rõ điều kiện xác định của phương trình",
      ],
      practiceSets: {
        similar: [
          {
            problem: "Giải phương trình x^2 - 7x + 12 = 0",
            solution: "x = 3 hoặc x = 4",
          },
          {
            problem: "Giải phương trình x^2 - 9x + 20 = 0",
            solution: "x = 4 hoặc x = 5",
          },
          {
            problem: "Giải phương trình x^2 - 6x + 8 = 0",
            solution: "x = 2 hoặc x = 4",
          },
          {
            problem: "Giải phương trình x^2 - 8x + 15 = 0",
            solution: "x = 3 hoặc x = 5",
          },
        ],
        remedial: [
          {
            problem: "Giải phương trình x^2 - 4 = 0",
            solution: "x = 2 hoặc x = -2",
          },
          {
            problem: "Giải phương trình x^2 - 9 = 0",
            solution: "x = 3 hoặc x = -3",
          },
          {
            problem: "Giải phương trình x^2 - 16 = 0",
            solution: "x = 4 hoặc x = -4",
          },
          {
            problem: "Giải phương trình x^2 - 25 = 0",
            solution: "x = 5 hoặc x = -5",
          },
        ],
      },
    },
  };

  res.json(mockSubmission);
});

/**
 * GET /submissions/my-submissions
 * Get all submissions of the authenticated student
 * Must be defined BEFORE /:id route to avoid conflicts
 */
router.get("/my-submissions", authenticate, async (req, res) => {
  try {
    // Only students can view their own submissions
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ detail: "Only students can view their submissions" });
    }

    const db = getDB();
    const studentId = ObjectId.createFromHexString(req.user.id);

    // Get all submissions for this student
    const submissions = await db
      .collection("submissions")
      .find({ student_id: studentId })
      .sort({ created_at: -1 }) // Sort by newest first
      .toArray();

    // Get assignment details for each submission
    const result = await Promise.all(
      submissions.map(async (submission) => {
        const assignment = await db.collection("assignments").findOne({
          _id: submission.assignment_id,
        });

        return {
          id: submission._id.toString(),
          assignment_id: submission.assignment_id.toString(),
          assignment_title: assignment
            ? assignment.title
            : "Unknown Assignment",
          assignment_subject: assignment ? assignment.subject : null,
          image_paths: submission.image_paths
            ? submission.image_paths.map((path) => pathToUrl(path))
            : [],
          created_at: submission.created_at,
          ai_result: submission.ai_result || null,
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error("Error fetching student submissions:", error);
    res.status(500).json({ detail: "Failed to fetch submissions" });
  }
});

/**
 * GET /submissions/:id
 * Get a submission by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch (error) {
      return res.status(400).json({ detail: "Invalid submission id" });
    }

    const db = getDB();
    const submission = await db.collection("submissions").findOne({
      _id: objectId,
    });

    if (!submission) {
      return res.status(404).json({ detail: "Submission not found" });
    }

    res.json({
      id: submission._id.toString(),
      assignment_id: submission.assignment_id.toString(),
      image_paths: submission.image_paths
        ? submission.image_paths.map((path) => pathToUrl(path))
        : [],
      created_at: submission.created_at,
      ai_result: submission.ai_result || null,
    });
  } catch (error) {
    console.error("Error fetching submission:", error);
    res.status(500).json({ detail: "Failed to fetch submission" });
  }
});

/**
 * POST /submissions
 * Create a new submission with image uploads
 */
router.post("/", authenticate, upload.array("files"), async (req, res) => {
  try {
    const { assignment_id } = req.body;
    const files = req.files;
    const studentId = ObjectId.createFromHexString(req.user.id);

    // Validation
    if (!assignment_id) {
      return res.status(400).json({ detail: "Missing assignment_id" });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ detail: "No files uploaded" });
    }

    // Validate assignment exists
    let assignmentObjectId;
    try {
      assignmentObjectId = ObjectId.createFromHexString(assignment_id);
    } catch (error) {
      return res.status(400).json({ detail: "Invalid assignment id" });
    }

    const db = getDB();
    const assignment = await db.collection("assignments").findOne({
      _id: assignmentObjectId,
    });

    if (!assignment) {
      return res.status(404).json({ detail: "Assignment not found" });
    }

    // Check if student is allowed to submit to this assignment
    // Only students need this check
    if (req.user.role === "student") {
      const student = await db.collection("users").findOne({ _id: studentId });
      if (!student || !student.class_name) {
        return res
          .status(403)
          .json({ detail: "Student not assigned to a class" });
      }

      const assigned = await db.collection("assignment_classes").findOne({
        assignment_id: assignmentObjectId,
        class_name: student.class_name,
      });

      if (!assigned) {
        return res
          .status(403)
          .json({ detail: "Assignment not assigned to your class" });
      }
    }

    // Validate required fields in assignment
    // Assignment must have either:
    // 1. question_image_url AND model_solution_image_url (images only)
    // 2. question AND model_solution (text only)
    // 3. Or combination of both
    const hasQuestionImage = !!assignment.question_image_url;
    const hasSolutionImage = !!assignment.model_solution_image_url;
    const hasQuestionText = !!assignment.question;
    const hasSolutionText = !!assignment.model_solution;

    const hasImages = hasQuestionImage && hasSolutionImage;
    const hasText = hasQuestionText && hasSolutionText;

    if (!hasImages && !hasText) {
      return res.status(400).json({
        detail:
          "Assignment is missing required fields. Must have either: (question_image_url AND model_solution_image_url) OR (question AND model_solution)",
      });
    }

    // Warn if some fields are missing (but don't fail)
    if (hasImages && !hasText) {
      console.log(
        `Assignment ${assignment_id} uses images only. AI grading will use images.`
      );
    } else if (hasText && !hasImages) {
      console.warn(
        `Assignment ${assignment_id} uses text only. AI grading will use text.`
      );
    }

    // Upload images to S3 and get URLs
    const imageUrls = [];
    for (const file of files) {
      try {
        const ext = path.extname(file.originalname) || ".png";
        const s3Key = `submissions/${uuidv4()}${ext}`;
        const contentType = file.mimetype || "image/png";

        const s3Url = await uploadFileToS3(file.path, s3Key, contentType);
        imageUrls.push(s3Url);

        // Clean up local file after upload
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error("Failed to upload submission image to S3:", error);
        // Fallback to local path if S3 upload fails
        imageUrls.push(file.path);
      }
    }

    // Create submission document
    const submissionDoc = {
      assignment_id: assignmentObjectId,
      student_id: studentId, // Store student ID
      image_paths: imageUrls, // Store S3 URLs instead of local paths
      created_at: new Date(),
      ai_result: null,
    };

    const result = await db.collection("submissions").insertOne(submissionDoc);
    const submissionId = result.insertedId;

    // Call AI grading
    let aiResult;
    try {
      // Filter out null/undefined/empty image URLs - only send if they exist
      const questionImageUrls = assignment.question_image_url
        ? [assignment.question_image_url].filter(Boolean)
        : [];
      const solutionImageUrls = assignment.model_solution_image_url
        ? [assignment.model_solution_image_url].filter(Boolean)
        : [];

      aiResult = await gradeSubmissionWithAI(
        imageUrls, // Use S3 URLs instead of local paths
        assignment.model_solution || "",
        assignment.question || "",
        questionImageUrls, // Optional - can be empty array
        solutionImageUrls // Optional - can be empty array
      );
    } catch (error) {
      // Log detailed error information for debugging
      const errorStatus = error.response?.status;
      const errorMessage = error.message;
      const errorData = error.response?.data;

      console.error("AI grading failed:");
      console.error("  Status:", errorStatus);
      console.error("  Message:", errorMessage);
      console.error("  Response data:", errorData);
      console.error("  Full error:", error);

      // Determine error type and provide appropriate message
      let errorSummary = "AI grading failed";
      let errorNextSteps = [
        "Hệ thống đang gặp sự cố. Vui lòng liên hệ quản trị viên.",
      ];

      if (errorStatus === 429) {
        errorSummary =
          "AI grading tạm thời không khả dụng do quá tải. Vui lòng thử lại sau.";
        errorNextSteps = ["Vui lòng thử lại sau vài phút"];
      } else if (errorStatus === 401) {
        errorSummary = "Lỗi xác thực API. Vui lòng kiểm tra API key.";
        errorNextSteps = ["Kiểm tra cấu hình OPENAI_API_KEY trong file .env"];
      } else if (errorStatus === 400) {
        errorSummary =
          "Yêu cầu không hợp lệ. Vui lòng kiểm tra dữ liệu đầu vào.";
        errorNextSteps = ["Kiểm tra format của hình ảnh và dữ liệu assignment"];
      } else if (
        errorStatus === 500 ||
        errorStatus === 502 ||
        errorStatus === 503
      ) {
        errorSummary = "Lỗi từ phía server AI. Vui lòng thử lại sau.";
        errorNextSteps = [
          "Thử lại sau vài phút",
          "Nếu vẫn lỗi, liên hệ quản trị viên",
        ];
      } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        errorSummary =
          "Không thể kết nối đến server AI. Vui lòng kiểm tra kết nối mạng.";
        errorNextSteps = ["Kiểm tra kết nối internet", "Thử lại sau"];
      } else if (errorMessage?.includes("JSON")) {
        errorSummary = "Lỗi xử lý phản hồi từ AI. Dữ liệu không hợp lệ.";
        errorNextSteps = ["Thử lại với submission khác"];
      }

      // Store failure info
      // Don't store system errors as student mistakes
      aiResult = {
        summary: errorSummary,
        score: 0,
        mistakes: [], // Don't store system errors as student mistakes
        nextSteps: errorNextSteps,
        practiceSets: {
          similar: [],
          remedial: [],
        },
        // Store error details for debugging (optional, can be removed in production)
        _error:
          process.env.NODE_ENV === "development"
            ? {
                status: errorStatus,
                message: errorMessage,
                type: error.code || "unknown",
              }
            : undefined,
      };
    }

    // Update submission with AI result
    await db
      .collection("submissions")
      .updateOne({ _id: submissionId }, { $set: { ai_result: aiResult } });

    // Fetch updated submission
    const created = await db.collection("submissions").findOne({
      _id: submissionId,
    });

    res.status(201).json({
      id: created._id.toString(),
      assignment_id: created.assignment_id.toString(),
      student_id: created.student_id ? created.student_id.toString() : null,
      image_paths: created.image_paths
        ? created.image_paths.map((path) => pathToUrl(path))
        : [],
      created_at: created.created_at,
      ai_result: created.ai_result,
    });
  } catch (error) {
    console.error("Error creating submission:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      detail: "Failed to create submission",
      error: error.message,
    });
  }
});

export default router;
