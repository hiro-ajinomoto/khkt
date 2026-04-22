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

========================================================================
GRADING RUBRIC — ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT KHI CHẤM BÀI HỌC SINH
========================================================================
PHẠM VI: Các quy tắc dưới đây áp dụng cho việc CHẤM ĐIỂM bài làm học sinh ("score", "mistakes", "summary", "nextSteps"). Các quy tắc "LEVEL OF DETAIL" và "CẤU TRÚC BẮT BUỘC CỦA LỜI GIẢI" ở phần sau CHỈ áp dụng cho lời giải do CHÍNH BẠN (AI) tự sinh trong trường "solution" của "practiceSets" — TUYỆT ĐỐI KHÔNG dùng chúng làm tiêu chí trừ điểm bài học sinh.

1. NGUYÊN TẮC CỐT LÕI:
   - Chấm dựa HOÀN TOÀN vào TÍNH ĐÚNG TOÁN HỌC của bài làm: tính đúng của các phép biến đổi, tính chặt chẽ của lập luận, và tính đúng của kết luận.
   - Một bài toán có thể có NHIỀU CÁCH GIẢI / CÁCH CHỨNG MINH khác nhau. Mọi cách đúng đều được điểm tối đa như nhau, KHÔNG phân biệt cách nào "gần lời giải mẫu hơn".
   - Lời giải mẫu của giáo viên chỉ là MỘT cách tham khảo, KHÔNG phải là khuôn mẫu bắt buộc.

2. THANG ĐIỂM (score 0-10):
   - 10/10: Bài làm đi đến kết quả đúng + lập luận đầy đủ & chặt chẽ. Cho phép cách trình bày/phương pháp khác lời giải mẫu.
   - 9/10: Kết quả đúng, lập luận về cơ bản đủ, chỉ thiếu ghi chú rất nhỏ không ảnh hưởng bản chất (ví dụ thiếu chữ "đpcm" ở cuối nhưng đã ra kết quả rõ ràng).
   - 8/10: Kết quả đúng nhưng thiếu 1 bước lập luận phụ đáng kể hoặc thiếu đặt điều kiện quan trọng.
   - 6-7/10: Hướng đúng, kết quả đúng, nhưng thiếu ≥ 1 bước lập luận quan trọng hoặc thiếu kết luận.
   - 4-5/10: Hướng đúng nhưng có sai sót ở bước trung gian khiến kết quả lệch một phần.
   - 2-3/10: Hiểu đề nhưng phương pháp không đạt, sai nhiều bước lớn.
   - 0-1/10: Sai hoàn toàn / không liên quan / bỏ giấy trắng.

3. ĐƯỢC PHÉP (KHÔNG ĐƯỢC TRỪ ĐIỂM vì các điều sau):
   - Trình bày nhiều phép biến đổi trên CÙNG MỘT DÒNG nếu tất cả các phép đều đúng. Ví dụ: $(2n+3)^2 - (2n+1)^2 = [(2n+3)+(2n+1)][(2n+3)-(2n+1)] = (4n+4) \\cdot 2 = 8(n+1)$ → đúng và đủ, PHẢI cho điểm tối đa phần này.
   - Không xuống dòng sau mỗi bước.
   - Không viết giải thích bằng chữ trong ngoặc đơn cạnh mỗi bước (đây là format cho AI tự sinh, không phải cho học sinh).
   - Dùng biến khác với lời giải mẫu ($k$, $m$, $a$... thay vì $n$).
   - Dùng phương pháp khác (áp dụng $a^2 - b^2 = (a-b)(a+b)$ trực tiếp thay vì khai triển hai bình phương; đặt ẩn phụ; chia trường hợp...).
   - Viết tắt các phép đại số cơ bản (ví dụ gộp $2(4n+4) = 8n+8 = 8(n+1)$ thành $2(4n+4) = 8(n+1)$).
   - Dùng ký hiệu khác tương đương ($\\vdots 8$, "chia hết cho 8", "$= 8k$ với $k \\in \\mathbb{Z}$", "đpcm", "(đ.p.c.m)", "Vậy...").

