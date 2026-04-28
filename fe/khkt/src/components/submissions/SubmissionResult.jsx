import { useState, useEffect, useRef } from 'react';
import ImageLightbox from '../ui/ImageLightbox';
import './SubmissionResult.css';

const CIRCLED_NUMS = [
  '❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽', '❾', '❿',
  '⓫', '⓬', '⓭', '⓮', '⓯', '⓰', '⓱', '⓲', '⓳', '⓴',
];
function circledNum(n) {
  return CIRCLED_NUMS[n - 1] ?? String(n);
}

function PracticeSection({
  variant,
  icon,
  title,
  subtitle,
  items,
  showSolutions,
  setShowSolutions,
  renderTextWithMath,
  renderMath,
  defaultOpen,
}) {
  const toggle = (key) =>
    setShowSolutions((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultOpen) }));

  return (
    <section className={`practice-section practice-section--${variant}`}>
      <header className="practice-section-header">
        <span className="practice-section-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="practice-section-titles">
          <h3 className="practice-section-title">{title}</h3>
          <p className="practice-section-sub">{subtitle}</p>
        </div>
      </header>

      <div className="practice-card-list">
        {items.map((item, index) => {
          const key = `${variant}-${index}`;
          const isOpen = showSolutions[key] ?? defaultOpen;
          const hasSolution = !!item.solution;

          return (
            <article
              key={index}
              className={`practice-card practice-card--${variant} ${
                isOpen ? 'is-open' : ''
              }`}
            >
              <div className="practice-card-body">
                <div className="practice-card-row">
                  <span className="practice-num" aria-hidden="true">
                    {circledNum(index + 1)}
                  </span>
                  <div className="practice-problem-text math-content">
                    {renderTextWithMath(item.problem, renderMath)}
                  </div>
                </div>

                {hasSolution && (
                  <button
                    type="button"
                    className={`practice-toggle ${isOpen ? 'is-open' : ''}`}
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                  >
                    <span className="practice-toggle-label">
                      {isOpen ? 'Thu gọn lời giải' : 'Xem lời giải'}
                    </span>
                    <span className="practice-toggle-chevron" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                )}
              </div>

              {hasSolution && isOpen && (
                <div className="practice-solution-body">
                  <span className="solution-label">LỜI GIẢI</span>
                  <div className="solution-text math-content">
                    {renderTextWithMath(item.solution, renderMath)}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

// Math rendering hook using MathJax
function useMathRenderer() {
  const [mathjaxLoaded, setMathjaxLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadMathJax() {
      try {
        // Check if MathJax is already loaded and configured
        if (window.MathJax && window.MathJax.typesetPromise) {
          if (mounted) {
            setMathjaxLoaded(true);
            setLoading(false);
          }
          return;
        }

        // Configure MathJax before loading
        window.MathJax = {
          tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']],
            processEscapes: true,
            processEnvironments: true,
            autoload: {
              color: [],
              colorv2: ['color'],
            },
            packages: {'[+]': ['ams', 'newcommand', 'configMacros']},
          },
          options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            ignoreHtmlClass: '.*',
            processHtmlClass: 'math-content',
          },
          startup: {
            ready: () => {
              if (window.MathJax && window.MathJax.startup && window.MathJax.startup.defaultReady) {
                window.MathJax.startup.defaultReady();
                if (mounted) {
                  setMathjaxLoaded(true);
                  setLoading(false);
                }
              }
            },
          },
        };

        // Load MathJax script
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
        script.async = true;
        script.onload = () => {
          // MathJax will call startup.ready() when ready
          if (mounted && window.MathJax && !window.MathJax.startup) {
            // If startup wasn't called, set loaded manually
            setTimeout(() => {
              if (mounted && window.MathJax && window.MathJax.typesetPromise) {
                setMathjaxLoaded(true);
                setLoading(false);
              }
            }, 100);
          }
        };
        script.onerror = () => {
          console.warn('Failed to load MathJax');
          if (mounted) {
            setMathjaxLoaded(false);
            setLoading(false);
          }
        };
        document.head.appendChild(script);
      } catch (error) {
        console.warn('MathJax loading error:', error);
        if (mounted) {
          setMathjaxLoaded(false);
          setLoading(false);
        }
      }
    }

    loadMathJax();

    return () => {
      mounted = false;
    };
  }, []);

  const renderMath = (math, options = {}) => {
    // MathJax handles rendering automatically, just return the math expression
    return math;
  };

  return { renderMath, loading, mathjaxLoaded };
}

/**
 * Auto-detect and convert math expressions to LaTeX format
 * Detects patterns like: x^2 - 5x + 6 = 0 and converts to $x^2 - 5x + 6 = 0$
 * @param {string} text - Text that may contain math expressions
 * @returns {string} Text with math expressions wrapped in $ signs
 */
function autoDetectMath(text) {
  if (!text) return text;
  
  // Pattern to detect math expressions: contains ^, _, =, +, -, *, /, numbers, variables
  // Match expressions like: x^2 - 5x + 6 = 0, x^2, 2x + 3, etc.
  const mathPattern = /([a-zA-Z]\^?\d*[\s]*[+\-*/=<>≤≥≠±][\s]*[a-zA-Z0-9^_\s+\-*/=<>≤≥≠±()]+)/g;
  
  let result = text;
  const matches = [...text.matchAll(mathPattern)];
  
  // Process matches in reverse to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const expression = match[0].trim();
    
    // Skip if already wrapped in $ or $$, or if it's too short
    if (expression.includes('$') || expression.length < 3) continue;
    
    // Check if it looks like a math expression (contains operators or superscripts)
    if (/[\^_+\-*/=<>≤≥≠±]/.test(expression) || /\d+[a-zA-Z]|[a-zA-Z]\d+/.test(expression)) {
      // Check if it's not already part of a LaTeX expression
      const before = text.substring(0, match.index);
      const after = text.substring(match.index + match[0].length);
      
      if (!before.endsWith('$') && !after.startsWith('$')) {
        result = result.substring(0, match.index) + 
                 '$' + expression + '$' + 
                 result.substring(match.index + match[0].length);
      }
    }
  }
  
  return result;
}

// Ký tự tiếng Việt có dấu — dùng để nhận biết "prose" lẫn trong math.
const VI_DIACRITICS_RE =
  /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;

/**
 * Chuẩn hoá một dòng lời giải do AI sinh ra trước khi đưa cho MathJax:
 *  (a) Tách các cụm (...) chứa tiếng Việt ra khỏi cặp $...$.
 *  (b) Cắt các cụm (...) tiếng Việt cuối dòng thành "giải thích" nằm ngoài math.
 *  (c) Nếu phần còn lại trông như math (có =, +, -, ^, \times...) nhưng không được
 *      bọc $...$ (hoặc bị thiếu 1 trong 2 dấu), tự động bổ sung cặp $...$ cho đúng.
 *
 * Ví dụ các ca AI hay sinh sai mà hàm này sửa được:
 *   "$(sử dụng hằng đẳng thức) = (4n)(-2) = -8n$ (tính toán)"
 *     → "(sử dụng hằng đẳng thức) $= (4n)(-2) = -8n$ (tính toán)"
 *   "= [(2n+5)+(2n+3)] \\times [(2n+5)-(2n+3)]$ (sử dụng công thức)"
 *     → "$= [(2n+5)+(2n+3)] \\times [(2n+5)-(2n+3)]$ (sử dụng công thức)"
 *   "= 8(n+1)$ (rút gọn)"
 *     → "$= 8(n+1)$ (rút gọn)"
 *   "= (4n - 2)(4) (rút gọn)"
 *     → "$= (4n - 2)(4)$ (rút gọn)"
 */
function stripVietnameseProseFromMath(input) {
  if (!input || typeof input !== 'string') return input;

  const lines = input.split('\n');
  const fixed = lines.map((rawLine) => {
    let line = rawLine;

    // (1) Lột dần các cụm (...) tiếng Việt ở cuối dòng ra làm giải thích.
    //     Dừng ngay khi gặp một cụm ngoặc KHÔNG có chữ tiếng Việt — ví dụ "(4n - 2)"
    //     là biểu thức toán, phải giữ lại trong math.
    let proseSuffix = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const m = line.match(/\s*\(([^()]+)\)\s*$/);
      if (!m || !VI_DIACRITICS_RE.test(m[1])) break;
      proseSuffix = ` (${m[1].trim()})${proseSuffix}`;
      line = line.slice(0, line.length - m[0].length);
    }
    line = line.trim();

    // (2) Trong các cặp $...$ còn lại, kéo các (...) có tiếng Việt ra ngoài
    //     (xử lý ca AI nhồi chữ vào giữa math khiến khoảng trắng bị nuốt).
    line = line.replace(/\$([^$\n]+?)\$/g, (match, inner) => {
      const parenRe = /\s*\(([^()]+)\)\s*/g;
      const chunks = [];
      const stripped = inner.replace(parenRe, (pm, pInner) => {
        if (VI_DIACRITICS_RE.test(pInner)) {
          chunks.push(`(${pInner.trim()})`);
          return ' ';
        }
        return pm;
      });
      if (chunks.length === 0) return match;
      const mathRemainder = stripped.replace(/\s+/g, ' ').trim();
      const prose = chunks.join(' ');
      if (!mathRemainder || /^[=\s]+$/.test(mathRemainder)) return ` ${prose} `;
      return ` ${prose} $${mathRemainder}$ `;
    });

    // (3) Chuẩn hoá dấu $ cho phần math còn lại.
    if (line) {
      const dollarCount = (line.match(/\$/g) || []).length;
      const hasLatexCmd =
        /\\[a-zA-Z]+/.test(line) || /\^/.test(line) || /_\{/.test(line);
      const looksLikeMath =
        /[=+\-*/<>≤≥≠±]/.test(line) && /[a-zA-Z0-9]/.test(line);

      if (dollarCount === 0 && (hasLatexCmd || looksLikeMath)) {
        // Toàn bộ dòng là math mà quên bọc $...$.
        line = `$${line}$`;
      } else if (dollarCount === 1) {
        const idx = line.indexOf('$');
        const before = line.slice(0, idx).trim();
        const after = line.slice(idx + 1).trim();
        if (before === '') {
          // "$math..." — thiếu $ đóng ở cuối.
          line = `${line}$`;
        } else if (after === '') {
          // "math...$" — thiếu $ mở ở đầu.
          line = `$${line}`;
        } else {
          // $ lạc giữa dòng: coi cả dòng là math, bỏ dấu $ lẻ ở giữa.
          line = `$${line.slice(0, idx)}${line.slice(idx + 1)}$`;
        }
      } else if (dollarCount > 1 && dollarCount % 2 === 1) {
        // Có nhiều cặp $...$ nhưng lẻ thêm một dấu — bỏ dấu $ cuối cùng.
        const lastIdx = line.lastIndexOf('$');
        line = `${line.slice(0, lastIdx)}${line.slice(lastIdx + 1)}`;
      }
    }

    const combined = (line + proseSuffix).replace(/[ \t]{2,}/g, ' ');
    return combined.trimEnd();
  });

  return fixed.join('\n');
}

/**
 * Bỏ cặp $...$ hoặc $$...$$ nếu bên trong có chữ tiếng Việt có dấu.
 * MathJax coi nội dung là "math mode" và nuốt khoảng trắng → chữ dính (vd. Gọichiềurộng).
 * Biểu thức thuần toán không dấu vẫn giữ trong $...$.
 */
function unwrapMathWrappersContainingVietnamese(input) {
  if (!input || typeof input !== 'string') return input;
  let out = input;
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (full, inner) => {
    if (VI_DIACRITICS_RE.test(inner)) return inner.trim();
    return full;
  });
  out = out.replace(/\$([^$]+)\$/g, (full, inner) => {
    if (VI_DIACRITICS_RE.test(inner)) return inner;
    return full;
  });
  return out;
}

/**
 * Render text with LaTeX math expressions using MathJax
 * Supports inline math: $...$ and display math: $$...$$
 * @param {string} text - Text with LaTeX math
 * @param {Function} renderMathFn - Function to render math (not used with MathJax, kept for compatibility)
 * @returns {JSX.Element} Rendered text with math
 */
function renderTextWithMath(text, renderMathFn) {
  if (!text) return null;
  
  // LaTeX command constants to avoid escape sequence issues
  // Use String.fromCharCode or concatenation to avoid \t in \times being parsed as tab
  const LATEX_TIMES = String.fromCharCode(92) + 'times'; // \times
  const LATEX_DELTA = String.fromCharCode(92) + 'Delta'; // \Delta
  const LATEX_DIV = String.fromCharCode(92) + 'div'; // \div
  const LATEX_PM = String.fromCharCode(92) + 'pm'; // \pm
  const LATEX_SQRT = String.fromCharCode(92) + 'sqrt'; // \sqrt
  const LATEX_FRAC = String.fromCharCode(92) + 'frac'; // \frac
  
  // Chuẩn hoá format do AI sinh ra: kéo chữ tiếng Việt ra khỏi $...$, tự bổ
  // sung cặp $...$ thiếu, cân bằng dấu $ lẻ. Hàm này thay thế autoDetectMath
  // vì autoDetectMath dùng regex ASCII không nhận `[`, `]`, dễ match "lố" vào
  // giữa cặp $...$ đã đúng khiến MathJax render hỏng các dòng dài.
  let processedText = unwrapMathWrappersContainingVietnamese(
    stripVietnameseProseFromMath(text),
  );

  // Fix common LaTeX issues that might cause "Math input error"
  // Replace double backslashes with single backslash for LaTeX commands
  processedText = processedText.replace(/\\\\+([a-zA-Z]+)/g, (match, command) => {
    // Common LaTeX commands
    const latexCommands = ['Delta', 'pm', 'sqrt', 'frac', 'cdot', 'times', 'div', 
                          'alpha', 'beta', 'pi', 'theta', 'sin', 'cos', 'tan', 'log', 'ln',
                          'sum', 'prod', 'int', 'lim', 'infty', 'partial', 'text'];
    if (latexCommands.includes(command)) {
      return `\\${command}`;
    }
    return match;
  });
  
  // Fix common text errors from AI that should be LaTeX
  // Replace "imes" with \times (multiplication) - handle both standalone and in expressions
  processedText = processedText.replace(/\bimes\b/g, String.raw`\times`);
  // Replace "riangle" with \Delta (delta/discriminant)
  processedText = processedText.replace(/\briangle\b/g, String.raw`\Delta`);
  // Replace Unicode multiplication × with \times
  processedText = processedText.replace(/×/g, String.raw`\times`);
  // Replace Unicode division ÷ with \div
  processedText = processedText.replace(/÷/g, String.raw`\div`);
  // Replace Unicode plus-minus ± with \pm
  processedText = processedText.replace(/±/g, String.raw`\pm`);
  // Replace Unicode delta Δ (Greek) and ∆ (mathematical operator) with \Delta
  processedText = processedText.replace(/[Δ∆]/g, String.raw`\Delta`);
  
  // Fix patterns like "4imes1imes3" → "4 \times 1 \times 3" (inside math expressions)
  // This handles cases where AI writes "imes" without spaces
  processedText = processedText.replace(/(\d+|[a-zA-Z])\s*imes\s*(\d+|[a-zA-Z])/g, '$1 ' + String.raw`\times` + ' $2');
  
  // Fix "riangle = " pattern
  processedText = processedText.replace(/\briangle\s*=/g, String.raw`\Delta =`);
  
  // Fix "Tính riangle:" or "Tính ∆:" → "Tính $\Delta$:"
  processedText = processedText.replace(/Tính\s+(riangle|[Δ∆]):/g, 'Tính $' + String.raw`\Delta` + '$:');
  
  // Fix "∆ = " → "$\Delta = $"
  processedText = processedText.replace(/([Δ∆])\s*=/g, '$' + String.raw`\Delta` + ' = ');
  
  // Remove tab characters and normalize whitespace (but preserve line breaks)
  processedText = processedText.replace(/\t/g, ' ');
  // Normalize multiple spaces but preserve \n (line breaks)
  processedText = processedText.replace(/[ \t]+/g, ' '); // Replace multiple spaces/tabs with single space
  processedText = processedText.replace(/[ \t]*\n[ \t]*/g, '\n'); // Normalize line breaks but keep them
  
  // Fix "rac" → "frac" (common typo from AI)
  processedText = processedText.replace(/\brac\{([^}]+)\}\{([^}]+)\}/g, String.raw`\frac{$1}{$2}`);
  processedText = processedText.replace(/\brac(\d+)\s*×/g, String.raw`\frac{$1}{1} \times`);
  processedText = processedText.replace(/\brac(\d+)\s*=/g, String.raw`\frac{$1}{1} =`);
  
  // Fix "X = rac4 × (-2)2" → "X = \frac{4}{(-2)^2}"
  processedText = processedText.replace(/=\s*rac(\d+)\s*×\s*\(([^)]+)\)(\d+)/g, '= ' + String.raw`\frac{$1}{($2)^{$3}}`);
  
  // Fix superscript patterns: "(-2)2" → "(-2)^2" (only if not already in LaTeX)
  processedText = processedText.replace(/\(([^)]+)\)(\d+)(?![^$]*\$)/g, (match, base, exp) => {
    // Check if we're in a math context (after =, Δ, or in $...$)
    const before = processedText.substring(0, processedText.indexOf(match));
    const mathContext = before.includes('=') || before.includes('Δ') || before.includes('$') || 
                       before.match(/[a-zA-Z]\s*$/);
    if (mathContext && !match.includes('^')) {
      return `(${base})^{${exp}}`;
    }
    return match;
  });
  
  // Fix "4\t ×" → "4 \times" (remove tab before ×)
  processedText = processedText.replace(/(\d+)\s*\t\s*×/g, '$1 ' + String.raw`\times`);
  processedText = processedText.replace(/(\d+)\s*\t\s*\\times/g, '$1 ' + String.raw`\times`);
  
  // Fix "4\t × 1" → "4 \times 1"
  processedText = processedText.replace(/(\d+)\s*\t\s*×\s*(\d+)/g, '$1 ' + String.raw`\times` + ' $2');
  
  // Ensure proper spacing around × in math expressions
  processedText = processedText.replace(/(\d+)\s*×\s*(\d+)/g, '$1 ' + String.raw`\times` + ' $2');
  
  // Fix fraction patterns: "a / b" → "\frac{a}{b}" (in math context)
  // Pattern: number / (number × number) or similar
  // Use RegExp constructor to avoid issues with / in regex
  const fractionPattern = new RegExp('(-?\\d+)\\s*/\\s*\\((\\d+)\\s*×\\s*(\\d+)\\)', 'g');
  processedText = processedText.replace(fractionPattern, function(match, num1, num2, num3) {
    return LATEX_FRAC + '{' + num1 + '}{' + num2 + ' ' + LATEX_TIMES + ' ' + num3 + '}';
  });
  
  // Fix square root patterns: "√∆" → "\sqrt{\Delta}"
  processedText = processedText.replace(/√([Δ∆])/g, LATEX_SQRT + '{' + LATEX_DELTA + '}');
  processedText = processedText.replace(/√(\d+)/g, LATEX_SQRT + '{$1}');
  processedText = processedText.replace(/√\(([^)]+)\)/g, LATEX_SQRT + '{$1}');
  
  // Fix quadratic formula patterns: "x = (-3 ± √∆) / 2"
  const quadPattern1 = new RegExp('x\\s*=\\s*\\((-?\\d+)\\s*±\\s*√([Δ∆])\\)\\s*/\\s*(\\d+)', 'g');
  processedText = processedText.replace(quadPattern1, function(match, num1, delta, num3) {
    return 'x = ' + LATEX_FRAC + '{-' + num1 + ' ' + LATEX_PM + ' ' + LATEX_SQRT + '{' + LATEX_DELTA + '}}{' + num3 + '}';
  });
  const quadPattern2 = new RegExp('x\\s*=\\s*\\((-?\\d+)\\s*±\\s*√(\\d+)\\)\\s*/\\s*(\\d+)', 'g');
  processedText = processedText.replace(quadPattern2, function(match, num1, num2, num3) {
    return 'x = ' + LATEX_FRAC + '{-' + num1 + ' ' + LATEX_PM + ' ' + LATEX_SQRT + '{' + num2 + '}}{' + num3 + '}';
  });
  
  // Wrap common math patterns that might not be wrapped yet
  // Pattern: "∆ = number² - 4 × number × number = number"
  if (!processedText.includes('$') && /[Δ∆]\s*=/.test(processedText)) {
    processedText = processedText.replace(/([Δ∆]\s*=\s*[^=]+=\s*\d+)/g, '$$$1$$');
  }
  
  // Wrap expressions like "x = -12 / (2 × 3) = -2" in math mode
  processedText = processedText.replace(/(x\s*=\s*[^.]+\s*=\s*-?\d+\.?)/g, (match) => {
    if (!match.includes('$')) {
      return `$${match}$`;
    }
    return match;
  });
  
  // MathJax will automatically process math expressions in elements with class "math-content"
  // We just need to return the text - MathJax will find and render $...$ and $$...$$ automatically
  return <span className="math-content">{processedText}</span>;
}

