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

/**
 * Render text with LaTeX math expressions using MathJax
 * Supports inline math: $...$ and display math: $$...$$
 * @param {string} text - Text with LaTeX math
 * @param {Function} renderMathFn - Function to render math (not used with MathJax, kept for compatibility)
 * @returns {JSX.Element} Rendered text with math
 */
function renderTextWithMath(text, renderMathFn) {
  if (!text) return null;
  
  // Auto-detect and convert math expressions if not already in LaTeX format
  let processedText = autoDetectMath(text);
  
  // Fix common LaTeX issues that might cause "Math input error"
  // Replace double backslashes with single backslash for LaTeX commands
  processedText = processedText.replace(/\\\\+([a-zA-Z]+)/g, (match, command) => {
    // Common LaTeX commands
    const latexCommands = ['Delta', 'pm', 'sqrt', 'frac', 'cdot', 'times', 'div', 
                          'alpha', 'beta', 'pi', 'theta', 'sin', 'cos', 'tan', 'log', 'ln',
                          'sum', 'prod', 'int', 'lim', 'infty', 'partial', 'text'];
    if (latexCommands.includes(command)) {
      return '\\' + command;
    }
    return match;
  });
  
  // Fix common text errors from AI that should be LaTeX
  // Replace "imes" with \times (multiplication) - handle both standalone and in expressions
  processedText = processedText.replace(/\bimes\b/g, '\\times');
  // Replace "riangle" with \Delta (delta/discriminant)
  processedText = processedText.replace(/\briangle\b/g, '\\Delta');
  // Replace Unicode multiplication × with \times
  processedText = processedText.replace(/×/g, '\\times');
  // Replace Unicode division ÷ with \div
  processedText = processedText.replace(/÷/g, '\\div');
  // Replace Unicode plus-minus ± with \pm
  processedText = processedText.replace(/±/g, '\\pm');
  // Replace Unicode delta Δ with \Delta
  processedText = processedText.replace(/Δ/g, '\\Delta');
  
  // Fix patterns like "4imes1imes3" → "4 \times 1 \times 3" (inside math expressions)
  // This handles cases where AI writes "imes" without spaces
  processedText = processedText.replace(/(\d+|[a-zA-Z])\s*imes\s*(\d+|[a-zA-Z])/g, '$1 \\times $2');
  
  // Fix "riangle = " pattern
  processedText = processedText.replace(/\briangle\s*=/g, '\\Delta =');
  
  // Fix "Tính riangle:" → "Tính $\\Delta$:"
  processedText = processedText.replace(/Tính\s+riangle:/g, 'Tính $\\Delta$:');
  
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
    if (score >= 8) return '#4caf50'; // Green
    if (score >= 6) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  return (
    <div className="submission-result" ref={containerRef}>
      {/* Score Display */}
      <div className="score-section">
        <div
          className="score-circle"
          style={{ borderColor: getScoreColor(ai_result.score || 0) }}
        >
          <span className="score-value">{ai_result.score || 0}</span>
          <span className="score-label">/ 10</span>
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
                      <div className="practice-number">Bài {index + 1}</div>
                      <div className="practice-content">
                        <div className="practice-problem">
                          <span className="problem-label">Đề bài:</span>
                          <div className="problem-text math-content">
                            {renderTextWithMath(item.problem, renderMath)}
                          </div>
                        </div>
                        {item.solution && (
                          <div className="practice-solution">
                            <span className="solution-label">Lời giải:</span>
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
                        <div className="practice-number">Bài {index + 1}</div>
                        <div className="practice-content">
                          <div className="practice-problem">
                            <span className="problem-label">Đề bài:</span>
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
                                  <span className="solution-label">Lời giải:</span>
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