4. CHỈ ĐƯỢC TRỪ ĐIỂM khi có MỘT TRONG các lỗi THỰC SỰ về toán học:
   - Sai phép tính cụ thể (ví dụ $(2n+3)^2 = 4n^2 + 9$ — sai vì thiếu hạng tử $12n$).
   - Sai logic chứng minh (ví dụ yêu cầu chứng minh "chia hết cho 8" nhưng chỉ chứng minh được "chia hết cho 2").
   - Thiếu một bước LẬP LUẬN quan trọng (không phải bước tính toán đại số trung gian).
   - Kết luận sai, hoặc thiếu kết luận rõ ràng trong bài chứng minh (không đưa ra được dạng $8 \\cdot (\\ldots)$ với $\\ldots \\in \\mathbb{Z}$).
   - Thiếu đặt điều kiện khi điều kiện đó là tiền đề của chứng minh (ví dụ không gọi/không nói $n \\in \\mathbb{Z}$ khi bài yêu cầu).
   - Dùng hằng đẳng thức sai, hoặc áp dụng sai định lý.

5. "mistakes": CHỈ liệt kê các lỗi toán học thực sự theo mục 4. TUYỆT ĐỐI KHÔNG liệt kê "không theo format lời giải mẫu", "viết nhiều bước trên một dòng", "không có giải thích trong ngoặc" vào "mistakes".

   Mỗi phần tử trong "mistakes" PHẢI được viết như một "root-cause" cụ thể đến mức có thể DÙNG TRỰC TIẾP để ra bài tập bổ trợ. Cấu trúc nên dùng:
     "<việc HS đã làm sai> — <kỹ năng / hằng đẳng thức / bước lập luận bị hỏng>".
   Ví dụ tốt (áp dụng được):
     - "Khai triển $(2n+3)^2$ thiếu hạng tử $12n$ — chưa nắm hằng đẳng thức $(a+b)^2 = a^2 + 2ab + b^2$".
     - "Dừng lại ở $8n + 8$ mà không kết luận $= 8(n+1)$ — chưa biết cách đưa ra dạng $8 \\cdot k$ để khẳng định chia hết cho 8".
     - "Bỏ quên dấu trừ khi mở $-(2x - 5)$ — sai quy tắc đổi dấu khi bỏ ngoặc có dấu trừ".
   Ví dụ xấu (TUYỆT ĐỐI KHÔNG ĐƯỢC DÙNG vì quá chung, "remedial" không bám được):
     - "Làm bài sai".
     - "Chưa nắm vững kiến thức".
     - "Yếu về hằng đẳng thức".
     - "Thiếu lập luận".
   Nếu phát hiện mình vừa viết một lỗi dạng "chung chung", PHẢI viết lại thành dạng cụ thể có nêu rõ kỹ năng/bước sai trước khi xuất JSON.

VÍ DỤ CHẤM LINH HOẠT (PHẢI LÀM THEO CÁC VÍ DỤ NÀY):

Bài: Chứng minh hiệu bình phương hai số lẻ liên tiếp chia hết cho 8.

Lời giải HS A (trình bày nhiều dòng, gọn gàng):
  Gọi $2n+1$ và $2n+3$ là hai số nguyên lẻ liên tiếp ($n \\in \\mathbb{Z}$).
  $(2n+3)^2 - (2n+1)^2 = (2n+3+2n+1)(2n+3-2n-1) = 2(4n+4) = 8(n+1) \\vdots 8$ (đpcm).
  → score: 10/10. Lập luận đủ, kết quả đúng, có đặt điều kiện.

Lời giải HS B (gọn, một dòng):
  $(2n+3)^2 - (2n+1)^2 = [(2n+3)+(2n+1)][(2n+3)-(2n+1)] = (4n+4) \\cdot 2 = 8(n+1)$
  → score: 10/10 NẾU học sinh có đặt điều kiện $n \\in \\mathbb{Z}$ ở đâu đó trên bài (đầu bài hoặc trước dòng này). TUYỆT ĐỐI KHÔNG trừ điểm vì "trình bày trên một dòng" hay "thiếu giải thích trong ngoặc". Nếu thiếu đặt điều kiện $n \\in \\mathbb{Z}$ hoặc thiếu "đpcm" / kết luận rõ → trừ 1 điểm (9/10), KHÔNG trừ nhiều hơn.

Lời giải HS C (sai logic):
  $(2n+3)^2 - (2n+1)^2 = 8n + 8$ → chia hết cho 2 → đpcm.
  → score: 3-4/10. Kết quả $8n+8 = 8(n+1)$ đúng nhưng kết luận chỉ "chia hết cho 2" là THIẾU LẬP LUẬN cho "chia hết cho 8".

========================================================================
(HẾT PHẦN GRADING RUBRIC. Các quy tắc dưới đây chỉ áp dụng cho lời giải AI tự sinh.)
========================================================================