function SubmissionResult({
  submission,
  assignmentModel = null,
  /** Chế độ chấm tay GV: đề (nếu có) trên full width; bài HS và bài mẫu hai cột cạnh nhau để so sánh. */
  manualGradingCompare = false,
  /** HS mở từ thông báo nhận xét GV: cuộn tới khối nhận xét sau khi render. */
  scrollToTeacherReviewOnMount = false,
  /** Gọi sau khi đã cuộn (để xóa query khỏi URL). */
  onTeacherReviewScrollConsumed = undefined,
}) {
  const { renderMath, loading: mathLoading, mathjaxLoaded } = useMathRenderer();
  const [showSolutions, setShowSolutions] = useState({}); // Track which solutions are shown
  const [imageLightbox, setImageLightbox] = useState(null); // { src, alt, title? }
  const containerRef = useRef(null);

  const hasTeacherReviewForScroll = !!(
    submission?.ai_result &&
    submission?.teacher_review?.comment
  );
  const teacherScrollRanKeyRef = useRef('');

  useEffect(() => {
    if (!scrollToTeacherReviewOnMount) teacherScrollRanKeyRef.current = '';
  }, [scrollToTeacherReviewOnMount]);

  // Re-render MathJax when content changes
  useEffect(() => {
    if (mathjaxLoaded && window.MathJax && window.MathJax.typesetPromise && containerRef.current) {
      // Use setTimeout to ensure DOM is fully updated
      const timeoutId = setTimeout(() => {
        if (containerRef.current && window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([containerRef.current]).catch((err) => {
            console.warn('MathJax typeset error:', err);
          });
        }
      }, 200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [submission, mathjaxLoaded, showSolutions, assignmentModel]);

  /** Cuộn tới nhận xét GV (mở từ chuông thông báo). Chờ layout + MathJax gần xong. */
  useEffect(() => {
    if (
      !scrollToTeacherReviewOnMount ||
      !hasTeacherReviewForScroll ||
      !submission?.id
    ) {
      return undefined;
    }
    const marker = `${submission.id}:review`;
    if (teacherScrollRanKeyRef.current === marker) {
      return undefined;
    }

    let cancelled = false;
    let mainTimer;
    let glowTimer;

    mainTimer = window.setTimeout(() => {
      if (cancelled) return;
      const el = document.getElementById('khkt-teacher-review');
      if (!el || cancelled) return;
      teacherScrollRanKeyRef.current = marker;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('teacher-review-section--incoming');
      glowTimer = window.setTimeout(() => {
        el.classList.remove('teacher-review-section--incoming');
      }, 2600);
      if (typeof onTeacherReviewScrollConsumed === 'function') {
        onTeacherReviewScrollConsumed();
      }
    }, 520);

    return () => {
      cancelled = true;
      window.clearTimeout(mainTimer);
      window.clearTimeout(glowTimer);
    };
  }, [
    scrollToTeacherReviewOnMount,
    hasTeacherReviewForScroll,
    submission?.id,
    onTeacherReviewScrollConsumed,
  ]);

  if (!submission || !submission.ai_result) {
    return (
      <div className="submission-result">
        <div className="no-result">
          <p>Chưa có kết quả chấm bài</p>
        </div>
      </div>
    );
  }

  const { ai_result, image_paths, created_at, teacher_review } = submission;
  const hasTeacherReview = !!(teacher_review && teacher_review.comment);
  const teacherScore =
    teacher_review && typeof teacher_review.score_override === 'number'
      ? teacher_review.score_override
      : null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScoreColor = (score) => {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#d97706';
    return '#dc2626';
  };

  const aiScoreRaw = Number(ai_result.score);
  const aiScoreNum = Number.isFinite(aiScoreRaw) ? aiScoreRaw : 0;
  // Khi GV đã chấm tay và nhập điểm override, ưu tiên hiện điểm đó cho HS;
  // ngược lại giữ nguyên điểm AI. Vẫn show điểm AI dạng phụ để minh bạch.
  const displayScore = teacherScore != null ? teacherScore : aiScoreNum;
  const scoreClamped = Math.max(0, Math.min(10, displayScore));
  const scoreAccent = getScoreColor(scoreClamped);
  const scorePct = (scoreClamped / 10) * 100;
  const scoreEyebrow = teacherScore != null ? 'Điểm giáo viên chấm' : 'Điểm chấm';

  const hasModelCompare =
    assignmentModel &&
    (assignmentModel.model_solution ||
      assignmentModel.model_solution_image_url ||
      (Array.isArray(assignmentModel.model_solution_image_urls) &&
        assignmentModel.model_solution_image_urls.length > 0) ||
      assignmentModel.question_image_url);

  const imgPathsLen = Array.isArray(image_paths) ? image_paths.length : 0;
  const qUrl = assignmentModel?.question_image_url;
  const msImgUrl = assignmentModel?.model_solution_image_url;
  const modelSolutionUrls =
    Array.isArray(assignmentModel?.model_solution_image_urls) &&
    assignmentModel.model_solution_image_urls.length > 0
      ? assignmentModel.model_solution_image_urls.filter(Boolean)
      : msImgUrl
        ? [msImgUrl]
        : [];
  const hasMsImages = modelSolutionUrls.length > 0;

  const showComparisonStrip =
    !!assignmentModel && !!((qUrl || hasMsImages || imgPathsLen > 0));

  /** Ảnh lớp học đã hiển thị trong dải so sánh → không hiện khối lặp cuối trang */
  const studentPhotosInGallery = !!assignmentModel && imgPathsLen > 0;

  /** Ảnh mẫu đã nằm trong strip → không lặp ảnh lớn phía dưới (tránh đè lên lưới đối chiếu khi chấm tay). */
  const showStandaloneModelAnswerImage =
    hasMsImages && !(showComparisonStrip || manualGradingCompare);

  const showModelAnswerCompareSection =
    hasModelCompare &&
    (!manualGradingCompare ||
      !!assignmentModel?.model_solution ||
      showStandaloneModelAnswerImage);

  return (
    <div
      className={`submission-result${manualGradingCompare ? ' submission-result--manual-grading' : ''}`}
      ref={containerRef}
    >
      <div className="score-section">
        <div className="score-card" style={{ '--score-accent': scoreAccent }}>
          <p className="score-eyebrow">{scoreEyebrow}</p>
          <div className="score-main" aria-label={`Điểm ${displayScore} trên 10`}>
            <span className="score-value">{displayScore}</span>
            <span className="score-den">/10</span>
          </div>
          <div className="score-bar-track" aria-hidden="true">
            <div
              className="score-bar-fill"
              style={{ width: `${scorePct}%`, background: scoreAccent }}
            />
          </div>
          <p className="score-caption">
            {teacherScore != null
              ? `Thang điểm 10 · AI gợi ý ${aiScoreNum}/10`
              : 'Thang điểm 10'}
          </p>
        </div>
      </div>

      {showComparisonStrip && (
        <div
          className={`result-section submission-compare-strip-section${
            manualGradingCompare ? ' submission-compare-strip-section--manual-grading' : ''
          }`}
        >
          <h3 className="submission-compare-strip-heading">Đối chiếu hình ảnh</h3>
          <p className="submission-zoom-hint submission-zoom-hint--strip">
            {manualGradingCompare ? (
              <>Bấm ảnh để phóng to, xoay, zoom.</>
            ) : (
              <>
                Bấm vào từng ảnh để phóng to, xoay và zoom (xuất hiện trên học sinh và
                giáo viên).
              </>
            )}
          </p>
          {manualGradingCompare ? (
            <>
              {qUrl ? (
                <div className="submission-compare-de-fullwidth">
                  <figure className="submission-compare-cell submission-compare-cell--question-wide">
                    <figcaption className="submission-compare-label">Đề bài</figcaption>
                    <button
                      type="button"
                      className="submission-result-image-zoom-trigger submission-compare-thumb"
                      onClick={() =>
                        setImageLightbox({
                          src: qUrl,
                          alt: 'Đề bài — xem và chỉnh hướng',
                          title: 'Đề bài',
                        })
                      }
                      aria-label="Xem đề bài — phóng to"
                    >
                      <img src={qUrl} alt="" className="submission-compare-thumb-img" />
                    </button>
                  </figure>
                </div>
              ) : null}
              {imgPathsLen > 0 || hasMsImages ? (
              <div
                className={`submission-compare-grid submission-compare-grid--hs-model-pair${
                  imgPathsLen > 0 && hasMsImages
                    ? ' submission-compare-grid--hs-model-pair--two-cols'
                    : ''
                }`}
              >
                {imgPathsLen > 0 ? (
                  <figure className="submission-compare-cell submission-compare-cell--student">
                    <figcaption className="submission-compare-label">
                      Bài làm của học sinh
                    </figcaption>
                    <div className="submission-compare-student-stack">
                      {image_paths.map((imgUrl, index) => (
                        <button
                          key={`cmp-stu-${index}`}
                          type="button"
                          className="submission-result-image-zoom-trigger submission-compare-thumb"
                          onClick={() =>
                            setImageLightbox({
                              src: imgUrl,
                              alt: `Bài làm ${index + 1}`,
                              title: `Bài làm — ảnh ${index + 1}`,
                            })
                          }
                          aria-label={`Xem ảnh bài làm ${index + 1} phóng to`}
                        >
                          <img src={imgUrl} alt="" className="submission-compare-thumb-img" />
                        </button>
                      ))}
                    </div>
                  </figure>
                ) : null}
                {hasMsImages ? (
                  <figure className="submission-compare-cell">
                    <figcaption className="submission-compare-label">Bài giải mẫu</figcaption>
                    <div className="submission-compare-student-stack">
                      {modelSolutionUrls.map((solUrl, idx) => (
                        <button
                          key={`cmp-ms-${idx}-${solUrl.slice(-12)}`}
                          type="button"
                          className="submission-result-image-zoom-trigger submission-compare-thumb"
                          onClick={() =>
                            setImageLightbox({
                              src: solUrl,
                              alt: `Bài giải mẫu ${idx + 1}`,
                              title: `Bài giải mẫu — ảnh ${idx + 1}`,
                            })
                          }
                          aria-label={`Xem ảnh bài giải mẫu ${idx + 1} phóng to`}
                        >
                          <img src={solUrl} alt="" className="submission-compare-thumb-img" />
                        </button>
                      ))}
                    </div>
                  </figure>
                ) : null}
              </div>
              ) : null}
            </>
          ) : (
            <div className="submission-compare-grid">
              {qUrl ? (
                <figure className="submission-compare-cell">
                  <figcaption className="submission-compare-label">Đề bài</figcaption>
                  <button
                    type="button"
                    className="submission-result-image-zoom-trigger submission-compare-thumb"
                    onClick={() =>
                      setImageLightbox({
                        src: qUrl,
                        alt: 'Đề bài — xem và chỉnh hướng',
                        title: 'Đề bài',
                      })
                    }
                    aria-label="Xem đề bài — phóng to"
                  >
                    <img src={qUrl} alt="" className="submission-compare-thumb-img" />
                  </button>
                </figure>
              ) : null}

              {imgPathsLen > 0 ? (
                <figure className="submission-compare-cell submission-compare-cell--student">
                  <figcaption className="submission-compare-label">Bài làm của học sinh</figcaption>
                  <div className="submission-compare-student-stack">
                    {image_paths.map((imgUrl, index) => (
                      <button
                        key={`cmp-stu-${index}`}
                        type="button"
                        className="submission-result-image-zoom-trigger submission-compare-thumb"
                        onClick={() =>
                          setImageLightbox({
                            src: imgUrl,
                            alt: `Bài làm ${index + 1}`,
                            title: `Bài làm — ảnh ${index + 1}`,
                          })
                        }
                        aria-label={`Xem ảnh bài làm ${index + 1} phóng to`}
                      >
                        <img src={imgUrl} alt="" className="submission-compare-thumb-img" />
                      </button>
                    ))}
                  </div>
                </figure>
              ) : null}

              {hasMsImages ? (
                <figure className="submission-compare-cell">
                  <figcaption className="submission-compare-label">Bài giải mẫu</figcaption>
                  <div className="submission-compare-student-stack">
                    {modelSolutionUrls.map((solUrl, idx) => (
                      <button
                        key={`cmp-ms-def-${idx}`}
                        type="button"
                        className="submission-result-image-zoom-trigger submission-compare-thumb"
                        onClick={() =>
                          setImageLightbox({
                            src: solUrl,
                            alt: `Bài giải mẫu ${idx + 1}`,
                            title: `Bài giải mẫu — ảnh ${idx + 1}`,
                          })
                        }
                        aria-label={`Xem ảnh bài giải mẫu ${idx + 1} phóng to`}
                      >
                        <img src={solUrl} alt="" className="submission-compare-thumb-img" />
                      </button>
                    ))}
                  </div>
                </figure>
              ) : null}
            </div>
          )}
        </div>
      )}

      {showModelAnswerCompareSection && (
        <div className="result-section model-solution-compare-section">
          <h3>Bài giải mẫu (đối chiếu)</h3>
          {showStandaloneModelAnswerImage && (
            <div className="model-solution-compare-image-wrap model-solution-compare-image-wrap--lead">
              <span className="model-solution-compare-label">Hình ảnh bài mẫu</span>
              <p className="submission-zoom-hint">Bấm vào ảnh để xem phóng to.</p>
              <div className="model-solution-standalone-images">
                {modelSolutionUrls.map((u, idx) => (
                  <button
                    key={`standalone-ms-${idx}`}
                    type="button"
                    className="submission-result-image-zoom-trigger"
                    onClick={() =>
                      setImageLightbox({
                        src: u,
                        alt: `Bài giải mẫu — xem phóng to (${idx + 1})`,
                        title: `Bài giải mẫu — ảnh ${idx + 1}`,
                      })
                    }
                    aria-label={`Xem ảnh bài giải mẫu ${idx + 1} phóng to`}
                  >
                    <img
                      src={u}
                      alt=""
                      className="model-solution-compare-image"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const wrap = e.target.closest('.submission-result-image-zoom-trigger');
                        if (wrap) wrap.style.display = 'none';
                      }}
                    />
                  </button>
                ))}
              </div>
              <div className="image-error model-solution-compare-image-error" style={{ display: 'none' }}>
                Không thể tải hình ảnh
              </div>
            </div>
          )}
          {hasMsImages && showStandaloneModelAnswerImage ? (
            <p className="model-solution-compare-hint">
              {!manualGradingCompare && !studentPhotosInGallery && image_paths && image_paths.length > 0
                ? 'So sánh với hình bài làm của bạn trong mục «Hình ảnh bài làm của bạn» phía dưới trang.'
                : !manualGradingCompare && showComparisonStrip
                  ? 'Các ảnh đề, bài làm và bài giải mẫu nằm trong ô «Đối chiếu hình ảnh» phía trên.'
                  : 'Tham khảo cách trình bày và hướng giải.'}
              {assignmentModel.model_solution ? ' Lời giải chữ (nếu có) nằm ngay dưới đây.' : ''}
            </p>
          ) : null}
          {assignmentModel.model_solution && (
            <div className="model-solution-compare-text math-content">
              <span className="model-solution-compare-label">Lời giải mẫu</span>
              {renderTextWithMath(assignmentModel.model_solution, renderMath)}
            </div>
          )}
        </div>
      )}

      {hasTeacherReview && (
        <div
          id="khkt-teacher-review"
          className="result-section teacher-review-section teacher-review-section--featured"
        >
          <div className="teacher-review-banner">
            <span className="teacher-review-chip" aria-hidden>
              Giáo viên
            </span>
            <h3 className="teacher-review-title">Nhận xét của giáo viên</h3>
            <p className="teacher-review-lede">
              Đây là phần nhận xét trực tiếp của giáo viên về bài làm của bạn.
            </p>
          </div>
          <div className="teacher-review-card">
            <div className="teacher-review-text math-content">
              {renderTextWithMath(teacher_review.comment, renderMath)}
            </div>
            <p className="teacher-review-meta">
              — {teacher_review.reviewer_full_name ||
                teacher_review.reviewer_username ||
                'Giáo viên'}
              {teacher_review.updated_at
                ? ` · ${new Date(teacher_review.updated_at).toLocaleDateString('vi-VN')}`
                : null}
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      {ai_result.summary && (
        <div className="result-section">
          <h3>Tóm tắt</h3>
          <div className="summary-text math-content">
            {renderTextWithMath(ai_result.summary, renderMath)}
          </div>
        </div>
      )}

      {/* Mistakes */}
      {ai_result.mistakes && ai_result.mistakes.length > 0 && (
        <div className="result-section">
          <h3>Lỗi đã mắc</h3>
          <ul className="mistakes-list">
            {ai_result.mistakes.map((mistake, index) => (
              <li key={index} className="mistake-item math-content">
                {renderTextWithMath(mistake, renderMath)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      {ai_result.nextSteps && ai_result.nextSteps.length > 0 && (
        <div className="result-section">
          <h3>Bước tiếp theo</h3>
          <ul className="next-steps-list">
            {ai_result.nextSteps.map((step, index) => (
              <li key={index} className="step-item math-content">
                {renderTextWithMath(step, renderMath)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Practice Sets — ẩn khi chấm tay GV (tiết kiệm thời gian) */}
      {!manualGradingCompare && ai_result.practiceSets && (
        <div className="practice-sets-section">
          {ai_result.practiceSets.similar &&
            ai_result.practiceSets.similar.length > 0 && (
              <PracticeSection
                variant="similar"
                icon="📐"
                title="Bài tập tương tự"
                subtitle={`Cùng dạng với bài em vừa làm · ${ai_result.practiceSets.similar.length} bài`}
                items={ai_result.practiceSets.similar}
                showSolutions={showSolutions}
                setShowSolutions={setShowSolutions}
                renderTextWithMath={renderTextWithMath}
                renderMath={renderMath}
                defaultOpen={false}
              />
            )}

          {ai_result.practiceSets.remedial &&
            ai_result.practiceSets.remedial.length > 0 && (
              <PracticeSection
                variant="remedial"
                icon="🎯"
                title="Bài tập bổ trợ"
                subtitle={`Luyện thêm những chỗ em chưa chắc · ${ai_result.practiceSets.remedial.length} bài`}
                items={ai_result.practiceSets.remedial}
                showSolutions={showSolutions}
                setShowSolutions={setShowSolutions}
                renderTextWithMath={renderTextWithMath}
                renderMath={renderMath}
                defaultOpen={false}
              />
            )}
        </div>
      )}

      {/* Student Images — chỉ khi chưa gom trong dải đối chiếu */}
      {image_paths && image_paths.length > 0 && !studentPhotosInGallery && (
        <div className="result-section">
          <h3>Hình ảnh bài làm của bạn</h3>
          <p className="submission-zoom-hint submission-zoom-hint--inline">
            Bấm vào từng ảnh để phóng to, xoay và thu phóng.
          </p>
          <div className="student-images">
            {image_paths.map((imageUrl, index) => (
              <div key={index} className="student-image-container">
                <button
                  type="button"
                  className="submission-result-image-zoom-trigger submission-result-image-zoom-trigger--student"
                  onClick={() =>
                    setImageLightbox({
                      src: imageUrl,
                      alt: `Bài làm ${index + 1} — xem và chỉnh hướng`,
                      title: `Bài làm — ảnh ${index + 1}`,
                    })
                  }
                  aria-label={`Xem ảnh bài làm ${index + 1} phóng to`}
                >
                  <img
                    src={imageUrl}
                    alt=""
                    className="student-image"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const wrap = e.target.closest('.submission-result-image-zoom-trigger');
                      if (wrap) wrap.style.display = 'none';
                      const errorDiv = e.target.closest('.student-image-container')?.querySelector('.image-error');
                      if (errorDiv) errorDiv.style.display = 'block';
                    }}
                  />
                </button>
                <div className="image-error" style={{ display: 'none' }}>
                  Không thể tải hình ảnh
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission Info */}
      <div className="submission-info">
        <small>Nộp bài lúc: {formatDate(created_at)}</small>
      </div>

      <ImageLightbox
        open={Boolean(imageLightbox)}
        onClose={() => setImageLightbox(null)}
        src={imageLightbox?.src}
        alt={imageLightbox?.alt ?? ''}
        title={imageLightbox?.title}
      />
    </div>
  );
}

export default SubmissionResult;
