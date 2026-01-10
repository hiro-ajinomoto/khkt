import { useState, useEffect } from 'react';
import './SubmissionResult.css';

// Math rendering hook
function useMathRenderer() {
  const [katexLib, setKatexLib] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadKatex() {
      try {
        const katexModule = await import('katex');
        await import('katex/dist/katex.min.css');
        if (mounted) {
          setKatexLib(katexModule.default || katexModule);
          setLoading(false);
        }
      } catch {
        console.warn('KaTeX not installed. Run: npm install katex');
        if (mounted) {
          setKatexLib(null);
          setLoading(false);
        }
      }
    }

    loadKatex();

    return () => {
      mounted = false;
    };
  }, []);

  const renderMath = (math, options = {}) => {
    if (!katexLib) {
      return `<span class="math-fallback">${math}</span>`;
    }

    try {
      return katexLib.renderToString(math, {
        throwOnError: false,
        displayMode: options.displayMode || false,
        strict: false,
        trust: true,
        ...options
      });
    } catch (error) {
      console.warn('KaTeX render error:', error, math);
      return `<span class="math-fallback">${math}</span>`;
    }
  };

  return { renderMath, loading };
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
 * Render text with LaTeX math expressions
 * Supports inline math: $...$ and display math: $$...$$
 * @param {string} text - Text with LaTeX math
 * @param {Function} renderMathFn - Function to render math
 * @returns {JSX.Element} Rendered text with math
 */
function renderTextWithMath(text, renderMathFn) {
  if (!text) return null;
  
  // Auto-detect and convert math expressions if not already in LaTeX format
  const processedText = autoDetectMath(text);

  // Split text by LaTeX math expressions
  const parts = [];
  let lastIndex = 0;
  
  // Match display math: $$...$$
  const displayMathRegex = /\$\$([^$]+)\$\$/g;
  let match;
  
  while ((match = displayMathRegex.exec(processedText)) !== null) {
    // Add text before math
    if (match.index > lastIndex) {
      const textBefore = processedText.substring(lastIndex, match.index);
      if (textBefore.trim()) {
        parts.push({ type: 'text', content: textBefore });
      }
    }
    
    // Add display math
    parts.push({ type: 'display', content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < processedText.length) {
    const remainingText = processedText.substring(lastIndex);
    if (remainingText.trim()) {
      // Process inline math in remaining text
      const inlineParts = processInlineMath(remainingText);
      parts.push(...inlineParts);
    }
  } else if (parts.length === 0) {
    // No display math found, process inline math
    const inlineParts = processInlineMath(processedText);
    return (
      <>
        {inlineParts.map((part, index) => {
          if (part.type === 'inline') {
            return (
              <span
                key={index}
                className="katex-inline"
                dangerouslySetInnerHTML={{
                  __html: renderMathFn(part.content, { displayMode: false }),
                }}
              />
            );
          } else {
            return <span key={index}>{part.content}</span>;
          }
        })}
      </>
    );
  }
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'display') {
          return (
            <div
              key={index}
              className="katex-display-wrapper"
              dangerouslySetInnerHTML={{
                __html: renderMathFn(part.content, { displayMode: true }),
              }}
            />
          );
        } else if (part.type === 'inline') {
          return (
            <span
              key={index}
              className="katex-inline"
              dangerouslySetInnerHTML={{
                __html: renderMathFn(part.content, { displayMode: false }),
              }}
            />
          );
        } else {
          return <span key={index}>{part.content}</span>;
        }
      })}
    </>
  );
}

/**
 * Process inline math expressions: $...$
 * @param {string} text - Text with inline math
 * @returns {Array} Array of parts (text or inline math)
 */
function processInlineMath(text) {
  const parts = [];
  let lastIndex = 0;
  const inlineMathRegex = /\$([^$]+)\$/g;
  let match;
  
  while ((match = inlineMathRegex.exec(text)) !== null) {
    // Add text before math
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index);
      if (textBefore.trim()) {
        parts.push({ type: 'text', content: textBefore });
      }
    }
    
    // Add inline math
    parts.push({ type: 'inline', content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText.trim()) {
      parts.push({ type: 'text', content: remainingText });
    }
  }
  
  // If no math found, return as text
  if (parts.length === 0) {
    return [{ type: 'text', content: text }];
  }
  
  return parts;
}

function SubmissionResult({ submission }) {
  const { renderMath } = useMathRenderer();
  const [showSolutions, setShowSolutions] = useState({}); // Track which solutions are shown

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
    <div className="submission-result">
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
          <div className="summary-text">
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
              <li key={index} className="mistake-item">
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
              <li key={index} className="step-item">
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
                          <div className="problem-text">
                            {renderTextWithMath(item.problem, renderMath)}
                          </div>
                        </div>
                        {item.solution && (
                          <div className="practice-solution">
                            <span className="solution-label">Lời giải:</span>
                            <div className="solution-text">
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
                            <div className="problem-text">
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
                                  <div className="solution-text">
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