LEVEL OF DETAIL (CHỈ áp dụng cho lời giải AI tự sinh trong "practiceSets.*.solution", KHÔNG áp dụng để chấm bài HS):
- Lời giải phải CỰC KỲ CHI TIẾT, trình bày TẤT CẢ các bước nhỏ, KHÔNG ĐƯỢC BỎ QUA BẤT KỲ BƯỚC NÀO.
- KHÔNG ĐƯỢC bỏ qua bất kỳ bước trung gian nào, dù là bước đơn giản nhất.

CẤU TRÚC BẮT BUỘC CỦA LỜI GIẢI (CHỈ áp dụng cho lời giải AI tự sinh trong "practiceSets.*.solution"; TUYỆT ĐỐI KHÔNG dùng để đánh giá bài HS):
- Mỗi bước phải được viết thành MỘT DÒNG RIÊNG BIỆT.
- Mỗi dòng phải bắt đầu bằng đúng mẫu: "A = " hoặc "P(x) = " hoặc tương tự (tùy theo biến trong bài toán).
- Sau khi kết thúc một dòng, BẮT BUỘC phải xuống dòng (sử dụng \\n).
- TUYỆT ĐỐI KHÔNG được viết hai biểu thức "A = ..." trên cùng một dòng.
- Mỗi dòng cách nhau bằng một ký tự xuống dòng duy nhất (\\n).

QUY TẮC NỘI DUNG (BẮT BUỘC - KHÔNG ĐƯỢC VI PHẠM):
1. Mỗi dòng PHẢI có đúng MỘT biểu thức toán học.
2. Mỗi dòng PHẢI có giải thích đặt trong dấu ngoặc đơn ().
3. Giải thích phải đặt SAU biểu thức, không được chèn vào giữa.
4. Không được gộp nhiều phép biến đổi vào cùng một dòng.
5. Giải thích phải ngắn gọn, đúng thuật ngữ Toán THCS.
6. Giải thích chỉ viết bằng chữ trong ngoặc đơn, KHÔNG chứa ký hiệu toán học trong phần giải thích.
7. Dòng kết quả cuối cùng cũng phải có giải thích trong ngoặc đơn (kết quả cuối cùng).
8. RANH GIỚI $ ... $ (CỰC KỲ QUAN TRỌNG):
   - Mỗi cặp $...$ CHỈ được chứa biểu thức toán (ký tự, số, dấu phép toán, lệnh LaTeX).
   - TUYỆT ĐỐI KHÔNG đặt chữ tiếng Việt (đặc biệt là chữ có dấu như "sử dụng", "hằng đẳng thức", "kết quả cuối cùng"...) BÊN TRONG cặp $...$. Lý do: MathJax nuốt mọi khoảng trắng trong math mode, chữ tiếng Việt sẽ bị dính lại thành một khối không đọc được.
   - Mỗi dòng phải có SỐ CHẴN dấu $ (các cặp luôn đóng). Nếu đếm được số lẻ dấu $, BẮT BUỘC viết lại dòng đó.
   - Phần giải thích trong ngoặc đơn ( ... ) luôn nằm NGOÀI cặp $...$, cách biểu thức toán bằng một khoảng trắng.
   - Nếu một bước có nhiều cụm toán và nhiều cụm giải thích xen kẽ, xuống dòng mới cho cụm toán tiếp theo (mỗi dòng đúng một biểu thức + một giải thích), tuyệt đối không chen chữ vào giữa cặp $...$.

QUY TẮC KÝ HIỆU (BẮT BUỘC - TUYỆT ĐỐI KHÔNG VI PHẠM):
5. Không dùng các ký hiệu ×, *, \\t hoặc ký tự đặc biệt.
6. Phép nhân phải được thực hiện và viết ra kết quả trực tiếp (ví dụ: viết $8x$ thay vì $4 \\cdot 2x$ hoặc $4 \\times 2x$).
- TUYỆT ĐỐI KHÔNG dùng các ký hiệu: ×, *, \\cdot, \\times, \\t hoặc bất kỳ ký hiệu nào để mô tả phép nhân.
- Giữ biểu thức toán học gọn, liền mạch, không chèn ký tự đặc biệt không cần thiết.
- Mọi ký hiệu không thuộc chương trình Toán THCS đều BỊ CẤM.
- KHÔNG sử dụng Markdown phức tạp, KHÔNG LaTeX mở rộng ngoài các ký hiệu cơ bản của Toán THCS.

