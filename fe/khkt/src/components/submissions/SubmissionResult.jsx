import { useState, useEffect, useRef } from 'react';
import './SubmissionResult.css';

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
  let processedText = stripVietnameseProseFromMath(text);

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

function SubmissionResult({ submission }) {
  const { renderMath, loading: mathLoading, mathjaxLoaded } = useMathRenderer();
  const [showSolutions, setShowSolutions] = useState({}); // Track which solutions are shown
  const containerRef = useRef(null);

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
  }, [submission, mathjaxLoaded, showSolutions]);

  if (!submission || !submission.ai_result) {
    return (
      <div className="submission-result">
        <div className="no-result">
          <p>Chưa có kết quả chấm bài</p>
        </div>
      </div>
    );
  }

  const { ai_result, image_paths, created_at } = submission;

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

  const rawScore = Number(ai_result.score);
  const displayScore = Number.isFinite(rawScore) ? rawScore : 0;
  const scoreClamped = Math.max(0, Math.min(10, displayScore));
  const scoreAccent = getScoreColor(scoreClamped);
  const scorePct = (scoreClamped / 10) * 100;

  return (
    <div className="submission-result" ref={containerRef}>
      <div className="score-section">
        <div className="score-card" style={{ '--score-accent': scoreAccent }}>
          <p className="score-eyebrow">Điểm chấm</p>
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
          <p className="score-caption">Thang điểm 10</p>
        </div>
      </div>

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

      {/* Practice Sets */}
      {ai_result.practiceSets && (
        <div className="practice-sets-section">
          {ai_result.practiceSets.similar &&
            ai_result.practiceSets.similar.length > 0 && (
              <div className="practice-set">
                <h3>Bài tập tương tự</h3>
                <div className="practice-list">
                  {ai_result.practiceSets.similar.map((item, index) => (
                    <div key={index} className="practice-item">
                      <div className="practice-number" aria-hidden="true">
                        <span className="practice-number-top">Bài</span>
                        <span className="practice-number-n">{index + 1}</span>
                      </div>
                      <div className="practice-content">
                        <div className="practice-problem">
                          <span className="problem-label">ĐỀ BÀI:</span>
                          <div className="problem-text math-content">
                            {renderTextWithMath(item.problem, renderMath)}
                          </div>
                        </div>
                        {item.solution && (
                          <div className="practice-solution">
                            <span className="solution-label">LỜI GIẢI:</span>
                            <div className="solution-text math-content">
                              {renderTextWithMath(item.solution, renderMath)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {ai_result.practiceSets.remedial &&
            ai_result.practiceSets.remedial.length > 0 && (
              <div className="practice-set">
                <h3>Bài tập bổ trợ</h3>
                <div className="practice-list">
                  {ai_result.practiceSets.remedial.map((item, index) => {
                    const solutionKey = `remedial-${index}`;
                    const isSolutionVisible = showSolutions[solutionKey];
                    
                    return (
                      <div key={index} className="practice-item">
                        <div className="practice-number" aria-hidden="true">
                          <span className="practice-number-top">Bài</span>
                          <span className="practice-number-n">{index + 1}</span>
                        </div>
                        <div className="practice-content">
                          <div className="practice-problem">
                            <span className="problem-label">ĐỀ BÀI:</span>
                            <div className="problem-text math-content">
                              {renderTextWithMath(item.problem, renderMath)}
                            </div>
                          </div>
                          {item.solution && (
                            <>
                              {!isSolutionVisible && (
                                <button
                                  onClick={() =>
                                    setShowSolutions((prev) => ({
                                      ...prev,
                                      [solutionKey]: true,
                                    }))
                                  }
                                  className="show-solution-button"
                                >
                                  👁️ Xem bài giải
                                </button>
                              )}
                              {isSolutionVisible && (
                                <div className="practice-solution">
                                  <span className="solution-label">LỜI GIẢI:</span>
                                  <div className="solution-text math-content">
                                    {renderTextWithMath(item.solution, renderMath)}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Student Images */}
      {image_paths && image_paths.length > 0 && (
        <div className="result-section">
          <h3>Hình ảnh bài làm của bạn</h3>
          <div className="student-images">
            {image_paths.map((imageUrl, index) => (
              <div key={index} className="student-image-container">
                <img
                  src={imageUrl}
                  alt={`Bài làm ${index + 1}`}
                  className="student-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const errorDiv = e.target.nextSibling;
                    if (errorDiv) {
                      errorDiv.style.display = 'block';
                    }
                  }}
                />
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
    </div>
  );
}

export default SubmissionResult;
