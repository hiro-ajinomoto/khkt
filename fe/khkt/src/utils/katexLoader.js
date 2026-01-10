/**
 * KaTeX loader utility
 * Handles loading KaTeX with fallback if package is not installed
 */

let katex = null;
let katexAvailable = false;

export async function loadKaTeX() {
  if (katex !== null) {
    return { katex, available: katexAvailable };
  }

  try {
    const katexModule = await import('katex');
    await import('katex/dist/katex.min.css');
    katex = katexModule.default || katexModule;
    katexAvailable = true;
    return { katex, available: true };
  } catch (error) {
    console.warn('KaTeX package not found. Please install it: npm install katex');
    console.warn('LaTeX rendering will be disabled. Math expressions will be shown as plain text.');
    katexAvailable = false;
    katex = {
      renderToString: (math, options) => {
        return `<span class="math-fallback">${math}</span>`;
      }
    };
    return { katex, available: false };
  }
}

export function renderMath(math, options = {}) {
  if (!katex || !katexAvailable) {
    return `<span class="math-fallback">${math}</span>`;
  }

  try {
    return katex.renderToString(math, {
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
}