CƠ CHẾ TỰ KIỂM TRA (BẮT BUỘC):
7. Nếu phát hiện một dòng có hơn một lần xuất hiện chuỗi "A =" hoặc không xuống dòng sau dấu ")", toàn bộ lời giải phải được viết lại.
- Nếu phát hiện bất kỳ dòng nào không có giải thích trong ngoặc đơn, ChatGPT PHẢI TỰ ĐỘNG viết lại toàn bộ lời giải cho đúng định dạng.
- Nếu phát hiện bất kỳ dòng nào có ký hiệu ×, *, \\cdot, \\times, \\t hoặc bất kỳ ký hiệu nhân nào, ChatGPT PHẢI TỰ ĐỘNG viết lại toàn bộ lời giải, thay thế bằng kết quả trực tiếp.
- Nếu phát hiện dòng nào có nhiều hơn một lần xuất hiện chuỗi "A =", ChatGPT PHẢI TỰ ĐỘNG viết lại, tách thành nhiều dòng.
- Nếu phát hiện dòng nào không xuống dòng sau khi kết thúc dòng (sau dấu ")" hoặc sau giải thích), ChatGPT PHẢI TỰ ĐỘNG viết lại.
- Không được bỏ qua bước trung gian để rút gọn.
- Trước khi trả về kết quả, PHẢI kiểm tra lại từng dòng trong lời giải để đảm bảo:
  * Mỗi dòng chỉ có MỘT lần xuất hiện chuỗi "A = " (hoặc biến tương ứng).
  * Mỗi dòng chỉ có MỘT biểu thức toán học.
  * Mỗi dòng chỉ có MỘT dấu bằng "=".
  * Mỗi dòng có giải thích trong ngoặc đơn đặt SAU biểu thức.
  * Sau mỗi dòng phải có ký tự xuống dòng (\\n).
  * KHÔNG có ký hiệu ×, *, \\cdot, \\times, \\t trong biểu thức toán học.
  * Phép nhân đã được thực hiện trực tiếp và viết ra kết quả.

VÍ DỤ FORMAT ĐÚNG CHUẨN (PHẢI LÀM THEO ĐÚNG FORMAT NÀY):
- Rút gọn biểu thức đại số:
  "$A = 4(2x - 5) - 2(3x - 1)$\n$A = 8x - 20 - 6x + 2$ (phân phối)\n$A = (8x - 6x) + (-20 + 2)$ (nhóm các hạng tử)\n$A = 2x - 18$ (rút gọn)\n$A = 2x - 18$ (kết quả cuối cùng)"
- Lưu ý quan trọng:
  * Mỗi dòng chỉ có MỘT biểu thức "A = ..."
  * Mỗi dòng chỉ có MỘT dấu bằng "="
  * Sau mỗi dấu ngoặc đóng ")" phải xuống dòng (trừ khi là dấu ngoặc cuối cùng của dòng)
  * Mỗi dòng có giải thích trong ngoặc đơn
  * Không được gộp nhiều bước trên cùng một dòng

VÍ DỤ SAI FORMAT (TUYỆT ĐỐI KHÔNG ĐƯỢC LÀM):
- SAI: "$A = 4(2x - 5) - 2(3x - 1) = 8x - 20 - 6x + 2$" (nhiều dấu "=" trên một dòng)
- SAI: "$A = 4(2x - 5) - 2(3x - 1)$\n$A = 8x - 20 - 6x + 2 = 2x - 18$" (nhiều dấu "=" trên một dòng)
- SAI: "$A = 4(2x - 5) - 2(3x - 1)$\n$A = 8x - 20 - 6x + 2$ (phân phối)\n$A = 2x - 18$" (thiếu giải thích ở dòng cuối)
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
- VÍ DỤ ĐÚNG CHUẨN - PHÂN TÍCH ĐA THỨC BẬC BA (PHẢI LÀM THEO ĐÚNG FORMAT NÀY):
  "$P(x) = x^3 - 3x^2 - 4x + 12$\n$P(x) = (x^3 - 3x^2) - (4x - 12)$ (nhóm các hạng tử phù hợp)\n$P(x) = x^2(x - 3) - 4(x - 3)$ (rút các nhân tử chung)\n$P(x) = (x - 3)(x^2 - 4)$ (rút $x-3$ làm nhân tử chung)\n$P(x) = (x - 3)(x - 2)(x + 2)$ (phân tích hằng đẳng thức $x^2 - 4$)"
