chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "checkHallucination",
      title: "Check AI Hallucination",
      contexts: ["selection"]
    }, () => {
      // Consume lastError to avoid Chrome logging unhandled errors
      if (chrome.runtime.lastError) {
        // Ignored
      }
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "checkHallucination" && info.selectionText) {
    const textToCheck = info.selectionText;
    
    // Send message to content script to show a loading overlay (optional, keeping it simple for now)
    
    // Call our backend
    fetch("http://localhost:8000/extension/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: textToCheck,
        prompt: "" // In a future version we could extract this from DOM or prompt user
      })
    })
    .then(response => response.json())
    .then(data => {
      // In a real extension, we would inject a nice UI into the page using scripting.
      // For MVP, we'll execute a script in the active tab to show an alert.
      const resultMessage = `
Fact-Check Result:
Verdict: ${data.score.verdict}
Confidence: ${data.score.confidence}
Explanation: ${data.score.explanation}
      `;
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (msg) => alert(msg),
        args: [resultMessage]
      });
    })
    .catch(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert("Backend server offline (localhost:8000).")
      });
    });
  }
});
