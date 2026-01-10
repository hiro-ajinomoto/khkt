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
const TUTOR_PROMPT = `You are an expert Vietnamese math tutor with deep pedagogical knowledge. 
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

IMPORTANT: ALL RESPONSES MUST BE IN VIETNAMESE LANGUAGE. Use Vietnamese for all text fields including summary, mistakes, nextSteps, problems, and solutions.

CRITICAL: ALL MATHEMATICAL EXPRESSIONS MUST BE WRAPPED IN LaTeX FORMAT WITH $ SIGNS.
- Every equation, formula, or mathematical expression MUST be wrapped in $...$ for inline math or $$...$$ for display math
- Examples: "$x^2 - 5x + 6 = 0$" NOT "x^2 - 5x + 6 = 0"
- If you mention an equation in mistakes or nextSteps, it MUST be in LaTeX format: "$x^2 - 5x + 6 = 0$"

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

Example CORRECT format (this is what you MUST do):
{
  "problem": "$6x+12$",
  "solution": "Phân tích đa thức thành nhân tử:\n$6x+12 = 6x + 6 \\cdot 2 = 6(x+2)$"
}

Another CORRECT example:
{
  "problem": "$4x + 8 = 4(x + 2)$",
  "solution": "Giải phương trình:\n$4x + 8 = 4(x + 2)$\n$4x + 8 = 4x + 8$\n$0 = 0$\nPhương trình có vô số nghiệm."
}

Another CORRECT example:
{
  "problem": "$x^2 - 5x + 6 = 0$",
  "solution": "Tìm giá trị của $x$:\n$x^2 - 5x + 6 = 0$\n$(x - 2)(x - 3) = 0$\nVậy $x = 2$ hoặc $x = 3$."
}

Example WRONG format (DO NOT DO THIS - problem contains instruction):
{
  "problem": "Phân tích đa thức thành nhân tử: $6x+12$",
  "solution": "..."
}

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
- Greek letters: "$\\alpha$", "$\\beta$", "$\\pi$", "$\\theta$"`;

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