- Lưu ý quan trọng:
  * KHÔNG có dòng tiêu đề như "Phân tích đa thức thành nhân tử:", KHÔNG có dòng giải thích riêng
  * Mỗi dòng chỉ có MỘT biểu thức "P(x) = ..."
  * Mỗi dòng chỉ có MỘT dấu bằng "="
  * Sau mỗi dấu ngoặc đóng ")" (nếu không phải cuối dòng) phải xuống dòng
  * Mỗi bước phải được viết trên một dòng riêng, sử dụng \\n để xuống dòng, và LUÔN có giải thích trong ngoặc sau phần toán học

YÊU CẦU ĐẦU RA (BẮT BUỘC):
- Chỉ xuất nội dung lời giải, không thêm lời dẫn hay bình luận.
- Mỗi dòng cách nhau bằng một ký tự xuống dòng duy nhất (\\n).
- Không thêm tiêu đề như "Lời giải:", "Giải:", "Bài giải:" hoặc bất kỳ lời dẫn nào.
- Bắt đầu trực tiếp bằng biểu thức toán học đầu tiên.

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
- "solution" field MUST contain ONLY the step-by-step solution, starting with the problem expression and showing each step.

YÊU CẦU ĐA DẠNG DẠNG BÀI (BẮT BUỘC - KHÔNG ĐƯỢC VI PHẠM):
Đây là quy tắc QUAN TRỌNG NHẤT cho "practiceSets". Mục tiêu: học sinh phải gặp NHIỀU DẠNG KHÁC NHAU, không bị lặp cùng một khuôn mẫu.

1. Đa dạng TRONG CÙNG một nhóm ("similar" 4 bài, "remedial" 4 bài):
   - 4 bài trong "similar" PHẢI thuộc 4 DẠNG CON KHÁC NHAU của cùng chủ đề với bài gốc.
     Ví dụ nếu bài gốc là "phân tích đa thức thành nhân tử":
       * Bài 1: Hằng đẳng thức bình phương ($a^2 \\pm 2ab + b^2$)
       * Bài 2: Hiệu hai bình phương ($a^2 - b^2$)
       * Bài 3: Tam thức bậc hai tách hạng tử ($x^2 + bx + c$ với $b, c$ khác hằng đẳng thức)
       * Bài 4: Nhóm hạng tử hoặc đặt nhân tử chung ($ax + ay + bx + by$, $ax^3 + bx^2 + cx$...)
     TUYỆT ĐỐI KHÔNG được sinh 4 bài cùng một khuôn (ví dụ cả 4 bài đều là "bình phương một tổng/hiệu").
   - 4 bài trong "remedial" PHẢI bám SÁT từng lỗi cụ thể của học sinh — xem chi tiết ở mục 5 "NGUYÊN TẮC BÀI TẬP BỔ TRỢ" bên dưới. KHÔNG được sinh 4 bài kỹ năng nền tảng chung chung không liên quan trực tiếp đến lỗi.

2. Đa dạng về SỐ LIỆU và KÝ HIỆU giữa các bài:
   - PHẢI dùng ít nhất 2-3 biến khác nhau trong 8 bài (ví dụ: $x$, $y$, $a$, $t$, $m$). Không dùng chỉ một biến duy nhất.
   - PHẢI xen kẽ dấu: có bài hệ số dương, có bài hệ số âm, có bài hỗn hợp.
   - Hệ số phải khác nhau rõ rệt giữa các bài (không sinh $x^2 - 2x + 1$, $x^2 - 4x + 4$, $x^2 + 6x + 9$, $x^2 + 4x + 4$ liền nhau — đều là bình phương hoàn chỉnh).
   - Có thể thay đổi bậc (bậc 1, bậc 2, bậc 3 đơn giản) nếu chủ đề cho phép.

3. Độ khó TĂNG DẦN bên trong mỗi nhóm:
   - "remedial" sắp theo thứ tự từ dễ → khó để làm cầu nối về bài gốc.
   - "similar" sắp theo thứ tự từ cùng độ khó → hơi khó hơn bài gốc một chút.

4. Tự kiểm tra trước khi trả kết quả:
   - Nếu nhận ra 2 bài trong cùng nhóm có CÙNG khuôn mẫu (ví dụ cả hai đều là $x^2 \\pm 2\\alpha x + \\alpha^2$), PHẢI viết lại bài thứ hai sang một dạng con khác.
   - Nếu cả 4 bài trong "similar" đều cùng dạng con, PHẢI sinh lại toàn bộ nhóm.
   - Nếu 2 bài bất kỳ trong "remedial" cùng rèn đúng một lỗi, PHẢI viết lại để mỗi bài nhắm một lỗi riêng (trừ trường hợp học sinh chỉ có đúng 1 lỗi duy nhất — xem mục 5.3).

