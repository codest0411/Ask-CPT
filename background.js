/**
 * background.js
 * Service worker to handle AI requests.
 * Allows bypassing page security (CSP).
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AI_ASSISTANT_FETCH') {
    console.log("[Background] Fetching AI Request:", request.payload.url);
    
    handleAIFetch(request.payload)
      .then(data => {
        console.log("[Background] Success!");
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error("[Background] Fetch Error:", error.message);
        sendResponse({ success: false, error: error.message });
      });
      
    return true; // Keep channel alive for async response
  }
});

async function handleAIFetch(payload) {
  const { url, headers, body } = payload;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    // Handle non-JSON or error responses gracefully
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response from AI API: ${text.slice(0, 100)}...`);
    }

    if (!response.ok) {
      // Return specific error message if available
      throw new Error(data.error?.message || `API HTTP Error ${response.status}`);
    }

    return data;
  } catch (err) {
    if (err.message.includes("Failed to fetch")) {
      throw new Error("Network connection error. Check your internet.");
    }
    throw err;
  }
}
