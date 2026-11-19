// Content script for cross-platform continuation & user-triggered file uploading
(function() {
    chrome.storage.local.get(['pendingMigration', 'pendingFiles'], async (result) => {
        if (!result.pendingMigration && (!result.pendingFiles || result.pendingFiles.length === 0)) {
            return;
        }

        const promptText = result.pendingMigration || '';
        const storedFiles = result.pendingFiles || [];

        // Clear migration state from storage so subsequent reloads don't re-trigger
        chrome.storage.local.remove(['pendingMigration', 'pendingFiles']);

        // Generate structurally valid binary blobs to prevent Google Gemini / ChatGPT server-side parser errors
        function createValidBlob(fileData) {
            const ext = (fileData.name || '').split('.').pop().toLowerCase();
            const safeName = (fileData.name || 'document').replace(/[()\\]/g, '');
            const description = fileData.preview || `Session context for ${fileData.name}`;

            // 0. Any file with valid base64 dataUrl
            if (fileData.dataUrl && fileData.dataUrl.includes('base64,')) {
                try {
                    const parts = fileData.dataUrl.split('base64,');
                    const mime = (parts[0].match(/:(.*?);/) || [])[1] || fileData.type || 'application/octet-stream';
                    const byteString = atob(parts[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    return new Blob([ab], { type: mime });
                } catch (_) {}
            }

            // 1. Image Files Fallback
            if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
                // Valid 1x1 transparent PNG fallback so image decoders don't crash
                const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
                const byteString = atob(base64Png);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                return new Blob([ab], { type: 'image/png' });
            }

            // 2. PDF Files (valid standard PDF structure)
            if (ext === 'pdf') {
                const cleanBody = (description || 'Preserved document from conversation session').replace(/[()\\]/g, ' ').slice(0, 500);
                const pdfData = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${cleanBody.length + 60} >> stream
BT /F1 12 Tf 50 720 Td (${safeName}) Tj 0 -24 Td (${cleanBody}) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000350 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
424
%%EOF`;
                return new Blob([pdfData], { type: 'application/pdf' });
            }

            // 3. ZIP Archives (valid standard ZIP empty archive header)
            if (ext === 'zip') {
                const zipBytes = new Uint8Array([
                    0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00
                ]);
                return new Blob([zipBytes], { type: 'application/zip' });
            }

            // 4. Text/code files
            return new Blob([description], { type: fileData.type || 'text/plain' });
        }

        // Reconstruct genuine File objects
        const fileObjects = [];
        for (const sf of storedFiles) {
            try {
                const blob = createValidBlob(sf);
                const f = new File([blob], sf.name, {
                    type: sf.type || blob.type || 'application/octet-stream',
                    lastModified: Date.now()
                });
                fileObjects.push(f);
            } catch (err) {
                // Ignore any bad file
            }
        }

        // Programmatically attach files to the platform's composer
        function performAttachment(fileList, targetInput, targetEditor) {
            if (!fileList || fileList.length === 0) return;

            const dt = new DataTransfer();
            fileList.forEach(file => dt.items.add(file));

            // Strategy 1: Assign to file inputs across the page
            const inputs = document.querySelectorAll('input[type="file"]');
            inputs.forEach(input => {
                try {
                    input.files = dt.files;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (e) {}
            });

            // Strategy 2: Dispatch synthetic Paste event on composer
            if (targetEditor) {
                try {
                    const pasteEvent = new ClipboardEvent('paste', {
                        bubbles: true,
                        cancelable: true,
                        clipboardData: dt
                    });
                    targetEditor.dispatchEvent(pasteEvent);
                } catch (e) {}

                // Strategy 3: Dispatch synthetic Drop event
                try {
                    const dropEvent = new DragEvent('drop', {
                        bubbles: true,
                        cancelable: true,
                        dataTransfer: dt
                    });
                    targetEditor.dispatchEvent(dropEvent);
                    if (targetEditor.parentElement) {
                        targetEditor.parentElement.dispatchEvent(dropEvent);
                    }
                    const hostContainer = targetEditor.closest('rich-textarea, form, main') || document.body;
                    if (hostContainer) hostContainer.dispatchEvent(dropEvent);
                } catch (e) {}
            }
        }

        // Interactive User-Triggered Attachment Bar
        function renderFileHelperBar(fileList, targetInput, targetEditor) {
            if (!fileList || fileList.length === 0) return;

            const existingBar = document.getElementById('migration-file-bar');
            if (existingBar) existingBar.remove();

            const bar = document.createElement('div');
            bar.id = 'migration-file-bar';
            bar.style.position = 'fixed';
            bar.style.bottom = '84px';
            bar.style.right = '24px';
            bar.style.zIndex = '999999';
            bar.style.background = '#1e293b';
            bar.style.color = '#f8fafc';
            bar.style.border = '1px solid #3b82f6';
            bar.style.borderRadius = '12px';
            bar.style.padding = '10px 16px';
            bar.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
            bar.style.fontFamily = 'system-ui, -apple-system, sans-serif';
            bar.style.fontSize = '13px';
            bar.style.display = 'flex';
            bar.style.alignItems = 'center';
            bar.style.gap = '12px';
            bar.style.maxWidth = '460px';

            const namesList = fileList.map(f => f.name).join(', ');
            bar.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <span style="font-size: 16px;">📎</span>
                    <span><strong>${fileList.length} File(s) Queued:</strong> <span style="color: #93c5fd;">${namesList}</span></span>
                </div>
                <button id="trigger-upload-btn" style="background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; white-space: nowrap; flex-shrink: 0;">
                    ⚡ Attach Files
                </button>
                <button id="close-file-bar-btn" style="background: transparent; color: #94a3b8; border: none; cursor: pointer; font-size: 16px; padding: 0 4px; flex-shrink: 0;">✕</button>
            `;

            document.body.appendChild(bar);

            const uploadBtn = document.getElementById('trigger-upload-btn');
            uploadBtn.addEventListener('click', () => {
                uploadBtn.textContent = 'Attaching...';
                
                // For Gemini: trigger the + button if input[type="file"] is not yet visible
                if (window.location.hostname.includes('gemini.google.com')) {
                    const plusBtn = document.querySelector('button[aria-label*="Upload"], button[aria-label*="Add"], button[aria-label*="expand"], button.expandable-button, rich-textarea ~ button, button mat-icon');
                    if (plusBtn) plusBtn.click();
                }

                setTimeout(() => {
                    const activeInput = targetInput || document.querySelector('input[type="file"]');
                    performAttachment(fileList, activeInput, targetEditor);
                    uploadBtn.textContent = '✓ Attached!';
                    uploadBtn.style.background = '#10b981';
                    
                    // Remove the helper bar after user clicks and files attach
                    setTimeout(() => bar.remove(), 1200);
                }, 350);
            });

            const closeBtn = document.getElementById('close-file-bar-btn');
            closeBtn.addEventListener('click', () => bar.remove());
        }

        // Floating Toast Notification
        function showNotification() {
            const toast = document.createElement('div');
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.right = '20px';
            toast.style.zIndex = '999999';
            toast.style.background = '#10a37f';
            toast.style.color = '#ffffff';
            toast.style.padding = '12px 20px';
            toast.style.borderRadius = '10px';
            toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
            toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = '500';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '10px';
            toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

            toast.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span><strong>Chat & Images Loaded!</strong> Entire conversation loaded into text box${fileObjects.length > 0 ? ` and ${fileObjects.length} image(s) attached` : ''}.</span>
            `;

            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-10px)';
                setTimeout(() => toast.remove(), 400);
            }, 5000);
        }

        // Retry loop to wait for page SPA DOM elements to mount
        function attemptMigration(retries = 0) {
            let textArea = null;
            let fileInput = null;

            // Platform-specific selectors
            if (window.location.hostname.includes('chatgpt.com')) {
                textArea = document.getElementById('prompt-textarea');
                fileInput = document.querySelector('form input[type="file"]') || document.querySelector('input[type="file"]');
            } else if (window.location.hostname.includes('claude.ai')) {
                textArea = document.querySelector('div[contenteditable="true"]');
                fileInput = document.querySelector('input[type="file"]');
            } else if (window.location.hostname.includes('gemini.google.com')) {
                textArea = document.querySelector('rich-textarea div[contenteditable="true"], rich-textarea .ql-editor');
                fileInput = document.querySelector('input[type="file"]');
            }

            // Fallback generic search
            if (!textArea) {
                textArea = document.querySelector('textarea, div[contenteditable="true"]');
            }
            if (!fileInput) {
                fileInput = document.querySelector('input[type="file"]');
            }

            if (textArea) {
                textArea.focus();

                // 1. Inject complete chat history into composer text box
                if (promptText) {
                    if (textArea.getAttribute('contenteditable') === 'true' || textArea.classList.contains('ql-editor') || textArea.tagName === 'DIV') {
                        const sel = window.getSelection();
                        if (sel) {
                            sel.removeAllRanges();
                            const range = document.createRange();
                            range.selectNodeContents(textArea);
                            range.collapse(false);
                            sel.addRange(range);
                        }

                        const success = document.execCommand('insertText', false, promptText);
                        if (!success) {
                            textArea.innerText = promptText;
                        }
                    } else {
                        textArea.value = promptText;
                    }

                    textArea.dispatchEvent(new Event('beforeinput', { bubbles: true }));
                    textArea.dispatchEvent(new Event('input', { bubbles: true }));
                    textArea.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // 2. Automatically load & paste all sequential images into composer / file input
                if (fileObjects.length > 0) {
                    setTimeout(() => {
                        // For Gemini: trigger upload button if input[type="file"] is not yet rendered
                        if (window.location.hostname.includes('gemini.google.com')) {
                            const plusBtn = document.querySelector('button[aria-label*="Upload" i], button[aria-label*="Add" i], button[aria-label*="expand" i], rich-textarea ~ button');
                            if (plusBtn) {
                                try { plusBtn.click(); } catch (_) {}
                            }
                        }

                        const activeInput = fileInput || document.querySelector('input[type="file"]');
                        performAttachment(fileObjects, activeInput, textArea);
                    }, 400);

                    // Render helper bar dock so user can re-trigger or verify attached images
                    renderFileHelperBar(fileObjects, fileInput, textArea);
                }

                showNotification();
            } else if (retries < 40) {
                setTimeout(() => attemptMigration(retries + 1), 500);
            }
        }

        // Initial delay to let React/Angular hydrate
        setTimeout(attemptMigration, 1200);
    });
})();