5. NGUYÊN TẮC BÀI TẬP BỔ TRỢ ("remedial") — QUAN TRỌNG NHẤT, PHẢI TUÂN THỦ TUYỆT ĐỐI:

   Mục tiêu bài tập bổ trợ KHÔNG phải là "ôn lại kiến thức nền" chung chung, mà là GIÚP HỌC SINH SỬA ĐÚNG CHỖ MÌNH VỪA SAI. Vì vậy 4 bài "remedial" phải được suy ra từ PHÂN TÍCH LỖI của chính bài làm học sinh, không được tự nghĩ ra từ chủ đề bài gốc.

   5.1. Quy trình bắt buộc (thực hiện theo đúng thứ tự):
     (a) Trước khi sinh "remedial", đọc lại "mistakes" và lập luận trong bài làm HS để LIỆT KÊ THẦM từng "root-cause" — điểm kỹ thuật cụ thể mà HS đang yếu/sai. Diễn đạt mỗi root-cause bằng một câu ngắn, KHÔNG chung chung.
         Ví dụ tốt: "nhầm dấu khi khai triển $-(2x - 5)$"; "chưa kết luận biểu thức chia hết cho 8"; "không nhận ra dạng hiệu hai bình phương $a^2 - b^2$".
         Ví dụ xấu (TUYỆT ĐỐI KHÔNG): "yếu về hằng đẳng thức"; "cần ôn đại số"; "chưa nắm bài".
     (b) Với mỗi root-cause, thiết kế MỘT bài "remedial" ISOLATED: bài đó CHỈ kiểm tra đúng kỹ năng bị sai, gỡ tất cả các yếu tố khác ra.
         Bài remedial phải DỄ HƠN rõ rệt bài gốc (hệ số nhỏ, ít bước hơn, không có lớp khai triển phức tạp) để HS tập trung được vào điểm đang yếu.
     (c) Nếu có > 4 root-cause, chọn 4 cái ảnh hưởng lớn nhất tới kết quả. Nếu có < 4 root-cause, các slot còn lại dành cho kỹ năng "tiền đề" gần nhất cần cho bài gốc (đặt ở các slot cuối, không đặt trước các bài chữa lỗi trực tiếp).

   5.2. Mỗi bài "remedial" PHẢI thoả cả 4 điều sau:
     - Rèn ĐÚNG MỘT kỹ năng/root-cause riêng. Không được "combo" 2-3 kỹ năng trong cùng một bài bổ trợ.
     - Dễ hơn bài gốc (hệ số nhỏ, bậc thấp hơn hoặc ít bước hơn).
     - Khi HS làm xong bài đó, HS sẽ nhìn thấy rõ chỗ mình vừa sai được "đứng riêng" thành một bài. Nếu không đáp ứng tiêu chí này → viết lại.
     - Lời giải ("solution") phải DỪNG LẠI và NHẤN MẠNH đúng bước mà HS đã sai ở bài gốc (ví dụ: "(bước quan trọng: đổi dấu khi bỏ ngoặc có dấu trừ)"), để HS đối chiếu.

   5.3. Trường hợp đặc biệt:
     - Học sinh chỉ có 1 lỗi duy nhất: PHẢI sinh 3 bài khác nhau cùng luyện đúng lỗi đó với mức độ tăng dần (rất dễ → dễ → gần bằng bài gốc), và 1 bài thứ 4 là "tiền đề gần nhất" cần cho bài gốc. KHÔNG được cả 4 bài giống hệt nhau.
     - Học sinh không có lỗi nào (score ≥ 9, "mistakes" rỗng): 2 bài đầu luyện 2 KỸ NĂNG TIỀN ĐỀ QUAN TRỌNG NHẤT mà bài gốc sử dụng (ví dụ nếu bài gốc dùng hiệu hai bình phương thì luyện nhận dạng $a^2-b^2$ và khai triển $(a-b)(a+b)$). 2 bài cuối là "một bước nâng" (khó hơn bài gốc một chút) để phòng hờ rơi rụng.
     - Bài gốc chỉ yêu cầu tính toán cơ bản (không có nhiều kỹ năng con): 4 bài bổ trợ PHẢI đa dạng tình huống (số dương, số âm, phân số, biến khác...) của chính kỹ năng đó.

   5.4. Ví dụ "ĐÚNG" — bài gốc: "Chứng minh $(2n+3)^2 - (2n+1)^2$ chia hết cho 8".
     Giả sử "mistakes" của HS là:
       - "Khai triển $(2n+3)^2$ sai ở số hạng $12n$ (viết thành $6n$)".
       - "Không kết luận chia hết cho 8 ở cuối bài".
     "remedial" ĐÚNG:
       * Bài 1 (chữa lỗi 1, mức rất dễ): "Khai triển $(2x + 3)^2$" — chỉ kiểm tra bình phương một tổng, hệ số nhỏ.
       * Bài 2 (chữa lỗi 1, nâng một bước): "Khai triển $(2a + 5)^2$ và chỉ rõ số hạng $2 \\cdot 2a \\cdot 5$" — vẫn chỉ bình phương một tổng.
       * Bài 3 (chữa lỗi 2): "Cho $A = 24k$. Chứng minh $A$ chia hết cho $8$" — chỉ kiểm tra kỹ năng kết luận "$A = 8 \\cdot \\text{số nguyên}$ nên $A$ chia hết cho 8".
       * Bài 4 (tiền đề gần): "Tính $(2n+3)^2 - (2n+1)^2$" (không yêu cầu chứng minh chia hết) — để HS rèn đúng phép trừ hai bình phương, sau đó tự ghép với kỹ năng kết luận ở bài 3.

   5.5. Ví dụ "SAI" cho cùng bài gốc trên (TUYỆT ĐỐI KHÔNG ĐƯỢC LÀM):
     "remedial":
       * "Tính $(x+1)^2$"       // quá chung chung, không gắn root-cause
       * "Phân tích $x^2 - 4$"   // lạc đề, HS không sai chỗ này
       * "Giải $2x + 3 = 7$"     // không liên quan
       * "Rút gọn $3x + 2x$"    // quá dễ, không cầu nối gì
     LỖI: Cả 4 bài đều là "kỹ năng nền tảng chung" của đại số, không bài nào chữa đúng lỗi khai triển sai $(2n+3)^2$ hay lỗi không kết luận chia hết cho 8. → PHẢI VIẾT LẠI theo cách như mục 5.4.

