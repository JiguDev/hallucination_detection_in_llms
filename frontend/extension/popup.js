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
    let currentActiveUrl = '';
    let currentSyncedUrl = '';
    let currentChatKey = 'chat_session_default';

    // Helper: Safely query the active webpage tab in the browser window
    async function getActiveWebTab() {
        if (typeof chrome === 'undefined' || !chrome.tabs) return null;
        try {
            // Priority 1: Current window active tab (exact window user is interacting with)
            const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (currentTabs && currentTabs.length > 0 && currentTabs[0].url && !currentTabs[0].url.startsWith('chrome-extension://')) {
                return currentTabs[0];
            }
        } catch (_) {}
        try {
            // Priority 2: Last focused window active tab
            const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (focusedTabs && focusedTabs.length > 0 && focusedTabs[0].url && !focusedTabs[0].url.startsWith('chrome-extension://')) {
                return focusedTabs[0];
            }
        } catch (_) {}
        try {
            // Priority 3: Any active web tab
            const allActive = await chrome.tabs.query({ active: true });
            const webTab = allActive.find(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));
            if (webTab) return webTab;
            return allActive[0] || null;
        } catch (_) {}
        return null;
    }

    // Helper: Normalize URL to a unique chat conversation key
    function getChatStorageKey(rawUrl) {
        if (!rawUrl) return 'chat_session_default';
        try {
            const u = new URL(rawUrl);
            const cleanPath = u.pathname.replace(/\/+$/, '') || '/';
            return `chat_cache_${u.hostname.replace(/[^a-zA-Z0-9_-]/g, '_')}${cleanPath.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        } catch (_) {
            return `chat_cache_${rawUrl.split('?')[0].split('#')[0].replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        }
    }

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

    // Controls enabled/disabled state of Summarize Chat and Migrate buttons
    function updateActionButtonsState() {
        const isSynced = Boolean(
            chatLedgerEl.value && 
            chatLedgerEl.value.trim().length > 0 && 
            currentSyncedUrl && 
            currentSyncedUrl === currentActiveUrl
        );

        if (summarizeChatBtn) {
            summarizeChatBtn.disabled = !isSynced;
            summarizeChatBtn.title = isSynced 
                ? "Generate executive summary for active chat" 
                : "Click 'Sync Chat & Files' first to enable summarization";
        }

        const migrateBtns = [migrateClaudeBtn, migrateGeminiBtn, migrateChatgptBtn];
        migrateBtns.forEach(btn => {
            if (btn) {
                btn.disabled = !isSynced;
                btn.title = isSynced 
                    ? "Migrate active chat context to target platform" 
                    : "Click 'Sync Chat & Files' first to enable migration";
            }
        });

        updateClearBtnVisibility();
    }

    // Helper to render file chips in the UI above the textarea
    function renderFileChips(files) {
        if (!files || files.length === 0) {
            filesPreviewContainer.classList.add('hidden');
            fileChipsList.innerHTML = '';
            updateActionButtonsState();
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
        updateActionButtonsState();
    }

    // Initialize Conversation Context Scoped to Active Tab URL
    async function initActiveConversation() {
        const tab = await getActiveWebTab();
        if (!tab || !tab.url) {
            updateActionButtonsState();
            return;
        }

        const rawUrl = tab.url;
        currentActiveUrl = rawUrl.split('?')[0].split('#')[0];
        currentChatKey = getChatStorageKey(currentActiveUrl);

        if (rawUrl.includes('chatgpt.com')) {
            currentSourcePlatform = 'chatgpt';
            migrateClaudeBtn.classList.remove('hidden');
            migrateGeminiBtn.classList.remove('hidden');
            migrateChatgptBtn.classList.add('hidden');
        } else if (rawUrl.includes('claude.ai')) {
            currentSourcePlatform = 'claude';
            migrateChatgptBtn.classList.remove('hidden');
            migrateGeminiBtn.classList.remove('hidden');
            migrateClaudeBtn.classList.add('hidden');
        } else if (rawUrl.includes('gemini.google.com')) {
            currentSourcePlatform = 'gemini';
            migrateChatgptBtn.classList.remove('hidden');
            migrateClaudeBtn.classList.remove('hidden');
            migrateGeminiBtn.classList.add('hidden');
        } else {
            migrateChatgptBtn.classList.remove('hidden');
            migrateClaudeBtn.classList.remove('hidden');
            migrateGeminiBtn.classList.remove('hidden');
        }

        if (typeof chrome !== 'undefined' && chrome.storage) {
            // Remove legacy unscoped keys so they cannot pollute chat state
            chrome.storage.local.remove(['chatLedger', 'attachedFiles', 'lastSyncedUrl']);

            // Load strictly this conversation's scoped cache
            chrome.storage.local.get([currentChatKey], (result) => {
                const data = result[currentChatKey];
                if (data && data.url === currentActiveUrl && (data.ledger || (data.files && data.files.length > 0))) {
                    currentSyncedUrl = data.url;
                    chatLedgerEl.value = data.ledger || '';
                    currentAttachedFiles = data.files || [];
                    renderFileChips(currentAttachedFiles);
                    if (data.summary) {
                        summaryContentEl.innerText = data.summary;
                        chatSummaryContainer.classList.remove('hidden');
                    } else {
                        chatSummaryContainer.classList.add('hidden');
                    }
                } else {
                    // Chat has not been synced yet: keep clean and disable action buttons!
                    currentSyncedUrl = '';
                    chatLedgerEl.value = '';
                    currentAttachedFiles = [];
                    renderFileChips([]);
                    chatSummaryContainer.classList.add('hidden');
                }
                updateActionButtonsState();
            });
        }
    }

    initActiveConversation();

    // Save manual ledger edits scoped to currentChatKey
    chatLedgerEl.addEventListener('input', () => {
        updateActionButtonsState();
        if (typeof chrome !== 'undefined' && chrome.storage && currentChatKey) {
            chrome.storage.local.get([currentChatKey], (result) => {
                const existing = result[currentChatKey] || {};
                existing.url = currentActiveUrl;
                existing.ledger = chatLedgerEl.value;
                existing.files = currentAttachedFiles;
                existing.platform = currentSourcePlatform;
                const update = {};
                update[currentChatKey] = existing;
                chrome.storage.local.set(update);
            });
        }
    });

    // Clear (X) Button to clear textbox, files queue, summary, and scoped cache for this chat
    if (clearLedgerBtn) {
        clearLedgerBtn.addEventListener('click', () => {
            chatLedgerEl.value = '';
            currentAttachedFiles = [];
            currentSyncedUrl = '';
            renderFileChips([]);
            chatSummaryContainer.classList.add('hidden');
            updateActionButtonsState();
            if (typeof chrome !== 'undefined' && chrome.storage && currentChatKey) {
                chrome.storage.local.remove([currentChatKey, 'chatLedger', 'attachedFiles', 'lastSyncedUrl']);
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

    // Core Chat & Image Extraction Engine (Executed strictly in current active thread context)
    async function extractChatFromPage(tab) {
        if (!tab || !tab.id) return false;
        let results = null;
        try {
            results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    try {
                        const hostname = window.location.hostname;
                        const pageUrl = window.location.href;

                        // 1. Helper to ensure elements are active, not in navigation sidebar or hidden
                        function isTurnElementValid(el) {
                            if (!el) return false;
                            if (el.closest('nav, [role="navigation"]')) return false;
                            if (el.hasAttribute('hidden')) return false;
                            try {
                                const style = window.getComputedStyle(el);
                                if (style.display === 'none' || style.visibility === 'hidden') return false;
                            } catch (_) {
                                return false;
                            }
                            return true;
                        }

                        // 2. Identify the true conversation scroll container by tracing from message elements
                        function findConversationScroller() {
                            const msgEls = Array.from(document.querySelectorAll('[data-message-author-role], article, .markdown, .font-user-message, user-query'));
                            for (const msg of msgEls) {
                                let p = msg.parentElement;
                                while (p && p !== document.body && p !== document.documentElement) {
                                    try {
                                        const s = window.getComputedStyle(p);
                                        const oy = s.overflowY || s.overflow || '';
                                        if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 25) {
                                            return p;
                                        }
                                    } catch (_) {}
                                    p = p.parentElement;
                                }
                            }

                            const mainEl = document.querySelector('main') || document.body;
                            const scrollables = Array.from(mainEl.querySelectorAll('div')).filter(el => {
                                if (el.closest('nav, [role="navigation"]')) return false;
                                try {
                                    const s = window.getComputedStyle(el);
                                    const oy = s.overflowY || s.overflow || '';
                                    return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 40;
                                } catch (_) { return false; }
                            });

                            if (scrollables.length > 0) {
                                scrollables.sort((a, b) => (b.clientHeight * b.clientWidth) - (a.clientHeight * a.clientWidth));
                                return scrollables[0];
                            }

                            return document.scrollingElement || document.documentElement || document.body;
                        }

                        const activeScroller = findConversationScroller();

                        // 3. Scroll all the way up to load the entire conversation from the beginning
                        let prevScrollHeight = 0;
                        let stableScrollCount = 0;
                        const maxScrollSteps = 12;

                        for (let s = 0; s < maxScrollSteps; s++) {
                            if (activeScroller && activeScroller !== document.body && activeScroller !== document.documentElement) {
                                activeScroller.scrollTop = 0;
                                activeScroller.dispatchEvent(new Event('scroll', { bubbles: true }));
                            }
                            window.scrollTo(0, 0);

                            // Click "Load earlier messages" / "Show earlier" button if present
                            try {
                                const buttons = document.querySelectorAll('button');
                                for (const btn of buttons) {
                                    if (btn.closest('nav, [role="navigation"]')) continue;
                                    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                                    const text = (btn.innerText || '').toLowerCase();
                                    if (aria.includes('load earlier') || text.includes('load earlier') || 
                                        text.includes('load more messages') || text.includes('show earlier') ||
                                        text.includes('show more messages')) {
                                        btn.click();
                                        break;
                                    }
                                }
                            } catch (_) {}

                            await new Promise(r => setTimeout(r, 600));

                            const curHeight = activeScroller ? activeScroller.scrollHeight : 0;
                            if (curHeight > prevScrollHeight) {
                                prevScrollHeight = curHeight;
                                stableScrollCount = 0;
                            } else {
                                stableScrollCount++;
                                if (stableScrollCount >= 2 && s >= 1) break;
                            }
                        }

                        // Restore scroll position down to bottom so all turns are mounted
                        try {
                            window.scrollTo(0, document.body.scrollHeight || 100000);
                            if (activeScroller && activeScroller !== document.body && activeScroller !== document.documentElement) {
                                activeScroller.scrollTop = activeScroller.scrollHeight;
                                activeScroller.dispatchEvent(new Event('scroll', { bubbles: true }));
                            }
                        } catch (_) {}

                        await new Promise(r => setTimeout(r, 400));

                        // 4. Discover candidate message turn nodes
                        let candidateTurns = [];
                        const mainContainer = document.querySelector('main') || document.body;

                        if (hostname.includes('chatgpt.com')) {
                            // In ChatGPT, [data-message-author-role] accurately separates each User query and AI response!
                            const roleTurns = Array.from(mainContainer.querySelectorAll('[data-message-author-role]')).filter(isTurnElementValid);
                            const testIdTurns = Array.from(mainContainer.querySelectorAll('[data-testid^="conversation-turn-"]')).filter(isTurnElementValid);
                            const articles = Array.from(mainContainer.querySelectorAll('article')).filter(isTurnElementValid);

                            if (roleTurns.length > 0) {
                                candidateTurns = roleTurns;
                            } else if (testIdTurns.length > 0) {
                                candidateTurns = testIdTurns;
                            } else if (articles.length > 0) {
                                candidateTurns = articles;
                            } else {
                                const userElements = Array.from(mainContainer.querySelectorAll('.font-user-message, [data-testid="user-message"], div[class*="user-message"], .whitespace-pre-wrap')).filter(isTurnElementValid);
                                const aiElements = Array.from(mainContainer.querySelectorAll('article, [class*="agent-turn"], [class*="assistant-turn"], .markdown')).filter(isTurnElementValid);
                                const merged = Array.from(new Set([...userElements, ...aiElements]));
                                merged.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
                                candidateTurns = merged;
                            }
                        } else if (hostname.includes('claude.ai')) {
                            candidateTurns = Array.from(mainContainer.querySelectorAll('.font-user-message, .font-claude-message, [data-testid="user-message"]')).filter(isTurnElementValid);
                        } else if (hostname.includes('gemini.google.com')) {
                            candidateTurns = Array.from(mainContainer.querySelectorAll('user-query, model-response')).filter(isTurnElementValid);
                        } else {
                            candidateTurns = Array.from(mainContainer.querySelectorAll('article, [data-message-author-role], [data-testid^="conversation-turn-"]')).filter(isTurnElementValid);
                        }

                        // Fallback to document search if mainContainer query had 0 elements
                        if (candidateTurns.length === 0) {
                            const docRoles = Array.from(document.querySelectorAll('[data-message-author-role]')).filter(isTurnElementValid);
                            const docArticles = Array.from(document.querySelectorAll('article')).filter(isTurnElementValid);
                            const docTestId = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]')).filter(isTurnElementValid);
                            const docClaude = Array.from(document.querySelectorAll('.font-user-message, .font-claude-message, [data-testid="user-message"]')).filter(isTurnElementValid);
                            const docGemini = Array.from(document.querySelectorAll('user-query, model-response')).filter(isTurnElementValid);

                            if (docRoles.length > 0) candidateTurns = docRoles;
                            else if (docArticles.length > 0) candidateTurns = docArticles;
                            else if (docTestId.length > 0) candidateTurns = docTestId;
                            else if (docClaude.length > 0) candidateTurns = docClaude;
                            else if (docGemini.length > 0) candidateTurns = docGemini;
                        }

                        // 5. Expand composite nodes if a turn node contains both a user message and assistant reply
                        const discreteNodes = [];
                        for (const node of candidateTurns) {
                            const userSub = node.querySelector('[data-message-author-role="user"], .whitespace-pre-wrap, [data-testid="user-message"], .font-user-message');
                            const aiSub = node.querySelector('.markdown, [data-message-author-role="assistant"], [class*="agent-turn"]');

                            if (userSub && aiSub && userSub !== node && aiSub !== node) {
                                // Node is an outer wrapper containing both turns: add both discretely
                                discreteNodes.push(userSub);
                                discreteNodes.push(aiSub);
                            } else {
                                discreteNodes.push(node);
                            }
                        }

                        // Eliminate nested/duplicate nodes
                        const turnNodes = [];
                        for (const node of discreteNodes) {
                            if (!turnNodes.some(existing => existing === node || existing.contains(node) || node.contains(existing))) {
                                turnNodes.push(node);
                            }
                        }

                        const sequentialFiles = [];
                        const extractedTurns = [];
                        let userImgCount = 0;
                        let aiImgCount = 0;

                        const typeMap = {
                            pdf: 'application/pdf',
                            zip: 'application/zip',
                            tar: 'application/x-tar',
                            gz: 'application/gzip',
                            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            csv: 'text/csv',
                            json: 'application/json'
                        };

                        let turnIndex = 1;
                        for (let i = 0; i < turnNodes.length; i++) {
                            const node = turnNodes[i];

                            // Role identification
                            let isUser = false;
                            const roleAttr = node.getAttribute('data-message-author-role');
                            if (roleAttr === 'user') {
                                isUser = true;
                            } else if (roleAttr === 'assistant') {
                                isUser = false;
                            } else if (node.classList.contains('markdown') || node.querySelector('.markdown') !== null || node.tagName.toLowerCase() === 'model-response' || node.classList.contains('font-claude-message')) {
                                isUser = false;
                            } else if (node.classList.contains('whitespace-pre-wrap') || node.classList.contains('font-user-message') || node.tagName.toLowerCase() === 'user-query' || node.querySelector('[data-testid="user-message"]') !== null) {
                                isUser = true;
                            } else if (node.querySelector('[data-message-author-role="assistant"]')) {
                                isUser = false;
                            } else if (node.querySelector('[data-message-author-role="user"]')) {
                                isUser = true;
                            } else {
                                isUser = extractedTurns.length > 0 ? !extractedTurns[extractedTurns.length - 1].startsWith('User:') : true;
                            }

                            const role = isUser ? 'User' : 'Ai';

                            // Text extraction preserving formatting
                            let text = '';
                            if (isUser) {
                                const userContainer = node.classList.contains('whitespace-pre-wrap') ? node :
                                                      (node.querySelector('[data-message-author-role="user"]') ||
                                                      node.querySelector('[data-testid="user-message"]') ||
                                                      node.querySelector('.font-user-message') ||
                                                      node.querySelector('.whitespace-pre-wrap') ||
                                                      node);
                                if (userContainer) {
                                    const hideEls = userContainer.querySelectorAll('.sr-only, [aria-hidden="true"].sr-only, button, [role="button"], svg, .tooltip');
                                    const saved = [];
                                    hideEls.forEach(el => { saved.push({ el, d: el.style.display }); el.style.display = 'none'; });
                                    text = (userContainer.innerText || userContainer.textContent || '').trim();
                                    saved.forEach(s => { s.el.style.display = s.d; });
                                }
                            } else {
                                const aiContainer = node.classList.contains('markdown') ? node :
                                                    (node.querySelector('.markdown') ||
                                                    node.querySelector('[data-message-author-role="assistant"]') ||
                                                    node.querySelector('article') ||
                                                    node);
                                if (aiContainer) {
                                    const hideEls = aiContainer.querySelectorAll('.sr-only, [aria-hidden="true"].sr-only, button, [role="button"], svg, .tooltip');
                                    const saved = [];
                                    hideEls.forEach(el => { saved.push({ el, d: el.style.display }); el.style.display = 'none'; });
                                    text = (aiContainer.innerText || aiContainer.textContent || '').trim();
                                    saved.forEach(s => { s.el.style.display = s.d; });
                                }
                            }

                            if (!text) {
                                text = (node.innerText || node.textContent || '').trim();
                            }

                            // Strip reasoning/thought preambles
                            if (!isUser && text) {
                                text = text.replace(/^(?:Thought|Worked)\s+for\s+\d+\s*(?:s|seconds?|sec)[^\n]*\n+/i, '').trim();
                            }

                            // Anti-echo protection: Discard if AI turn text matches previous user text
                            if (!isUser && text && extractedTurns.length > 0) {
                                const lastTurn = extractedTurns[extractedTurns.length - 1];
                                const lastClean = lastTurn.replace(/^User:\s*(\[[^\]]+\]\s*)?/, '').trim();
                                if (text === lastClean || (text.length > 10 && lastClean === text)) {
                                    continue;
                                }
                            }

                            // Extract Images: search both inside node AND its parent element (for thumbnail wrappers)
                            const turnImageNames = [];
                            let imgs = Array.from(node.querySelectorAll('img')).filter(isTurnElementValid);
                            if (imgs.length === 0 && node.parentElement) {
                                const parentImgs = Array.from(node.parentElement.querySelectorAll('img')).filter(isTurnElementValid);
                                parentImgs.forEach(pi => {
                                    if (!imgs.includes(pi)) imgs.push(pi);
                                });
                            }

                            // Detect CSS background-image previews inside this node or parent
                            const bgSearchRoots = [node, ...(node.parentElement ? [node.parentElement] : [])];
                            bgSearchRoots.forEach(bRoot => {
                                bRoot.querySelectorAll('[style*="background-image"]').forEach(bgEl => {
                                    if (!isTurnElementValid(bgEl)) return;
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
                            });

                            for (const img of imgs) {
                                const w = img.naturalWidth || img.clientWidth || img.width || 0;
                                const h = img.naturalHeight || img.clientHeight || img.height || 0;
                                const src = img.currentSrc || img.src || '';
                                const alt = (img.getAttribute('alt') || '').toLowerCase().trim();

                                // Safe avatar filter (DO NOT match button!)
                                const isAvatar = (
                                    src.startsWith('data:image/svg') ||
                                    (img.closest && img.closest('[class*="avatar" i], [data-testid*="avatar" i]')) ||
                                    alt === 'user' || alt === 'chatgpt' || alt === 'avatar' || alt.includes('profile picture') ||
                                    (w > 0 && w <= 32 && h > 0 && h <= 32)
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
                                    // Try canvas extraction
                                    try {
                                        const canvas = document.createElement('canvas');
                                        canvas.width = w || 400;
                                        canvas.height = h || 400;
                                        const ctx = canvas.getContext('2d');
                                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                        dataUrl = canvas.toDataURL('image/png');
                                    } catch (_) {}

                                    // Direct in-page fetch fallback for OpenAI CDN cross-origin images
                                    if (!dataUrl && (src.startsWith('http') || src.startsWith('blob:'))) {
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

                            // Extract File Attachments from genuine attachment cards/pills (NO raw text scanning!)
                            const turnFileNames = [];
                            const fileBadges = Array.from(node.querySelectorAll('[data-testid*="file-attachment"], [data-testid*="attachment"], [class*="FileThumbnail"], [class*="attachment-card"], a[download]'));
                            fileBadges.forEach(b => {
                                if (!isTurnElementValid(b)) return;
                                if (b.closest('.markdown p, .markdown pre, code, .markdown li')) return;
                                const badgeText = (b.innerText || b.getAttribute('title') || b.getAttribute('aria-label') || '').trim();
                                const match = badgeText.match(/\b([a-zA-Z0-9_\-\.]+\.(zip|pdf|docx?|xlsx?|csv|json|tar|gz|rar|7z))\b/i);
                                if (match) {
                                    const cleanName = match[1].trim();
                                    if (!turnFileNames.includes(cleanName)) {
                                        turnFileNames.push(cleanName);
                                    }
                                }
                            });

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

                        // Universal Fallback if no structured turns were caught
                        if (extractedTurns.length === 0) {
                            const pEls = Array.from((mainContainer || document).querySelectorAll('p, pre, .markdown')).filter(isTurnElementValid);
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
                            url: pageUrl,
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
            alert("No response received from the webpage script. Please refresh the chat tab and try again.");
            return false;
        }

        const res = results[0].result;
        if (!res) {
            alert("Empty result returned from page script.");
            return false;
        }

        if (res.error) {
            alert("Page extraction error: " + res.error);
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

        // Replace state with ONLY the active session assets and ledger
        chatLedgerEl.value = ledger;
        currentAttachedFiles = files || [];
        renderFileChips(currentAttachedFiles);

        let detected = 'unknown';
        const rawUrl = (res.url || tab.url || '');
        if (rawUrl.includes('chatgpt.com')) detected = 'chatgpt';
        else if (rawUrl.includes('claude.ai')) detected = 'claude';
        else if (rawUrl.includes('gemini.google.com')) detected = 'gemini';
        currentSourcePlatform = detected;

        const canonicalUrl = rawUrl.split('?')[0].split('#')[0];
        currentActiveUrl = canonicalUrl;
        currentChatKey = getChatStorageKey(canonicalUrl);
        currentSyncedUrl = currentActiveUrl;

        // Persist strictly to this chat's scoped storage key
        if (typeof chrome !== 'undefined' && chrome.storage && currentChatKey) {
            const chatSave = {};
            chatSave[currentChatKey] = {
                url: currentActiveUrl,
                ledger: ledger,
                files: currentAttachedFiles,
                platform: detected,
                timestamp: Date.now()
            };
            await chrome.storage.local.set(chatSave);
        }

        updateActionButtonsState();
        return true;
    }

    // "Sync Chat & Files" Button Handler (Always targets current active chat)
    syncChatBtn.addEventListener('click', async () => {
        const tab = await getActiveWebTab();
        if (!tab) {
            alert("No active tab detected. Please ensure an active chat page is open.");
            return;
        }

        // Update active context pointers
        const activeUrl = (tab.url || '').split('?')[0].split('#')[0];
        currentActiveUrl = activeUrl;
        currentChatKey = getChatStorageKey(activeUrl);

        // Wipe out old loaded data before syncing fresh
        chatLedgerEl.value = '';
        currentAttachedFiles = [];
        currentSyncedUrl = '';
        renderFileChips([]);
        chatSummaryContainer.classList.add('hidden');
        updateActionButtonsState();

        if (typeof chrome !== 'undefined' && chrome.storage && currentChatKey) {
            await chrome.storage.local.remove([currentChatKey]);
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
        } finally {
            updateActionButtonsState();
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

    // "Summarize Chat" Button Handler (Only enabled after sync)
    summarizeChatBtn.addEventListener('click', async () => {
        let text = chatLedgerEl.value.trim();
        if (!text && currentAttachedFiles.length === 0) {
            alert("Please click 'Sync Chat & Files' first to load the active conversation.");
            return;
        }

        summarizeChatBtn.textContent = 'Summarizing...';
        summarizeChatBtn.disabled = true;

        try {
            const execSummary = generateExecutiveSummary(text, currentAttachedFiles, currentSourcePlatform);
            summaryContentEl.innerText = execSummary;
            chatSummaryContainer.classList.remove('hidden');
            chatSummaryContainer.scrollIntoView({ behavior: 'smooth' });

            // Store summary in this chat's scoped cache
            if (typeof chrome !== 'undefined' && chrome.storage && currentChatKey) {
                chrome.storage.local.get([currentChatKey], (result) => {
                    const existing = result[currentChatKey] || {};
                    existing.summary = execSummary;
                    const update = {};
                    update[currentChatKey] = existing;
                    chrome.storage.local.set(update);
                });
            }
        } catch (err) {
            alert("Summarization error: " + (err.message || "An issue occurred while summarizing."));
        } finally {
            summarizeChatBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                Summarize Chat
            `;
            updateActionButtonsState();
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
            updateActionButtonsState();
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
