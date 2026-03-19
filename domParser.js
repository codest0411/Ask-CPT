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
                                 document.querySelector('#result-state') ||
                                 document.querySelector('.test-case-result');
    if (testResultContainer) {
      // Try to find specific diffs (Input/Output/Expected)
      const diffInfo = Array.from(testResultContainer.querySelectorAll('div'))
        .filter(el => /Input|Output|Expected|Expected Answer/i.test(el.innerText))
        .map(el => el.innerText.trim())
        .join("\n");
      
      rawErrorStr = diffInfo || testResultContainer.innerText.trim();
    }
    
    // 2. Second choice: Known generic error classes across platforms
    if (!rawErrorStr) {
      const selectors = [
        '.css-1q9f5f0', // LeetCode error text
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
      const els = Array.from(document.querySelectorAll('span, div')).filter(el => el.offsetHeight > 0);
      for (const el of els) {
        const text = el.innerText?.trim();
        if (text && keywords.some(k => text.includes(k))) {
          let container = el;
          for (let i = 0; i < 4; i++) {
            if (container.parentElement && container.parentElement.innerText.length < 2000) {
              container = container.parentElement;
            }
          }
          rawErrorStr = container.innerText.trim();
          break; 
        }
      }
    }
    
    // Cap at 2000 characters to make sure we don't truncate important error traces
    return rawErrorStr ? rawErrorStr.slice(0, 2000) : null;
  },

  isRateLimited() {
    const rateLimitKeywords = ['submitting too frequently', 'try again later', 'Subscribe to Premium'];
    const nodes = document.querySelectorAll('span, div, .text-red-5, .text-red-s');
    for (const node of nodes) {
      const text = node.innerText?.trim();
      if (text && rateLimitKeywords.some(kw => text.includes(kw)) && node.offsetHeight > 0) {
        return true;
      }
    }
    return false;
  },

  scrapeProblemLinks() {
    // 1. Broadest possible scraping from rows and links
    const allUniqueLinks = new Set();
    
    // Check for row-based links first (Problem List)
    const rows = Array.from(document.querySelectorAll('div[role="row"], tr, .group'));
    for (const row of rows) {
      // Skip if it contains a checkmask/success icon (Solved)
      const isSolved = row.querySelector('svg[class*="text-green"], .text-green-s, .text-lc-green, path[d*="M20 6L9 17l-5-5"]');
      if (isSolved) continue;

      const link = row.querySelector('a[href*="/problems/"]');
      if (link && !link.href.includes('/submissions/')) {
        const href = link.href.split('?')[0].split('#')[0];
        if (href.split('/').length === 5) allUniqueLinks.add(href);
      }
    }

    // Check for 'Similar Questions' on a problem page
    const similarLinks = Array.from(document.querySelectorAll('a[href*="/problems/"]'))
      .filter(a => {
        // Find links in sidebars or bottom sections that are likely "Similar Questions"
        const parentText = a.parentElement?.innerText?.toLowerCase() || "";
        return parentText.includes("similar") || a.closest('[class*="question-list"]');
      });

    for (const link of similarLinks) {
       const href = link.href.split('?')[0].split('#')[0];
       if (href.split('/').length === 5) allUniqueLinks.add(href);
    }

    // Absolute fallback: Just find ANY problem links that look fresh
    if (allUniqueLinks.size === 0) {
      document.querySelectorAll('a[href*="/problems/"]').forEach(a => {
        const href = a.href.split('?')[0].split('#')[0];
        const parts = href.split('/');
        if (parts.length === 5 && !href.includes('/submissions/')) allUniqueLinks.add(href);
      });
    }

    return [...allUniqueLinks];
  },

  isTestPassed() {
    // STRATEGY: If result panel is visible AND has NO error keywords → tests passed
    const errorKeywords = ['Wrong Answer', 'Runtime Error', 'Compile Error', 'Time Limit Exceeded', 'Memory Limit Exceeded', 'SyntaxError', 'TypeError', 'Error'];
    
    // First check: is there any visible green "Accepted" text?
    const allVisible = document.querySelectorAll('span, div, h4');
    for (const node of allVisible) {
      const text = node.innerText?.trim();
      if (!text || node.offsetHeight === 0) continue;
      if (text === 'Accepted') return true;
    }
    
    // Second check: look for the result container and check if it has errors
    const resultArea = document.querySelector('[data-e2e-locator="console-result"]');
    if (resultArea) {
      const resultText = resultArea.innerText || '';
      const hasError = errorKeywords.some(kw => resultText.includes(kw));
      if (!hasError && resultText.length > 5) return true; // Has content but no errors = pass
    }

    return false;
  },

  isSubmissionAccepted() {
    // Look for "Accepted" anywhere visible on the page after Submit
    const allVisible = document.querySelectorAll('span, div, h4');
    for (const node of allVisible) {
      const text = node.innerText?.trim();
      if (!text || node.offsetHeight === 0) continue;
      if (text === 'Accepted') return true;
    }
    
    // Fallback: check for green success indicators
    const greenNodes = document.querySelectorAll('.text-green-s, .text-lc-green, [class*="success"]');
    for (const node of greenNodes) {
      const text = node.innerText?.trim();
      if (text && text.includes('Accepted') && node.offsetHeight > 0) return true;
    }

    return false;
  },

  isSubmissionFinished() {
    const terminalKeywords = ['Accepted', 'Wrong Answer', 'Runtime Error', 'Time Limit Exceeded', 'Memory Limit Exceeded', 'Compile Error'];
    const allVisible = document.querySelectorAll('span, div, h4');
    for (const node of allVisible) {
      const text = node.innerText?.trim();
      if (!text || node.offsetHeight === 0) continue;
      if (terminalKeywords.some(kw => text === kw || text.startsWith(kw))) return true;
    }
    return false;
  }
};

// Export to window for access by content.js
window.domParser = domParser;