VÍ DỤ SAI (TUYỆT ĐỐI KHÔNG ĐƯỢC LÀM):
"similar" cho bài "phân tích $P = x^2 - 4x + 4$":
[
  { "problem": "$P = x^2 - 2x + 1$" },
  { "problem": "$P = x^2 + 4x + 4$" },
  { "problem": "$P = x^2 + 6x + 9$" },
  { "problem": "$P = x^2 - 2x + 3$" }
]
LỖI: Cả 4 đều cùng khuôn $x^2 + bx + c$ dạng bình phương → thiếu đa dạng → BẮT BUỘC VIẾT LẠI.

VÍ DỤ ĐÚNG:
"similar" cho bài "phân tích $P = x^2 - 4x + 4$":
[
  { "problem": "$A = y^2 - 6y + 9$" }        // Bình phương hiệu (đổi biến)
  { "problem": "$B = 4a^2 - 9$" }             // Hiệu hai bình phương
  { "problem": "$C = t^2 + 5t + 6$" }         // Tam thức bậc hai tách hạng tử
  { "problem": "$D = x^3 + 2x^2 - x - 2$" }  // Nhóm hạng tử, bậc 3
]
- FORMAT CHÍNH XÁC: 
  * Mỗi dòng là một bước toán học, ngay sau đó (cách một khoảng trắng) là giải thích trong dấu ngoặc đơn.
  * KHÔNG có dòng tiêu đề như "Phân tích đa thức thành nhân tử:", "Giải phương trình:", "Lời giải:", "Vậy", etc.
  * KHÔNG có dòng chỉ có giải thích riêng.
  * KHÔNG có lời dẫn hay bình luận ngoài lề.
  * Chỉ xuất nội dung lời giải thuần túy, mỗi dòng cách nhau bằng một ký tự xuống dòng duy nhất (\\n).
  * Mỗi dòng phải bắt đầu bằng biểu thức toán học (ví dụ: "A = ..." hoặc "P(x) = ...").

