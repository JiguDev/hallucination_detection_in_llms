// Check if there is a pending migration
chrome.storage.local.get(['pendingMigration'], (result) => {
    if (result.pendingMigration) {
        const promptText = result.pendingMigration;
        // Clear it so it doesn't paste again on reload
        chrome.storage.local.remove('pendingMigration');
        
        // Function to find the textarea and paste
        function attemptPaste(retries = 0) {
            let textArea = null;
            
            // Try platform-specific selectors
            if (window.location.hostname.includes('chatgpt.com')) {
                textArea = document.getElementById('prompt-textarea');
            } else if (window.location.hostname.includes('claude.ai')) {
                textArea = document.querySelector('div[contenteditable="true"]');
            } else if (window.location.hostname.includes('gemini.google.com')) {
                textArea = document.querySelector('rich-textarea div[contenteditable="true"], rich-textarea .ql-editor');
            }
            
            // Fallback to generic textareas if specific ones fail
            if (!textArea) {
                textArea = document.querySelector('textarea, div[contenteditable="true"]');
            }
            
            if (textArea) {
                // Focus the element
                textArea.focus();
                
                // For contenteditable divs (Claude, Gemini)
                if (textArea.getAttribute('contenteditable') === 'true' || textArea.classList.contains('ql-editor')) {
                    // It's safer to use document.execCommand to insert text to preserve undo history and trigger React state
                    const success = document.execCommand('insertText', false, promptText);
                    if (!success) {
                        textArea.innerText = promptText;
                    }
                } else {
                    // For standard textareas
                    textArea.value = promptText;
                }
                
                // Dispatch input events so the underlying React/Angular framework registers the change
                textArea.dispatchEvent(new Event('input', { bubbles: true }));
                textArea.dispatchEvent(new Event('change', { bubbles: true }));
                
            } else if (retries < 30) {
                // UI might not have loaded yet, retry every 500ms up to 15 seconds
                setTimeout(() => attemptPaste(retries + 1), 500);
            }
        }
        
        // Start trying to paste after a short initial delay to let DOM settle
        setTimeout(attemptPaste, 1000);
    }
});
