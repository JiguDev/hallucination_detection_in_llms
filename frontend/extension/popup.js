document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const promptEl = document.getElementById('prompt');
    const aiResponseEl = document.getElementById('ai-response');
    const resultContainer = document.getElementById('result-container');
    const verdictTitle = document.getElementById('verdict-title');
    const confidenceBadge = document.getElementById('confidence-badge');
    const explanationText = document.getElementById('explanation-text');
    const sourcesContainer = document.getElementById('sources-container');
    const sourcesList = document.getElementById('sources-list');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');

    // Ledger & Files UI Elements
    const chatLedgerEl = document.getElementById('chat-ledger');
    const clearLedgerBtn = document.getElementById('clear-ledger-btn');
    const syncChatBtn = document.getElementById('sync-chat-btn');
    const summarizeChatBtn = document.getElementById('summarize-chat-btn');
    const filesPreviewContainer = document.getElementById('files-preview-container');
    const fileChipsList = document.getElementById('file-chips-list');

    // Dedicated Summary Card Elements
    const chatSummaryContainer = document.getElementById('chat-summary-container');
    const summaryContentEl = document.getElementById('summary-content');
    const copySummaryBtn = document.getElementById('copy-summary-btn');
    const closeSummaryBtn = document.getElementById('close-summary-btn');

    const migrateChatgptBtn = document.getElementById('migrate-chatgpt-btn');
    const migrateClaudeBtn = document.getElementById('migrate-claude-btn');
    const migrateGeminiBtn = document.getElementById('migrate-gemini-btn');
    const copyLedgerBtn = document.getElementById('copy-ledger-btn');
    const downloadLedgerBtn = document.getElementById('download-ledger-btn');
    const downloadMenu = document.getElementById('download-menu');
    const dlMdBtn = document.getElementById('dl-md-btn');
    const dlPdfBtn = document.getElementById('dl-pdf-btn');

    let currentSourcePlatform = 'unknown';
    let currentAttachedFiles = [];

    // Helper to toggle Clear (X) icon visibility based on content presence
    function updateClearBtnVisibility() {
        if (!clearLedgerBtn) return;
        const hasContent = (chatLedgerEl.value && chatLedgerEl.value.trim().length > 0) || (currentAttachedFiles && currentAttachedFiles.length > 0);
        if (hasContent) {
            clearLedgerBtn.classList.remove('hidden');
        } else {
            clearLedgerBtn.classList.add('hidden');
        }
    }

    // Helper to render file chips in the UI above the textarea
    function renderFileChips(files) {
        if (!files || files.length === 0) {
            filesPreviewContainer.classList.add('hidden');
            fileChipsList.innerHTML = '';
            updateClearBtnVisibility();
            return;
        }

        filesPreviewContainer.classList.remove('hidden');
        fileChipsList.innerHTML = '';

        files.forEach((file, index) => {
            const chip = document.createElement('div');
            chip.className = 'file-chip';
            chip.title = `${file.name} (${file.type || 'file'})`;
            
            const isImg = (file.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
            const iconSvg = isImg
                ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
                : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;

            chip.innerHTML = `
                ${iconSvg}
                <span>${index + 1}. ${file.name}</span>
            `;
            fileChipsList.appendChild(chip);
        });
        updateClearBtnVisibility();
    }

    // Dynamic Platform Detection
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                const url = tabs[0].url || '';
                if (url.includes('chatgpt.com')) {
                    currentSourcePlatform = 'chatgpt';
                    migrateClaudeBtn.classList.remove('hidden');
                    migrateGeminiBtn.classList.remove('hidden');
                } else if (url.includes('claude.ai')) {
                    currentSourcePlatform = 'claude';
                    migrateChatgptBtn.classList.remove('hidden');
                    migrateGeminiBtn.classList.remove('hidden');
                } else if (url.includes('gemini.google.com')) {
                    currentSourcePlatform = 'gemini';
                    migrateChatgptBtn.classList.remove('hidden');
                    migrateClaudeBtn.classList.remove('hidden');
                } else {
                    migrateChatgptBtn.classList.remove('hidden');
                    migrateClaudeBtn.classList.remove('hidden');
                    migrateGeminiBtn.classList.remove('hidden');
                }
            }
        });
    }

    // Load existing state from storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['chatLedger', 'attachedFiles', 'sourcePlatform'], (result) => {
            if (result.chatLedger) {
                chatLedgerEl.value = result.chatLedger;
            }
            if (result.attachedFiles && Array.isArray(result.attachedFiles) && result.attachedFiles.length > 0) {
                currentAttachedFiles = result.attachedFiles;
                renderFileChips(currentAttachedFiles);
            }
            if (result.sourcePlatform) {
                currentSourcePlatform = result.sourcePlatform;
            }
            updateClearBtnVisibility();
        });
    }

    // Initial check for clear button visibility
    updateClearBtnVisibility();

    // Save ledger edits on change & update clear icon
    chatLedgerEl.addEventListener('input', () => {
        updateClearBtnVisibility();
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ chatLedger: chatLedgerEl.value });
        }
    });

    // Clear (X) Button to clear textbox, files queue, and stored session
    if (clearLedgerBtn) {
        clearLedgerBtn.addEventListener('click', () => {
            chatLedgerEl.value = '';
            currentAttachedFiles = [];
            renderFileChips([]);
            chatSummaryContainer.classList.add('hidden');
            updateClearBtnVisibility();
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.remove(['chatLedger', 'attachedFiles']);
            }
        });
    }

    // Fact-checking analysis
    analyzeBtn.addEventListener('click', async () => {
        const text = aiResponseEl.value.trim();
        const prompt = promptEl.value.trim();

        if (!text) {
            alert('Please paste an AI response to analyze.');
            return;
        }

        btnText.textContent = 'Analyzing...';
        loader.classList.remove('hidden');
        analyzeBtn.disabled = true;
        resultContainer.classList.add('hidden');
        resultContainer.classList.remove('fade-in');

        try {
            const response = await fetch("http://localhost:8000/extension/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text, prompt: prompt })
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();
            displayResult(data.score);
        } catch (error) {
            alert("FastAPI backend is offline (localhost:8000). Please start the backend server to run fact-checking.");
        } finally {
            btnText.textContent = 'Analyze';
            loader.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    });

    function displayResult(score) {
        verdictTitle.textContent = score.verdict;
        const confPct = Math.round(score.confidence * 100);
        confidenceBadge.textContent = `${confPct}%`;
        
        resultContainer.className = 'result-card fade-in';
        if (score.verdict.includes('High') || score.verdict.includes('Safe')) {
            resultContainer.classList.add('status-success');
        } else if (score.verdict.includes('Needs')) {
            resultContainer.classList.add('status-warning');
        } else {
            resultContainer.classList.add('status-error');
        }

        explanationText.textContent = score.explanation;

        if (score.supporting_sources && score.supporting_sources.length > 0) {
            sourcesList.innerHTML = '';
            score.supporting_sources.forEach(src => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = src;
                a.target = '_blank';
                a.textContent = new URL(src).hostname.replace('www.', '');
                li.appendChild(a);
                sourcesList.appendChild(li);
            });
            sourcesContainer.classList.remove('hidden');
        } else {
            sourcesContainer.classList.add('hidden');
        }
    }

    // Core Chat & Image Extraction Engine (Executed in page context via scripting)
    async function extractChatFromPage(tab) {
        let results = null;
        try {
            results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    try {
                        // 1. Identify scrollable containers in the active chat page
                        function findScrollableElements() {
                            const found = [];
                            try {
                                const elements = document.querySelectorAll('main, main div, div[class*="overflow"], div[class*="react-scroll"], [data-testid="conversation-panel"]');
                                elements.forEach(el => {
                                    if (el && el.scrollHeight > el.clientHeight + 40) {
                                        found.push(el);
                                    }
                                });
                            } catch (_) {}
                            return found;
                        }

                        // Scroll upward to load historical turns from the beginning
                        let prevTurnCount = 0;
                        let stableCycles = 0;
                        const maxScrollSteps = 12;

                        for (let s = 0; s < maxScrollSteps; s++) {
                            window.scrollTo(0, 0);
                            if (document.documentElement) document.documentElement.scrollTop = 0;
                            if (document.body) document.body.scrollTop = 0;

                            const scrollContainers = findScrollableElements();
                            scrollContainers.forEach(el => {
                                try {
                                    el.scrollTop = 0;
                                    el.dispatchEvent(new Event('scroll', { bubbles: true }));
                                } catch (_) {}
                            });

                            // Click "Load earlier messages" / "Show more" buttons if present
                            try {
                                const buttons = document.querySelectorAll('button');
                                for (const btn of buttons) {
                                    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                                    const text = (btn.innerText || '').toLowerCase();
                                    if (aria.includes('load earlier') || text.includes('load earlier') || text.includes('load more messages')) {
                                        btn.click();
                                        break;
                                    }
                                }
                            } catch (_) {}

                            // Allow network request time to fetch and render previous turns
                            await new Promise(r => setTimeout(r, 700));

                            const currentCount = document.querySelectorAll('article, [data-message-author-role], [data-testid^="conversation-turn-"], .font-user-message, user-query').length;
                            if (currentCount > prevTurnCount) {
                                prevTurnCount = currentCount;
                                stableCycles = 0;
                            } else {
                                stableCycles++;
                                if (stableCycles >= 3 && s >= 2) {
                                    break;
                                }
                            }
                        }

                        // 2. Discover all conversation turn containers in document order
                        let turnNodes = [];
                        const hostname = window.location.hostname;

                        if (hostname.includes('chatgpt.com')) {
                            // Collect conversation turns: testIdTurns covers both user and assistant
                            const testIdTurns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
                            const roleTurns = Array.from(document.querySelectorAll('[data-message-author-role]'));

                            if (testIdTurns.length > 0 && testIdTurns.length >= roleTurns.length) {
                                turnNodes = testIdTurns;
                            } else if (roleTurns.length > 0) {
                                turnNodes = roleTurns;
                            } else {
                                const userElements = Array.from(document.querySelectorAll('.font-user-message, [data-testid="user-message"], div[class*="user"]'));
                                const articles = Array.from(document.querySelectorAll('article'));
                                const merged = Array.from(new Set([...userElements, ...articles]));
                                merged.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
                                turnNodes = merged;
                            }
                        } else if (hostname.includes('claude.ai')) {
                            turnNodes = Array.from(document.querySelectorAll('.font-user-message, .font-claude-message, [data-testid="user-message"]'));
                        } else if (hostname.includes('gemini.google.com')) {
                            turnNodes = Array.from(document.querySelectorAll('user-query, model-response'));
                        } else {
                            turnNodes = Array.from(document.querySelectorAll('article, [data-message-author-role], [data-testid^="conversation-turn-"], .chat-message'));
                        }

                        const sequentialFiles = [];
                        const extractedTurns = [];
                        let userImgCount = 0;
                        let aiImgCount = 0;

                        const FILE_PATTERN = /\b([a-zA-Z0-9_\-\.]+\.(zip|pdf|docx?|xlsx?|csv|json|txt|py|js|ts|tsx|jsx|html|css|tar|gz|rar|7z|xml|yaml|yml))\b/gi;
                        const typeMap = {
                            pdf: 'application/pdf',
                            zip: 'application/zip',
                            tar: 'application/x-tar',
                            gz: 'application/gzip',
                            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            csv: 'text/csv',
                            txt: 'text/plain',
                            json: 'application/json',
                            py: 'text/x-python',
                            js: 'text/javascript',
                            ts: 'text/typescript',
                            html: 'text/html',
                            css: 'text/css'
                        };

                        let turnIndex = 1;
                        for (let i = 0; i < turnNodes.length; i++) {
                            const node = turnNodes[i];

                            // Role identification
                            const roleAttr = node.getAttribute('data-message-author-role') ||
                                             (node.querySelector('[data-message-author-role="user"]') ? 'user' :
                                             (node.querySelector('[data-message-author-role="assistant"]') ? 'assistant' : ''));

                            let isUser = false;
                            if (roleAttr === 'user') {
                                isUser = true;
                            } else if (roleAttr === 'assistant') {
                                isUser = false;
                            } else {
                                if (node.classList.contains('font-user-message') ||
                                    node.tagName.toLowerCase() === 'user-query' ||
                                    node.querySelector('[data-testid="user-message"]') !== null ||
                                    node.querySelector('[class*="user-profile" i], [class*="user-avatar" i]') !== null) {
                                    isUser = true;
                                } else if (node.classList.contains('font-claude-message') ||
                                           node.tagName.toLowerCase() === 'model-response' ||
                                           node.querySelector('.markdown') !== null) {
                                    isUser = false;
                                } else {
                                    isUser = (i % 2 === 0);
                                }
                            }

                            const role = isUser ? 'User' : 'Ai';

                            // Text extraction preserving code blocks, lists, headers, tables
                            let text = '';
                            const textContainer = isUser
                                ? (node.querySelector('[data-message-author-role="user"]') || node.querySelector('div.whitespace-pre-wrap') || node.querySelector('.whitespace-normal') || node)
                                : (node.querySelector('.markdown') || node.querySelector('[data-message-author-role="assistant"]') || node);

                            if (textContainer) {
                                const srElements = textContainer.querySelectorAll('.sr-only, [aria-hidden="true"].sr-only');
                                const savedStyles = [];
                                srElements.forEach(s => {
                                    savedStyles.push({ el: s, display: s.style.display });
                                    s.style.display = 'none';
                                });

                                text = (textContainer.innerText || textContainer.textContent || '').trim();

                                savedStyles.forEach(s => {
                                    s.el.style.display = s.display;
                                });
                            }

                            if (!text) {
                                text = (node.innerText || node.textContent || '').trim();
                            }

                            // Extract Images inside this turn (sequential User_img1, Ai_img1, etc.)
                            const turnImageNames = [];
                            const imgs = Array.from(node.querySelectorAll('img'));
                            if (imgs.length === 0 && node.parentElement) {
                                const parentImgs = node.parentElement.querySelectorAll('img');
                                parentImgs.forEach(pi => {
                                    if (!imgs.includes(pi)) imgs.push(pi);
                                });
                            }

                            // Also detect CSS background-image previews
                            node.querySelectorAll('[style*="background-image"]').forEach(bgEl => {
                                const bg = bgEl.style.backgroundImage || '';
                                const match = bg.match(/url\(["']?(https?:\/\/[^"']+|blob:[^"']+|data:image\/[^"']+)["']?\)/i);
                                if (match && !imgs.some(im => (im.src === match[1] || im.currentSrc === match[1]))) {
                                    imgs.push({
                                        src: match[1],
                                        currentSrc: match[1],
                                        naturalWidth: bgEl.clientWidth || 300,
                                        naturalHeight: bgEl.clientHeight || 300,
                                        getAttribute: () => 'background-image',
                                        closest: () => null
                                    });
                                }
                            });

                            for (const img of imgs) {
                                const w = img.naturalWidth || img.clientWidth || img.width || 0;
                                const h = img.naturalHeight || img.clientHeight || img.height || 0;
                                const src = img.currentSrc || img.src || '';
                                const alt = (img.getAttribute('alt') || '').toLowerCase().trim();

                                // Filter avatars safely: only match tiny icons or explicit profile/avatar markers
                                const isAvatar = (
                                    src.startsWith('data:image/svg') ||
                                    (img.closest && img.closest('[class*="avatar" i], [data-testid*="avatar" i]')) ||
                                    alt === 'user' || alt === 'chatgpt' || alt === 'avatar' || alt.includes('profile picture') ||
                                    (w > 0 && w <= 36 && h > 0 && h <= 36)
                                );

                                if (isAvatar || !src) continue;

                                let imgName = '';
                                if (isUser) {
                                    userImgCount++;
                                    imgName = `User_img${userImgCount}.png`;
                                } else {
                                    aiImgCount++;
                                    imgName = `Ai_img${aiImgCount}.png`;
                                }

                                turnImageNames.push(imgName);

                                let dataUrl = null;
                                if (src.startsWith('data:image')) {
                                    dataUrl = src;
                                } else {
                                    try {
                                        const canvas = document.createElement('canvas');
                                        canvas.width = w || 400;
                                        canvas.height = h || 400;
                                        const ctx = canvas.getContext('2d');
                                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                        dataUrl = canvas.toDataURL('image/png');
                                    } catch (_) {}

                                    if (!dataUrl) {
                                        try {
                                            const resp = await fetch(src);
                                            const blob = await resp.blob();
                                            dataUrl = await new Promise(resolve => {
                                                const reader = new FileReader();
                                                reader.onloadend = () => resolve(reader.result);
                                                reader.onerror = () => resolve(null);
                                                reader.readAsDataURL(blob);
                                            });
                                        } catch (_) {}
                                    }
                                }

                                sequentialFiles.push({
                                    name: imgName,
                                    type: 'image/png',
                                    dataUrl: dataUrl,
                                    preview: `${role} image (${imgName})`,
                                    turn_index: turnIndex,
                                    role: role.toLowerCase(),
                                    originalSrc: src
                                });
                            }

                            // Extract File Attachments in User turns (ZIP, PDF, DOCX, etc.)
                            const turnFileNames = [];
                            const fileBadges = node.querySelectorAll('[data-testid*="file"], [data-testid*="attachment"], [class*="attachment"], [class*="file-"], a[download], a[href*="/files/"], [class*="FileThumbnail"]');
                            fileBadges.forEach(b => {
                                const badgeText = (b.innerText || b.getAttribute('title') || b.getAttribute('aria-label') || '').trim();
                                const matches = badgeText.match(FILE_PATTERN);
                                if (matches) {
                                    matches.forEach(m => {
                                        const clean = m.trim();
                                        if (!turnFileNames.includes(clean)) turnFileNames.push(clean);
                                    });
                                }
                            });

                            // Scan message text for files referenced or uploaded
                            if (turnFileNames.length === 0 && isUser) {
                                const allMatches = node.innerText.match(FILE_PATTERN);
                                if (allMatches) {
                                    allMatches.forEach(m => {
                                        const clean = m.trim();
                                        if (!turnFileNames.includes(clean) && clean.length > 4) {
                                            turnFileNames.push(clean);
                                        }
                                    });
                                }
                            }

                            for (const fn of turnFileNames) {
                                if (!sequentialFiles.some(f => f.name.toLowerCase() === fn.toLowerCase())) {
                                    const ext = fn.split('.').pop().toLowerCase();
                                    sequentialFiles.push({
                                        name: fn,
                                        type: typeMap[ext] || 'application/octet-stream',
                                        dataUrl: null,
                                        preview: `Attachment: ${fn}`,
                                        turn_index: turnIndex,
                                        role: role.toLowerCase()
                                    });
                                }
                            }

                            // For AI responses, check for searched web citations
                            if (!isUser) {
                                const searchLinks = [];
                                node.querySelectorAll('a[href]').forEach(a => {
                                    const href = a.getAttribute('href') || '';
                                    if (href.startsWith('http') && !href.includes('chatgpt.com') && !href.includes('openai.com')) {
                                        const title = a.innerText.trim() || a.getAttribute('title') || href;
                                        if (!searchLinks.some(s => s.url === href)) {
                                            searchLinks.push({ title, url: href });
                                        }
                                    }
                                });
                                if (searchLinks.length > 0 && !text.includes('http')) {
                                    text += `\nSearched Sources: ${searchLinks.map(s => `[${s.title}](${s.url})`).join(', ')}`;
                                }
                            }

                            // Build turn string according to exact format:
                            // User: ${Message}
                            // Ai: ${Reply}
                            // User: ${image name} + ${message}
                            // Ai: ${Reply}
                            // User: ${asks further more details}
                            // Ai: ${further more justifications and researches with searched links} + ${generated/fetched image name}
                            const userAttachments = [...turnImageNames, ...turnFileNames];
                            let turnLine = '';

                            if (isUser) {
                                if (userAttachments.length > 0 && text) {
                                    turnLine = `User: ${userAttachments.join(', ')} + ${text}`;
                                } else if (userAttachments.length > 0) {
                                    turnLine = `User: ${userAttachments.join(', ')}`;
                                } else if (text) {
                                    turnLine = `User: ${text}`;
                                }
                            } else {
                                if (turnImageNames.length > 0 && text) {
                                    turnLine = `Ai: ${text} + ${turnImageNames.join(', ')}`;
                                } else if (turnImageNames.length > 0) {
                                    turnLine = `Ai: ${turnImageNames.join(', ')}`;
                                } else if (text) {
                                    turnLine = `Ai: ${text}`;
                                }
                            }

                            if (turnLine.trim()) {
                                extractedTurns.push(turnLine.trim());
                                turnIndex++;
                            }
                        }

                        // Global fallback check for file attachments anywhere on the page
                        const globalFileElements = document.querySelectorAll('[data-testid*="attachment"], [data-testid*="file"], [class*="attachment"], [class*="FileThumbnail"]');
                        globalFileElements.forEach(gfe => {
                            const txt = (gfe.innerText || gfe.getAttribute('title') || '').trim();
                            const gMatches = txt.match(FILE_PATTERN);
                            if (gMatches) {
                                gMatches.forEach(gm => {
                                    const cleanName = gm.trim();
                                    if (!sequentialFiles.some(f => f.name.toLowerCase() === cleanName.toLowerCase())) {
                                        const ext = cleanName.split('.').pop().toLowerCase();
                                        sequentialFiles.push({
                                            name: cleanName,
                                            type: typeMap[ext] || 'application/octet-stream',
                                            dataUrl: null,
                                            preview: `Session Attachment: ${cleanName}`,
                                            turn_index: 1,
                                            role: 'user'
                                        });
                                    }
                                });
                            }
                        });

                        // Universal Fallback if no structured turns were caught
                        if (extractedTurns.length === 0) {
                            const pEls = Array.from(document.querySelectorAll('main p, main pre, article p, article pre, .markdown'));
                            if (pEls.length > 0) {
                                const allText = pEls.map(p => p.innerText.trim()).filter(t => t.length > 5).join('\n\n');
                                if (allText) {
                                    extractedTurns.push(`Ai: ${allText}`);
                                }
                            }
                        }

                        return {
                            ledger: extractedTurns.join('\n\n'),
                            files: sequentialFiles,
                            debug: {
                                turnNodesCount: turnNodes.length,
                                extractedTurnsCount: extractedTurns.length,
                                sequentialFilesCount: sequentialFiles.length,
                                hostname: hostname
                            }
                        };
                    } catch (innerErr) {
                        return {
                            error: innerErr.toString(),
                            stack: innerErr.stack,
                            debug: { errorAt: innerErr.message }
                        };
                    }
                }
            });
        } catch (scriptErr) {
            alert("Script injection error: " + scriptErr.message);
            return false;
        }

        if (!results || !results[0]) {
            alert("No response received from the webpage script. Please refresh the ChatGPT tab and try again.");
            return false;
        }

        const res = results[0].result;
        if (!res) {
            alert("Empty result returned from page script. Debug info: " + JSON.stringify(results[0]));
            return false;
        }

        if (res.error) {
            alert("Page extraction error: " + res.error + "\n" + (res.stack || ''));
            return false;
        }

        const { ledger, files, debug } = res;
        if (!ledger || !ledger.trim()) {
            alert("No conversation extracted. Debug stats: " + JSON.stringify(debug || {}));
            return false;
        }

        // Fetch image dataUrls for images that couldn't be exported by canvas
        if (files && Array.isArray(files)) {
            for (const f of files) {
                if (!f.dataUrl && f.originalSrc && (f.type || '').startsWith('image') && f.originalSrc.startsWith('http')) {
                    try {
                        const resp = await fetch(f.originalSrc);
                        const blob = await resp.blob();
                        const dataUrl = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = () => resolve(null);
                            reader.readAsDataURL(blob);
                        });
                        if (dataUrl) f.dataUrl = dataUrl;
                    } catch (_) {}
                }
            }
        }

        chatLedgerEl.value = ledger;
        currentAttachedFiles = files || [];
        renderFileChips(currentAttachedFiles);
        updateClearBtnVisibility();

        let detected = 'unknown';
        const url = tab.url || '';
        if (url.includes('chatgpt.com')) detected = 'chatgpt';
        else if (url.includes('claude.ai')) detected = 'claude';
        else if (url.includes('gemini.google.com')) detected = 'gemini';
        currentSourcePlatform = detected;

        await chrome.storage.local.set({
            chatLedger: ledger,
            attachedFiles: currentAttachedFiles,
            sourcePlatform: detected
        });

        return true;
    }

    // "Sync Chat & Files" Button Handler
    syncChatBtn.addEventListener('click', async () => {
        if (typeof chrome === 'undefined' || !chrome.tabs) {
            alert("Chrome Extension API not available.");
            return;
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            alert("No active tab detected.");
            return;
        }

        syncChatBtn.textContent = 'Scrolling & Syncing...';
        syncChatBtn.disabled = true;

        try {
            const success = await extractChatFromPage(tab);
            if (success) {
                const turnCount = (chatLedgerEl.value.match(/(?:^|\n\n)(?:User|Ai):/gi) || []).length;
                syncChatBtn.textContent = `✓ Synced! (${turnCount} turns, ${currentAttachedFiles.length} files)`;
                syncChatBtn.style.background = '#10b981';
                setTimeout(() => {
                    syncChatBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Sync Chat & Files
                    `;
                    syncChatBtn.style.background = '';
                    syncChatBtn.disabled = false;
                }, 2500);
            } else {
                syncChatBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Sync Chat & Files
                `;
                syncChatBtn.disabled = false;
            }
        } catch (e) {
            alert("Could not read page content. Permission or script error: " + e.message);
            syncChatBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Sync Chat & Files
            `;
            syncChatBtn.disabled = false;
        }
    });

    // Executive Chat Summarizer
    function generateExecutiveSummary(rawLedger, files, platform) {
        let filesSummary = "No files or attachments recorded in this session.";
        if (files && files.length > 0) {
            filesSummary = files.map((f, i) => `${i + 1}. **${f.name}** (${f.type || 'file'}) [Turn ${f.turn_index || 1}]`).join('\n');
        }

        const turnBlocks = rawLedger.split(/\n\n(?=(?:User|Ai|AI):)/i);
        const userQueries = [];
        const aiPoints = [];

        turnBlocks.forEach(tb => {
            const trimmed = tb.trim();
            if (/^User/i.test(trimmed)) {
                const q = trimmed.replace(/^User(\s*\[[^\]]+\])?:\s*/i, '');
                if (q) userQueries.push(q.slice(0, 160));
            } else if (/^(?:Ai|AI)/i.test(trimmed)) {
                const a = trimmed.replace(/^(?:Ai|AI):\s*/i, '');
                if (a) aiPoints.push(a.slice(0, 160));
            }
        });

        const topics = userQueries.slice(0, 6).map(q => `• ${q}`).join('\n') || '• Full session context active';
        const keyOutcomes = aiPoints.slice(-4).map(p => `• ${p}`).join('\n') || '• Completed contextual responses';

        return (
            `📌 **SESSION SUMMARY (${(platform || 'General').toUpperCase()})**\n\n` +
            `**Key Questions & Objectives:**\n${topics}\n\n` +
            `📎 **Sequential Images & Files (${files ? files.length : 0}):**\n${filesSummary}\n\n` +
            `💡 **Key Technical Takeaways & Outcomes:**\n${keyOutcomes}\n\n` +
            `🚀 **Current State / Next Action:**\n` +
            `The conversation is ongoing and intact. All ${turnBlocks.length} turns and ${files ? files.length : 0} sequential files/images are loaded in memory for immediate migration or export.`
        );
    }

    // "Summarize Chat" button handler
    summarizeChatBtn.addEventListener('click', async () => {
        let text = chatLedgerEl.value.trim();

        // If ledger is empty, sync from the active tab directly
        if (!text) {
            summarizeChatBtn.textContent = 'Syncing page...';
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await extractChatFromPage(tab);
                text = chatLedgerEl.value.trim();
            }
        }

        if (!text && currentAttachedFiles.length === 0) {
            alert("No chat conversation or files found. Please open an active chat on ChatGPT, Claude, or Gemini.");
            summarizeChatBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                Summarize Chat
            `;
            summarizeChatBtn.disabled = false;
            return;
        }

        summarizeChatBtn.textContent = 'Summarizing...';
        summarizeChatBtn.disabled = true;

        try {
            const execSummary = generateExecutiveSummary(text, currentAttachedFiles, currentSourcePlatform);
            summaryContentEl.innerText = execSummary;
            chatSummaryContainer.classList.remove('hidden');
            chatSummaryContainer.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            alert("Summarization error: " + (err.message || "An issue occurred while summarizing."));
        } finally {
            summarizeChatBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                Summarize Chat
            `;
            summarizeChatBtn.disabled = false;
        }
    });

    // Copy Summary Button
    copySummaryBtn.addEventListener('click', async () => {
        const text = summaryContentEl.innerText.trim();
        if (text) {
            await navigator.clipboard.writeText(text);
            const origSvg = copySummaryBtn.innerHTML;
            copySummaryBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            setTimeout(() => { copySummaryBtn.innerHTML = origSvg; }, 2000);
        }
    });

    // Close Summary Button
    closeSummaryBtn.addEventListener('click', () => {
        chatSummaryContainer.classList.add('hidden');
    });

    // Cross-Platform Migration with Full Loaded Context & Sequential Images
    async function migrateTo(platform) {
        const ledgerText = chatLedgerEl.value.trim();
        if (!ledgerText && currentAttachedFiles.length === 0) {
            alert("No chat history or images to migrate. Please click 'Sync Chat & Files' first.");
            return;
        }

        const originalBtnText = platform === 'claude' ? 'Migrate to Claude' : platform === 'chatgpt' ? 'Migrate to ChatGPT' : 'Migrate to Gemini';
        const activeBtn = platform === 'claude' ? migrateClaudeBtn : platform === 'chatgpt' ? migrateChatgptBtn : migrateGeminiBtn;
        
        activeBtn.textContent = 'Preparing...';
        activeBtn.disabled = true;

        try {
            const fullPrompt = "Please continue the following conversation context:\n\n" + ledgerText;

            // Copy to clipboard as reliable fallback
            try {
                await navigator.clipboard.writeText(fullPrompt);
            } catch (_) {}

            // Store in chrome.storage so content.js can automatically inject it
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({
                    pendingMigration: fullPrompt,
                    pendingFiles: currentAttachedFiles
                });
            }

            const targetUrl = platform === 'claude' 
                ? 'https://claude.ai/new' 
                : platform === 'chatgpt' 
                ? 'https://chatgpt.com/' 
                : 'https://gemini.google.com/app';

            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.create({ url: targetUrl });
            } else {
                window.open(targetUrl, '_blank');
            }
        } catch (error) {
            alert("Error initiating migration: " + error.message);
        } finally {
            activeBtn.textContent = originalBtnText;
            activeBtn.disabled = false;
        }
    }

    migrateChatgptBtn.addEventListener('click', () => migrateTo('chatgpt'));
    migrateClaudeBtn.addEventListener('click', () => migrateTo('claude'));
    migrateGeminiBtn.addEventListener('click', () => migrateTo('gemini'));

    // Copy Ledger functionality
    copyLedgerBtn.addEventListener('click', async () => {
        const ledgerText = chatLedgerEl.value.trim();
        if (ledgerText) {
            await navigator.clipboard.writeText(ledgerText);
            const icon = copyLedgerBtn.innerHTML;
            copyLedgerBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            setTimeout(() => { copyLedgerBtn.innerHTML = icon; }, 2000);
        }
    });

    // Download Ledger Menu
    downloadLedgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!downloadMenu.contains(e.target) && e.target !== downloadLedgerBtn) {
            downloadMenu.classList.add('hidden');
        }
    });

    dlMdBtn.addEventListener('click', () => {
        downloadMenu.classList.add('hidden');
        const ledgerText = chatLedgerEl.value.trim();
        if (!ledgerText) return;

        let formattedText = ledgerText;
        if (currentSourcePlatform === 'chatgpt') {
            formattedText = ledgerText.replace(/^User: /gm, '**👤 You**\n').replace(/^Ai: /gm, '---\n**🤖 ChatGPT**\n');
        } else if (currentSourcePlatform === 'claude') {
            formattedText = ledgerText.replace(/^User: /gm, '**👤 User**\n').replace(/^Ai: /gm, '---\n**🤖 Claude**\n');
        } else if (currentSourcePlatform === 'gemini') {
            formattedText = ledgerText.replace(/^User: /gm, '**👤 You**\n').replace(/^Ai: /gm, '---\n**✨ Gemini**\n');
        } else {
            formattedText = ledgerText.replace(/^User: /gm, '**👤 User**\n').replace(/^Ai: /gm, '---\n**🤖 AI**\n');
        }

        const blob = new Blob([formattedText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `chat-history-${currentSourcePlatform}-${timestamp}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    dlPdfBtn.addEventListener('click', () => {
        downloadMenu.classList.add('hidden');
        const ledgerText = chatLedgerEl.value.trim();
        if (!ledgerText) return;

        chrome.storage.local.set({
            printData: {
                text: ledgerText,
                platform: currentSourcePlatform
            }
        }, () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('print.html') });
        });
    });
});