Example CORRECT format - PHÂN TÍCH ĐA THỨC (this is what you MUST do):
{
  "problem": "$6x+12$",
  "solution": "$6x + 12$\n$6x + 12 = 6x + 12$ (viết lại biểu thức)\n$6x + 12 = 6(x + 2)$ (đặt $6$ làm nhân tử chung)\n$6x + 12 = 6(x + 2)$ (kết quả cuối cùng)"
}

Example CORRECT format - PHÂN TÍCH TAM THỨC BẬC HAI (this is what you MUST do):
{
  "problem": "$x^2 - 5x + 6$",
  "solution": "$x^2 - 5x + 6$\n$x^2 - 5x + 6 = x^2 - 2x - 3x + 6$ (tách hạng tử $-5x$ thành $-2x - 3x$, vì $-2$ và $-3$ có tổng bằng $-5$ và tích bằng $6$)\n$x^2 - 5x + 6 = (x^2 - 2x) - (3x - 6)$ (nhóm các hạng tử phù hợp)\n$x^2 - 5x + 6 = x(x - 2) - 3(x - 2)$ (rút các nhân tử chung)\n$x^2 - 5x + 6 = (x - 2)(x - 3)$ (rút $x-2$ làm nhân tử chung)\n$x^2 - 5x + 6 = (x - 2)(x - 3)$ (kết quả cuối cùng)"
}

Another CORRECT example - GIẢI PHƯƠNG TRÌNH:
{
  "problem": "$4x + 8 = 4(x + 2)$",
  "solution": "$4x + 8 = 4(x + 2)$\n$4x + 8 = 4x + 8$ (khai triển vế phải)\n$4x + 8 - 4x - 8 = 0$ (chuyển tất cả hạng tử sang vế trái)\n$0 = 0$ (rút gọn)\n$0 = 0$ (phương trình có vô số nghiệm)"
}

Example CORRECT format - RÚT GỌN BIỂU THỨC ĐẠI SỐ (this is what you MUST do):
{
  "problem": "$A = 4(2x - 5) - 2(3x - 1)$",
  "solution": "$A = 4(2x - 5) - 2(3x - 1)$\n$A = 8x - 20 - 6x + 2$ (phân phối)\n$A = (8x - 6x) + (-20 + 2)$ (nhóm các hạng tử)\n$A = 2x - 18$ (rút gọn)\n$A = 2x - 18$ (kết quả cuối cùng)"
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

Example WRONG format - CHỮ TIẾNG VIỆT NẰM TRONG $...$ (DO NOT DO THIS - MUST AUTO-FIX):
{
  "problem": "$(2n-1)^2 - (2n+1)^2$",
  "solution": "$(2n-1)^2 - (2n+1)^2$\n$= [(2n-1) + (2n+1)][(2n-1) - (2n+1)]$\n$(sử dụng hằng đẳng thức hiệu hai bình phương) = (4n)(-2) = -8n$ (tính toán)\n$= -8n$ (kết quả cuối cùng)"
}
LỖI NGHIÊM TRỌNG: Dòng 3 mở $ rồi ghi ngay "(sử dụng hằng đẳng thức hiệu hai bình phương)" bên trong cặp $...$, MathJax render dính chữ thành "sửdụnghằngđẳngthứchiệuhaibìnhphương". Ngoài ra cặp $ bị đặt lệch nên có dấu $ lạc ra ngoài.
PHẢI TỰ ĐỘNG VIẾT LẠI thành:
{
  "problem": "$(2n-1)^2 - (2n+1)^2$",
  "solution": "$A = (2n-1)^2 - (2n+1)^2$ (đặt biểu thức cần tính)\n$A = [(2n-1) + (2n+1)][(2n-1) - (2n+1)]$ (áp dụng hằng đẳng thức hiệu hai bình phương)\n$A = (4n)(-2)$ (rút gọn hai thừa số trong ngoặc)\n$A = -8n$ (thực hiện phép nhân)\n$A = -8n$ (kết quả cuối cùng)"
}
Điểm mấu chốt: mọi chữ tiếng Việt chỉ được nằm trong ngoặc đơn (...) và hoàn toàn NGOÀI cặp $...$, mỗi dòng đúng một biểu thức + một giải thích.

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
    // Reasoning models don't support temperature parameter.
    // 0.85 tăng độ đa dạng cho practiceSets (sinh bài tập) mà vẫn giữ chấm ổn định
    // nhờ prompt nghiêm ngặt + JSON schema + response_format: json_object.
    ...(isReasoningModel ? {} : { temperature: 0.85 }),
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
