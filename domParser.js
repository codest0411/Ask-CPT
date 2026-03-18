/**
 * domParser.js
 * Extracts coding problem data from the current page DOM.
 */

const domParser = {
  /**
   * Main function to extract problem details.
   * @returns {Object} Structured problem data.
   */
  extractProblemData() {
    const title = this.getTitle();
    const description = this.getDescription();
    const examples = this.getExamples();
    const constraints = this.getConstraints();
    const signature = this.getFunctionSignature();

    return {
      title,
      description,
      examples,
      constraints,
      signature
    };
  },

  getTitle() {
    // LeetCode specific: text-title-large, text-label-1
    const selectors = [
      'h1', 
      '[data-cy="question-title"]', 
      '.text-title-large', 
      '.challenge-title',
      'h2.title',
      '.title-name',
      '.problems_header_content__title'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.trim()) return el.innerText.trim();
    }
    return document.title;
  },

  getDescription() {
    // Universal Problem Statement selectors
    const selectors = [
      '[data-track-load="description_content"]',
      '.elfjS',
      '.question-content',
      '.problem-description',
      '#problem-description',
      '.problem-statement',
      '.challenge-body-html',
      '[class*="problem_content"]',
      'article'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.innerText.trim();
    }

    // Aggressive Assessment Fallback
    const exampleHeaders = Array.from(document.querySelectorAll('strong, b, div, p, span')).filter(el => 
        el.innerText && el.innerText.trim().toLowerCase().startsWith('example 1')
    );

    if (exampleHeaders.length > 0) {
       let container = exampleHeaders[0];
       for(let i=0; i<6; i++) {
           if (container.parentElement && container.parentElement.innerText.length < 5000) {
               container = container.parentElement;
           }
       }
       return container.innerText.trim();
    }

    // Absolute fallback: Just extract the visible page text so it never errors
    return document.body.innerText.slice(0, 3000);
  },

  getExamples() {
    const examples = [];
    const exampleHeaders = Array.from(document.querySelectorAll('strong, b')).filter(el => 
      el.innerText.toLowerCase().includes('example')
    );
    
    exampleHeaders.forEach(header => {
      let content = "";
      let next = header.nextElementSibling;
      while (next && !next.innerText.toLowerCase().includes('example')) {
        content += next.innerText + "\n";
        next = next.nextElementSibling;
      }
      if (content) examples.push(content.trim());
    });

    return examples;
  },

  getConstraints() {
    const constraintsEl = Array.from(document.querySelectorAll('ul, li')).find(el => 
      el.previousElementSibling?.innerText.toLowerCase().includes('constraints') ||
      el.parentElement?.innerText.toLowerCase().includes('constraints')
    );
    return constraintsEl ? constraintsEl.innerText.trim() : "";
  },

  getFunctionSignature() {
    return "";
  },

  extractErrorText() {
    let rawErrorStr = "";

    // 1. First choice: LeetCode's exact test console locator
    const testResultContainer = document.querySelector('[data-e2e-locator="console-result"]') || 
                                document.querySelector('#result-state');
    if (testResultContainer) {
      rawErrorStr = testResultContainer.innerText.trim();
    }
    
    // 2. Second choice: Known generic error classes across platforms
    if (!rawErrorStr) {
      const selectors = [
        '.text-red-5', '.text-red-6', '.text-red-s',
        '[data-cy="run-code-result-output"]',
        '.console-message-error', '.error-message',
        '.testcase-error-content', '.error-text',
        '.compiler-message', '.test-example-line'
      ];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.trim()) {
           rawErrorStr = el.innerText.trim();
           break;
        }
      }
    }
    
    // 3. Final Fallback: Search the screen for Failure words and grab their container
    if (!rawErrorStr) {
      const keywords = ['Wrong Answer', 'Runtime Error', 'Compile Error', 'SyntaxError', 'Time Limit Exceeded'];
      const els = document.querySelectorAll('span, div');
      for (const el of els) {
        const text = el.innerText?.trim();
        if (text && keywords.includes(text) && el.offsetHeight > 0) {
          let container = el;
          for (let i = 0; i < 4; i++) {
            if (container.parentElement && container.parentElement.innerText.length < 2000) {
              container = container.parentElement;
            }
          }
          rawErrorStr = container.innerText.trim();
          break; // Found it
        }
      }
    }
    
    // Cap at 2000 characters to make sure we don't truncate important error traces
    return rawErrorStr ? rawErrorStr.slice(0, 2000) : null;
  }
};

// Export to window for access by content.js
window.domParser = domParser;
