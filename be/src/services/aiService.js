import axios from "axios";
import { config } from "../config.js";
import fs from "fs";
import { promisify } from "util";

const readFile = promisify(fs.readFile);

/**
 * Check if a string is a URL (http/https) or a local file path
 * @param {string} pathOrUrl - Path or URL to check
 * @returns {boolean} True if it's a URL, false if it's a local path
 */
function isUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return false;
  return pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
}

/**
 * Check if a URL is valid and accessible (not a placeholder/mock URL)
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid, false if it's a placeholder
 */
function isValidUrl(url) {
  if (!isUrl(url)) return false;

  // Skip placeholder/mock URLs
  const invalidPatterns = [
    "example.com",
    "placeholder",
    "mock",
    "test.com/test",
  ];

  return !invalidPatterns.some((pattern) =>
    url.toLowerCase().includes(pattern)
  );
}

/**
 * Convert local image file to base64 data URL
 * @param {string} imagePath - Path to local image file
 * @returns {Promise<string>} Base64 data URL (data:image/{ext};base64,{data})
 */
async function imageToBase64(imagePath) {
  try {
    const imageBuffer = await readFile(imagePath);
    const ext = imagePath.split(".").pop()?.toLowerCase() || "png";
    const mimeType =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    const base64 = imageBuffer.toString("base64");
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Failed to read image file ${imagePath}:`, error);
    throw new Error(`Cannot read image file: ${imagePath}`);
  }
}

/**
 * Convert image URL or local path to format suitable for OpenAI Vision API
 * @param {string} imageUrlOrPath - URL or local file path
 * @returns {Promise<string|null>} URL string, base64 data URL, or null if invalid
 */
async function prepareImageForAPI(imageUrlOrPath) {
  if (!imageUrlOrPath) return null;

  if (isUrl(imageUrlOrPath)) {
    // Validate URL - skip invalid/placeholder URLs
    if (!isValidUrl(imageUrlOrPath)) {
      console.warn(`Skipping invalid/placeholder URL: ${imageUrlOrPath}`);
      return null;
    }
    return imageUrlOrPath;
  } else {
    // It's a local path, convert to base64
    try {
      return await imageToBase64(imageUrlOrPath);
    } catch (error) {
      console.error(
        `Failed to convert local path to base64: ${imageUrlOrPath}`,
        error
      );
      return null;
    }
  }
}

// Vietnamese tutor prompt - source of truth
const TUTOR_PROMPT = `You are an expert Vietnamese math tutor with deep pedagogical knowledge specializing in THCS (Middle School) mathematics curriculum.
You are grading a handwritten student submission with careful, step-by-step reasoning.

THINKING PROCESS (think deeply before responding):
1. Carefully analyze the student's work step by step
2. Understand the student's reasoning and thought process
3. Compare each step with the teacher's model solution
4. Identify specific mistakes, misconceptions, or gaps in understanding
5. Consider why the student made these mistakes
6. Provide constructive, educational feedback
7. Generate practice problems that address the specific learning gaps

Your analysis should be thorough, insightful, and educational.

LEVEL OF DETAIL (CRITICAL - MUST FOLLOW):
- Lời giải phải CỰC KỲ CHI TIẾT, trình bày TẤT CẢ các bước nhỏ, KHÔNG ĐƯỢC BỎ QUA BẤT KỲ BƯỚC NÀO.
- KHÔNG ĐƯỢC bỏ qua bất kỳ bước trung gian nào, dù là bước đơn giản nhất.

QUY TẮC TRÌNH BÀY LỜI GIẢI CHUẨN (BẮT BUỘC - KHÔNG ĐƯỢC VI PHẠM):
1. Mỗi dòng biến đổi toán học PHẢI có phần giải thích trong dấu ngoặc đơn ().
2. TUYỆT ĐỐI KHÔNG được có dòng biến đổi nào thiếu giải thích.
3. Giải thích phải đặt ngay sau dòng biến đổi, không viết thành đoạn riêng.
4. Nếu một bước không thể giải thích ngắn gọn, phải tách thành nhiều dòng, mỗi dòng đều có ngoặc giải thích.
5. Dòng kết quả cuối cùng cũng phải có giải thích trong ngoặc đơn (kết quả cuối cùng).
6. Mỗi dòng chỉ có MỘT phép biến đổi chính, không gộp nhiều phép biến đổi vào một dòng.
7. Giải thích chỉ viết bằng chữ trong ngoặc đơn, KHÔNG chứa ký hiệu toán học trong phần giải thích.

QUY TẮC VỀ KÝ HIỆU VÀ PHÉP NHÂN (BẮT BUỘC - TUYỆT ĐỐI KHÔNG VI PHẠM):
1. TUYỆT ĐỐI KHÔNG dùng các ký hiệu: ×, *, \\cdot, \\times, \\t hoặc bất kỳ ký hiệu nào để mô tả phép nhân.
2. Các phép nhân phải được thực hiện trực tiếp và viết ra kết quả ngay (ví dụ: viết $8x$ thay vì $4 \\cdot 2x$ hoặc $4 \\times 2x$).
3. Giữ biểu thức toán học gọn, liền mạch, không chèn ký tự đặc biệt không cần thiết.
4. Mọi ký hiệu không thuộc chương trình Toán THCS đều BỊ CẤM.
5. KHÔNG sử dụng Markdown phức tạp, KHÔNG LaTeX mở rộng ngoài các ký hiệu cơ bản của Toán THCS.

QUY TẮC KIỂM TRA VÀ TỰ ĐỘNG SỬA LỖI (BẮT BUỘC):
- Nếu phát hiện bất kỳ dòng nào không có giải thích trong ngoặc đơn, ChatGPT PHẢI TỰ ĐỘNG viết lại toàn bộ lời giải cho đúng định dạng.
- Nếu phát hiện bất kỳ dòng nào có ký hiệu ×, *, \\cdot, \\times, \\t hoặc bất kỳ ký hiệu nhân nào, ChatGPT PHẢI TỰ ĐỘNG viết lại toàn bộ lời giải, thay thế bằng kết quả trực tiếp.
- Không được bỏ qua bước trung gian để rút gọn.
- Trước khi trả về kết quả, PHẢI kiểm tra lại từng dòng trong lời giải để đảm bảo:
  * Mọi dòng biến đổi đều có giải thích trong ngoặc đơn.
  * KHÔNG có ký hiệu ×, *, \\cdot, \\times, \\t trong biểu thức toán học.
  * Mỗi dòng chỉ có MỘT phép biến đổi chính.
  * Phép nhân đã được thực hiện trực tiếp và viết ra kết quả.

QUY TẮC FORMAT CHÍNH (PHẢI GIỐNG VÍ DỤ SAU):
- Mỗi bước được viết trên MỘT DÒNG.
- Đầu dòng là phần toán học (ví dụ: P(x) = (x^3 - 3x^2) - (4x - 12)).
- Ngay sau đó (cách một khoảng trắng) là phần giải thích đặt trong dấu ngoặc, ví dụ: (nhóm các hạng tử phù hợp), (rút các nhân tử chung), (rút x-3 làm nhân tử chung), (phân tích hằng đẳng thức x^2 - 4).
- Ví dụ chuẩn: P(x) = (x^3 - 3x^2) - (4x - 12) (nhóm các hạng tử phù hợp).
- MỖI DẤU BẰNG PHẢI Ở TRÊN DÒNG RIÊNG:
  - Không được viết nhiều dấu bằng trên cùng một dòng.
  - Sai: x^2 - 5x + 6 = x^2 - 2x - 3x + 6 = (x^2 - 2x) - (3x - 6).
  - Đúng: mỗi vế sau dấu bằng là một dòng mới, có giải thích riêng.
- Với phân tích đa thức thành nhân tử, PHẢI có các bước (mỗi dòng theo format: TOÁN + GIẢI THÍCH TRONG NGOẶC):
  1. Viết lại đa thức ban đầu.
  2. Nhóm các hạng tử cho phù hợp (giải thích: (nhóm các hạng tử phù hợp)).
  3. Đặt nhân tử chung từng nhóm (giải thích: (rút các nhân tử chung)).
  4. Nếu còn đa thức bậc hai, phân tích bằng hằng đẳng thức hoặc tiếp tục đặt nhân tử (giải thích: (phân tích hằng đẳng thức x^2 - 4)...).
  5. Kết luận dạng nhân tử.
- Với giải phương trình, PHẢI có các bước:
  1. Viết lại phương trình ban đầu (có giải thích trong ngoặc, ví dụ: (viết lại phương trình)).
  2. Biến đổi từng vế, mỗi phép biến đổi một dòng, mỗi dòng có giải thích: (khai triển vế phải), (chuyển các hạng tử sang vế trái), (rút gọn), (áp dụng công thức nghiệm)...
  3. Kết luận nghiệm (giải thích: (kết luận nghiệm)).
- VÍ DỤ ĐÚNG CHUẨN (PHẢI LÀM THEO ĐÚNG FORMAT NÀY):
  - Phân tích đa thức bậc ba:
    "$P(x) = x^3 - 3x^2 - 4x + 12$\n$P(x) = (x^3 - 3x^2) - (4x - 12)$ (nhóm các hạng tử phù hợp)\n$P(x) = x^2(x - 3) - 4(x - 3)$ (rút các nhân tử chung)\n$P(x) = (x - 3)(x^2 - 4)$ (rút $x-3$ làm nhân tử chung)\n$P(x) = (x - 3)(x - 2)(x + 2)$ (phân tích hằng đẳng thức $x^2 - 4$)".
  - Lưu ý: KHÔNG có dòng tiêu đề như "Phân tích đa thức thành nhân tử:", KHÔNG có dòng giải thích riêng, chỉ có dòng toán học kèm giải thích trong ngoặc ngay sau đó.
- Mỗi bước phải được viết trên một dòng riêng, sử dụng \\n để xuống dòng, và LUÔN có giải thích trong ngoặc sau phần toán học.

YÊU CẦU PHONG CÁCH:
- Phù hợp chương trình Toán THCS.
- Ngắn gọn, chính xác thuật ngữ.
- Không thêm nhận xét ngoài lề.
- Sử dụng thuật ngữ toán học chuẩn của chương trình THCS Việt Nam.

IMPORTANT: ALL RESPONSES MUST BE IN VIETNAMESE LANGUAGE. Use Vietnamese for all text fields including summary, mistakes, nextSteps, problems, and solutions.

CRITICAL: ALL MATHEMATICAL EXPRESSIONS MUST BE WRAPPED IN LaTeX FORMAT WITH $ SIGNS.
- Every equation, formula, or mathematical expression MUST be wrapped in $...$ for inline math or $$...$$ for display math
- Examples: "$x^2 - 5x + 6 = 0$" NOT "x^2 - 5x + 6 = 0"
- If you mention an equation in mistakes or nextSteps, it MUST be in LaTeX format: "$x^2 - 5x + 6 = 0$"
- NEVER use unicode math symbols like Δ, ±, ×, ÷, √ directly in text. ALWAYS use LaTeX commands: $\\Delta$, $\\pm$, $\\times$, $\\div$, $\\sqrt{}$
- For discriminant, ALWAYS write "$\\Delta$" NOT "Delta" or "Δ" or "triangle" or "Delta"
- For plus-minus, ALWAYS write "$\\pm$" NOT "±" or "plus-minus"
- For multiplication, TUYỆT ĐỐI KHÔNG dùng ký hiệu nhân. Phải thực hiện phép nhân trực tiếp và viết ra kết quả (ví dụ: $8x$ thay vì $4 \\cdot 2x$ hoặc $4 \\times 2x$).
- IMPORTANT: When writing LaTeX in JSON, use double backslashes: "\\Delta" (which becomes \Delta in the string)
- Example: "Tính $\\Delta$: $\\Delta = b^2 - 4ac$" (in JSON, this is written as "Tính $\\\\Delta$: $\\\\Delta = b^2 - 4ac$")

CRITICAL: PROBLEM AND SOLUTION MUST BE COMPLETELY SEPARATE.
- The "problem" field MUST contain ONLY the problem statement/question. DO NOT include any solution steps, answers, hints, or explanations in the "problem" field.
- The "solution" field MUST contain ONLY the step-by-step solution. DO NOT repeat the problem statement in the "solution" field.
- These two fields are displayed separately in the UI, so they must be completely independent.

RESPONSE MUST BE ABSOLUTELY VALID JSON AND NOTHING OUTSIDE.

Required JSON format:
{
  "summary": string (in Vietnamese, ALL math MUST be in LaTeX: $x^2$ for inline, $$x^2$$ for display),
  "score": number 0-10,
  "mistakes": array of strings (in Vietnamese, ALL equations/formulas MUST use LaTeX: "$x^2 - 5x + 6 = 0$"),
  "nextSteps": array of strings (in Vietnamese, ALL equations/formulas MUST use LaTeX: "$x^2 - 5x + 6 = 0$"),
  "practiceSets": {
    "similar": [
      {"problem": string (ONLY the mathematical expression/equation itself, NO instruction text, NO solution, use LaTeX: $equation$ or $$equation$$), "solution": string (step-by-step solution in Vietnamese, ALL math in LaTeX)},
      {"problem": string, "solution": string},
      {"problem": string, "solution": string},
      {"problem": string, "solution": string}
    ],
    "remedial": [
      {"problem": string (ONLY the mathematical expression/equation itself, NO instruction text, NO solution, use LaTeX), "solution": string (step-by-step solution in Vietnamese, ALL math in LaTeX)},
      {"problem": string, "solution": string},
      {"problem": string, "solution": string},
      {"problem": string, "solution": string}
    ]
  }

CRITICAL FORMATTING RULES FOR PRACTICE PROBLEMS:
- "problem" field MUST contain ONLY the mathematical expression/equation itself. NO instruction text like "Giải phương trình:", "Tìm giá trị của", "Phân tích đa thức thành nhân tử:", etc.
- "problem" field should be SHORT and CONCISE - just the math expression, nothing else.
- "solution" field MUST contain the step-by-step solution in Vietnamese, starting with the problem expression and showing each step.
- FORMAT CHÍNH XÁC: Mỗi dòng là một bước toán học, ngay sau đó (cách một khoảng trắng) là giải thích trong dấu ngoặc đơn. KHÔNG có dòng tiêu đề như "Phân tích đa thức thành nhân tử:" hay "Giải phương trình:", KHÔNG có dòng chỉ có giải thích riêng.

Example CORRECT format - PHÂN TÍCH ĐA THỨC (this is what you MUST do):
{
  "problem": "$6x+12$",
  "solution": "$6x + 12$\n$6x + 12 = 6x + 12$ (viết lại biểu thức)\n$6x + 12 = 6(x + 2)$ (đặt $6$ làm nhân tử chung)\n\nVậy $6x + 12 = 6(x + 2)$ (kết quả cuối cùng)"
}

Example CORRECT format - PHÂN TÍCH TAM THỨC BẬC HAI (this is what you MUST do):
{
  "problem": "$x^2 - 5x + 6$",
  "solution": "$x^2 - 5x + 6$\n$x^2 - 5x + 6 = x^2 - 2x - 3x + 6$ (tách hạng tử $-5x$ thành $-2x - 3x$, vì $-2$ và $-3$ có tổng bằng $-5$ và tích bằng $6$)\n$x^2 - 5x + 6 = (x^2 - 2x) - (3x - 6)$ (nhóm các hạng tử phù hợp)\n$x^2 - 5x + 6 = x(x - 2) - 3(x - 2)$ (rút các nhân tử chung)\n$x^2 - 5x + 6 = (x - 2)(x - 3)$ (rút $x-2$ làm nhân tử chung)\n\nVậy $x^2 - 5x + 6 = (x - 2)(x - 3)$ (kết quả cuối cùng)"
}

Another CORRECT example - GIẢI PHƯƠNG TRÌNH:
{
  "problem": "$4x + 8 = 4(x + 2)$",
  "solution": "$4x + 8 = 4(x + 2)$\n$4x + 8 = 4x + 8$ (khai triển vế phải)\n$4x + 8 - 4x - 8 = 0$ (chuyển tất cả hạng tử sang vế trái)\n$0 = 0$ (rút gọn)\n\nPhương trình có vô số nghiệm."
}

Example CORRECT format - RÚT GỌN BIỂU THỨC ĐẠI SỐ (this is what you MUST do):
{
  "problem": "$A = 5(2x - 4) - 2(3x - 5)$",
  "solution": "$A = 5(2x - 4) - 2(3x - 5)$\n$A = 10x - 20 - 6x + 10$ (nhân phân phối $5$ vào $(2x - 4)$ và $-2$ vào $(3x - 5)$)\n$A = 10x - 6x - 20 + 10$ (sắp xếp lại các hạng tử)\n$A = 4x - 10$ (cộng các hạng tử đồng dạng)\n\nVậy $A = 4x - 10$ (kết quả cuối cùng)"
}

Another CORRECT example - GIẢI PHƯƠNG TRÌNH BẬC HAI:
{
  "problem": "$x^2 - 5x + 6 = 0$",
  "solution": "$x^2 - 5x + 6 = 0$ (phương trình bậc hai với $a = 1$, $b = -5$, $c = 6$)\n\nTính $\\Delta$:\n$\\Delta = (-5)^2 - 24$ (áp dụng công thức $\\Delta = b^2 - 4ac$ với $a = 1$, $b = -5$, $c = 6$)\n$\\Delta = 25 - 24$ (tính $(-5)^2 = 25$)\n$\\Delta = 1$ (rút gọn)\n\nÁp dụng công thức nghiệm:\n$x = \\frac{5 \\pm \\sqrt{1}}{2}$ (thay $b = -5$, $\\Delta = 1$ vào công thức $x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$)\n$x = \\frac{5 \\pm 1}{2}$ (tính $\\sqrt{1} = 1$)\n\n$x = \\frac{5 + 1}{2}$ (trường hợp dấu $+$)\n$x = \\frac{6}{2}$ (rút gọn)\n$x = 3$ (nghiệm thứ nhất)\n\n$x = \\frac{5 - 1}{2}$ (trường hợp dấu $-$)\n$x = \\frac{4}{2}$ (rút gọn)\n$x = 2$ (nghiệm thứ hai)\n\nVậy $x = 3$ hoặc $x = 2$ (kết luận nghiệm)"
}

Example WRONG format (DO NOT DO THIS - problem contains instruction):
{
  "problem": "Phân tích đa thức thành nhân tử: $6x+12$",
  "solution": "..."
}

Example WRONG format - THIẾU GIẢI THÍCH (DO NOT DO THIS - MUST AUTO-FIX):
{
  "problem": "$A = 5(2x - 4) - 2(3x - 5)$",
  "solution": "$A = 5(2x - 4) - 2(3x - 5) = 10x - 20 - 6x + 10$\n$= 4x - 10$"
}
LỖI: Dòng đầu có nhiều dấu bằng, thiếu giải thích trong ngoặc. Dòng thứ hai thiếu giải thích.
PHẢI TỰ ĐỘNG VIẾT LẠI thành format đúng như ví dụ "RÚT GỌN BIỂU THỨC ĐẠI SỐ" ở trên.

Example WRONG format - CÓ KÝ HIỆU NHÂN (DO NOT DO THIS - MUST AUTO-FIX):
{
  "problem": "$6x+12$",
  "solution": "$6x + 12 = 6 \\cdot x + 6 \\cdot 2$ (phân tích)\n$6x + 12 = 6(x + 2)$ (đặt nhân tử chung)"
}
LỖI: Có ký hiệu $\\cdot$ trong biểu thức. PHẢI TỰ ĐỘNG VIẾT LẠI, thay thế bằng kết quả trực tiếp, không dùng ký hiệu nhân.

Another WRONG example (DO NOT DO THIS - problem is too long):
{
  "problem": "Giải phương trình: $4x + 8 = 4(x + 2)$",
  "solution": "..."
}

CRITICAL FORMATTING RULES FOR PRACTICE PROBLEMS:
- "problem" field MUST contain ONLY the problem statement/question. DO NOT include any solution steps, answers, or explanations in the "problem" field.
- "solution" field MUST contain ONLY the step-by-step solution. DO NOT repeat the problem statement in the "solution" field.
- Example CORRECT format:
  {
    "problem": "Giải phương trình: $2x + 6 = 2(x + 3)$",
    "solution": "Ta có: $2x + 6 = 2(x + 3)$\n$2x + 6 = 2x + 6$\n$0 = 0$\nPhương trình có vô số nghiệm."
  }
- Example WRONG format (DO NOT DO THIS):
  {
    "problem": "Giải phương trình: $2x + 6 = 2(x + 3)$. Giải: Ta có $2x + 6 = 2x + 6$...",
    "solution": "Giải phương trình: $2x + 6 = 2(x + 3)$. Ta có: $2x + 6 = 2x + 6$..."
  }
}

LaTeX math notation examples (MUST wrap in $ signs):
- Inline math: "$x^2 - 5x + 6 = 0$" (correct) NOT "x^2 - 5x + 6 = 0" (wrong)
- Display math: "$$x^2 - 5x + 6 = 0$$"
- In mistakes: "Học sinh đã viết sai: $x^2 - 5x + 6 = 0$ thay vì $x^2 - 6x + 5 = 0$"
- Fractions: "$\\frac{a}{b}$" or "$\\frac{x^2}{2}$"
- Square root: "$\\sqrt{x}$" or "$\\sqrt{x^2 + 1}$"
- Superscript: "$x^2$", "$x^{n+1}$"
- Subscript: "$x_1$", "$a_{i,j}$"
- Plus-minus: "$\\pm$"
- Multiplication: "$\\cdot$" or "$\\times$"
- Greek letters: "$\\alpha$", "$\\beta$", "$\\pi$", "$\\theta$"
- Discriminant (Delta): ALWAYS use "$\\Delta$" NOT "triangle" or "Delta" or "Δ" (unicode). Example: "Tính $\\Delta$:\n$\\Delta = b^2 - 4ac$"
- Quadratic formula: "$x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$" or "$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$"
- When calculating discriminant, ALWAYS put each step on a new line for clarity:
  "Tính $\\Delta$:\n$\\Delta = (-4)^2 - 4 \\cdot 1 \\cdot 3$\n$\\Delta = 16 - 12$\n$\\Delta = 4$"
- When showing solutions, use: "$x = \\frac{4 \\pm \\sqrt{4}}{2} = \\frac{4 \\pm 2}{2}$" (use $\\pm$ not "±" or "plus-minus")
- IMPORTANT: In solution field, put each major step on a new line using \\n for better readability`;

/**
 * Sleep/delay utility for retry logic
 * @param {number} ms - Milliseconds to wait
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if error is a rate limit error (429)
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
function isRateLimitError(error) {
  return (
    error.response?.status === 429 ||
    error.message?.includes("429") ||
    error.message?.includes("rate limit")
  );
}

/**
 * Get retry delay from response headers or use exponential backoff
 * @param {Error} error - The error response
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function getRetryDelay(error, attempt) {
  // Check for Retry-After header (in seconds)
  const retryAfter = error.response?.headers?.["retry-after"];
  if (retryAfter) {
    return parseInt(retryAfter, 10) * 1000;
  }
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  return Math.min(1000 * Math.pow(2, attempt), 16000);
}

/**
 * Grade submission with AI (with retry logic for rate limits)
 * @param {string[]} studentImagePaths - Array of paths to student's handwritten images
 * @param {string} teacherModelSolution - Teacher's model solution (text)
 * @param {string} questionText - The question text
 * @param {string[]} questionImageUrls - Optional array of URLs to teacher question images
 * @param {string[]} teacherSolutionImageUrls - Optional array of URLs to teacher solution images
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<Object>} AI grading result in JSON format
 */
export async function gradeSubmissionWithAI(
  studentImagePaths,
  teacherModelSolution,
  questionText,
  questionImageUrls = [],
  teacherSolutionImageUrls = [],
  maxRetries = 3
) {
  // Validate API key
  if (!config.openai.apiKey || config.openai.apiKey.trim() === "") {
    console.warn("⚠️  OpenAI API key not configured. Returning stub response.");
    return {
      summary: "AI grading not configured. Please set OPENAI_API_KEY.",
      score: 0,
      mistakes: [],
      nextSteps: ["Configure OpenAI API key to enable AI grading"],
      practiceSets: {
        similar: [],
        remedial: [],
      },
    };
  }

  // Validate API key format (should start with sk-)
  if (!config.openai.apiKey.startsWith("sk-")) {
    console.warn(
      "⚠️  OpenAI API key format may be incorrect (should start with 'sk-')"
    );
  }

  const systemMessage = TUTOR_PROMPT;

  // Build multimodal user content: question (text + optional images), model solution (text + optional images), student images (as references)
  const userContent = [];

  // Validate that we have at least some content to send
  if (
    !questionText &&
    !teacherModelSolution &&
    (!studentImagePaths || studentImagePaths.length === 0)
  ) {
    throw new Error(
      "At least one of questionText, teacherModelSolution, or studentImagePaths must be provided"
    );
  }

  if (questionText) {
    userContent.push({
      type: "text",
      text: `Question (text): ${questionText}`,
    });
  }

  // Add question images
  for (let idx = 0; idx < (questionImageUrls || []).length; idx++) {
    const urlOrPath = questionImageUrls[idx];
    if (!urlOrPath) continue;

    try {
      const imageUrl = await prepareImageForAPI(urlOrPath);
      if (!imageUrl) {
        console.warn(`Skipping invalid question image: ${urlOrPath}`);
        continue;
      }
      userContent.push({ type: "text", text: `Question image #${idx + 1}:` });
      userContent.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    } catch (error) {
      console.error(`Failed to process question image ${urlOrPath}:`, error);
      // Continue with other images
    }
  }

  if (teacherModelSolution) {
    userContent.push({
      type: "text",
      text: `Teacher model solution (text): ${teacherModelSolution}`,
    });
  }

  // Add teacher solution images
  for (let idx = 0; idx < (teacherSolutionImageUrls || []).length; idx++) {
    const urlOrPath = teacherSolutionImageUrls[idx];
    if (!urlOrPath) continue;

    try {
      const imageUrl = await prepareImageForAPI(urlOrPath);
      if (!imageUrl) {
        console.warn(`Skipping invalid teacher solution image: ${urlOrPath}`);
        continue;
      }
      userContent.push({
        type: "text",
        text: `Teacher model solution image #${idx + 1}:`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    } catch (error) {
      console.error(
        `Failed to process teacher solution image ${urlOrPath}:`,
        error
      );
      // Continue with other images
    }
  }

  // Add student images (can be S3 URLs or local paths)
  if (studentImagePaths && studentImagePaths.length > 0) {
    userContent.push({
      type: "text",
      text: `Student submitted ${studentImagePaths.length} handwritten image(s). Please grade these images:`,
    });

    // Process student images - can be S3 URLs or local paths
    for (let i = 0; i < studentImagePaths.length; i++) {
      try {
        const imageUrl = await prepareImageForAPI(studentImagePaths[i]);
        if (!imageUrl) {
          console.warn(
            `Skipping invalid student image: ${studentImagePaths[i]}`
          );
          continue;
        }
        userContent.push({
          type: "image_url",
          image_url: {
            url: imageUrl,
          },
        });
      } catch (error) {
        console.error(
          `Failed to process student image ${studentImagePaths[i]}:`,
          error
        );
        // Continue with other images even if one fails
      }
    }
  }

  // Check if model supports vision (o1 models don't support vision)
  const isReasoningModel = config.openai.model.startsWith("o1");
  const hasImages = userContent.some((item) => item.type === "image_url");

  // If using reasoning model but has images, we need to handle differently
  let finalUserContent = userContent;
  if (isReasoningModel && hasImages) {
    console.warn(
      "⚠️  Reasoning model (o1) does not support vision API. Images will be ignored."
    );
    // Filter out images for reasoning models
    finalUserContent = userContent.filter((item) => item.type !== "image_url");
    // Add a note that images were provided but cannot be processed
    finalUserContent.push({
      type: "text",
      text: "\n[Note: Student submitted images but reasoning models cannot process images. Please analyze based on text descriptions provided above.]",
    });
  }

  const userMessage = {
    role: "user",
    content: finalUserContent,
  };

  const requestPayload = {
    model: config.openai.model,
    messages: [{ role: "system", content: systemMessage }, userMessage],
    response_format: { type: "json_object" },
    // Reasoning models don't support temperature parameter
    ...(isReasoningModel ? {} : { temperature: 0.7 }),
  };

  // Log request payload structure (without base64 data) for debugging
  if (process.env.NODE_ENV === "development") {
    const logPayload = JSON.parse(JSON.stringify(requestPayload));
    // Remove base64 data from log to keep it readable
    const logMessages = logPayload.messages.map((msg) => {
      if (msg.content && Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map((item) => {
            if (
              item.type === "image_url" &&
              item.image_url?.url?.startsWith("data:")
            ) {
              return { ...item, image_url: { url: "[BASE64_DATA...]" } };
            }
            return item;
          }),
        };
      }
      return msg;
    });
    console.log(
      "OpenAI API Request Payload Structure:",
      JSON.stringify({ ...logPayload, messages: logMessages }, null, 2)
    );
  }

  const requestConfig = {
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      "Content-Type": "application/json",
    },
  };

  // Retry logic for rate limit errors
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `${config.openai.baseUrl}/chat/completions`,
        requestPayload,
        requestConfig
      );

      const content = response.data.choices[0].message.content;

      // Parse JSON response
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", parseError);
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error("AI response is not valid JSON");
        }
      }

      // Validate structure
      if (!parsed.summary || typeof parsed.score !== "number") {
        throw new Error("AI response missing required fields");
      }

      return parsed;
    } catch (error) {
      lastError = error;

      // If it's a rate limit error and we have retries left, wait and retry
      if (isRateLimitError(error) && attempt < maxRetries) {
        const delay = getRetryDelay(error, attempt);
        console.warn(
          `⚠️  Rate limit hit (429). Retrying in ${delay}ms (attempt ${
            attempt + 1
          }/${maxRetries + 1})...`
        );
        await sleep(delay);
        continue;
      }

      // For non-rate-limit errors or if we've exhausted retries, log details and throw
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code,
      };
      console.error(
        "AI grading error details:",
        JSON.stringify(errorDetails, null, 2)
      );
      throw error;
    }
  }

  // If we've exhausted all retries, throw the last error
  throw lastError;
}
