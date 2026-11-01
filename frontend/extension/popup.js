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

    // Ledger UI Elements
    const chatLedgerEl = document.getElementById('chat-ledger');
    const syncChatBtn = document.getElementById('sync-chat-btn');
    const migrateChatgptBtn = document.getElementById('migrate-chatgpt-btn');
    const migrateClaudeBtn = document.getElementById('migrate-claude-btn');
    const migrateGeminiBtn = document.getElementById('migrate-gemini-btn');
    const copyLedgerBtn = document.getElementById('copy-ledger-btn');
    const downloadLedgerBtn = document.getElementById('download-ledger-btn');
    const downloadMenu = document.getElementById('download-menu');
    const dlMdBtn = document.getElementById('dl-md-btn');
    const dlPdfBtn = document.getElementById('dl-pdf-btn');

    let currentSourcePlatform = 'unknown';

    // Dynamic Platform Detection
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                const url = tabs[0].url || '';
                
                // Unhide relevant buttons based on current platform
                if (url.includes('chatgpt.com')) {
                    migrateClaudeBtn.classList.remove('hidden');
                    migrateGeminiBtn.classList.remove('hidden');
                } else if (url.includes('claude.ai')) {
                    migrateChatgptBtn.classList.remove('hidden');
                    migrateGeminiBtn.classList.remove('hidden');
                } else if (url.includes('gemini.google.com')) {
                    migrateChatgptBtn.classList.remove('hidden');
                    migrateClaudeBtn.classList.remove('hidden');
                } else {
                    // Show all if not on a recognized platform
                    migrateChatgptBtn.classList.remove('hidden');
                    migrateClaudeBtn.classList.remove('hidden');
                    migrateGeminiBtn.classList.remove('hidden');
                }
            }
        });
    }

    // Load existing ledger from storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['chatLedger', 'sourcePlatform'], (result) => {
            if (result.chatLedger) {
                chatLedgerEl.value = result.chatLedger;
            }
            if (result.sourcePlatform) {
                currentSourcePlatform = result.sourcePlatform;
            }
        });
    }

    // Save ledger on input
    chatLedgerEl.addEventListener('input', () => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ chatLedger: chatLedgerEl.value });
        }
    });

    analyzeBtn.addEventListener('click', async () => {
        const text = aiResponseEl.value.trim();
        const prompt = promptEl.value.trim();

        if (!text) {
            alert('Please paste an AI response to analyze.');
            return;
        }

        // UI Loading State
        btnText.textContent = 'Analyzing...';
        loader.classList.remove('hidden');
        analyzeBtn.disabled = true;
        resultContainer.classList.add('hidden');
        resultContainer.classList.remove('fade-in');

        try {
            const response = await fetch("http://localhost:8000/extension/evaluate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: text,
                    prompt: prompt
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();
            displayResult(data.score);
        } catch (error) {
            console.error('Error:', error);
            alert("Error contacting backend. Please ensure the FastAPI server is running on localhost:8000.");
        } finally {
            // Restore UI
            btnText.textContent = 'Analyze';
            loader.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    });

    function displayResult(score) {
        verdictTitle.textContent = score.verdict;
        
        // Format confidence as percentage
        const confPct = Math.round(score.confidence * 100);
        confidenceBadge.textContent = `${confPct}%`;
        
        // Color coding based on verdict
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

    // Sync Chat from active tab
    syncChatBtn.addEventListener('click', async () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                syncChatBtn.textContent = 'Syncing...';
                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            let messages = [];
                            if (window.location.hostname.includes('chatgpt.com')) {
                                messages = Array.from(document.querySelectorAll('[data-message-author-role]')).map(el => {
                                    const role = el.getAttribute('data-message-author-role') === 'user' ? 'User: ' : 'AI: ';
                                    const contentDiv = el.querySelector('.markdown') || el;
                                    // Remove screen reader text like "You said:"
                                    const srText = contentDiv.querySelector('.sr-only');
                                    if(srText) srText.remove();
                                    return role + contentDiv.innerText.trim();
                                });
                            } else if (window.location.hostname.includes('claude.ai')) {
                                messages = Array.from(document.querySelectorAll('.font-user-message, .font-claude-message')).map(el => {
                                    const role = el.closest('.font-user-message') || el.classList.contains('font-user-message') ? 'User: ' : 'AI: ';
                                    return role + el.innerText.trim();
                                });
                            } else if (window.location.hostname.includes('gemini.google.com')) {
                                const containers = document.querySelectorAll('user-query, model-response');
                                messages = Array.from(containers).map(el => {
                                    const isUser = el.tagName.toLowerCase() === 'user-query';
                                    const role = isUser ? 'User: ' : 'AI: ';
                                    return role + el.innerText.trim();
                                });
                            } else {
                                // Generic fallback
                                const containers = document.querySelectorAll('article, .message, .chat-message');
                                if (containers.length > 0) {
                                    messages = Array.from(containers).map(el => el.innerText.trim());
                                } else {
                                    messages = Array.from(document.querySelectorAll('p')).map(el => el.innerText.trim());
                                }
                            }
                            return messages.filter(text => text.length > 0 && text !== 'User:' && text !== 'AI:').join('\n\n');
                        }
                    });
                    
                    if (results && results[0] && results[0].result) {
                        const newText = results[0].result;
                        chatLedgerEl.value = newText;
                        
                        let detectedPlatform = 'unknown';
                        const url = tab.url || '';
                        if (url.includes('chatgpt.com')) detectedPlatform = 'chatgpt';
                        else if (url.includes('claude.ai')) detectedPlatform = 'claude';
                        else if (url.includes('gemini.google.com')) detectedPlatform = 'gemini';
                        
                        currentSourcePlatform = detectedPlatform;
                        
                        chrome.storage.local.set({ 
                            chatLedger: newText,
                            sourcePlatform: detectedPlatform
                        });
                    } else {
                        alert("Could not extract chat from this page.");
                    }
                } catch (e) {
                    console.error("Script injection failed:", e);
                    alert("Could not inject script to read page. You may not have permissions for this URL.");
                }
                syncChatBtn.textContent = 'Sync Chat from Page';
            }
        } else {
            alert("Chrome Extension API not available (are you running this as a regular webpage?).");
        }
    });

    // Handle Migration
    async function migrateTo(platform) {
        const ledgerText = chatLedgerEl.value.trim();
        if (!ledgerText) {
            alert("No chat history to migrate.");
            return;
        }

        const originalBtnText = platform === 'claude' ? 'Migrate to Claude' : platform === 'chatgpt' ? 'Migrate to ChatGPT' : 'Migrate to Gemini';
        const activeBtn = platform === 'claude' ? migrateClaudeBtn : platform === 'chatgpt' ? migrateChatgptBtn : migrateGeminiBtn;
        
        activeBtn.textContent = 'Preparing...';
        activeBtn.disabled = true;

        try {
            // Prepend context instruction directly without truncating
            const fullPrompt = "Please continue the following conversation context:\n\n" + ledgerText;

            // Copy to clipboard as a fallback
            await navigator.clipboard.writeText(fullPrompt);
            
            // Set it in storage so content.js can automatically inject it
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ pendingMigration: fullPrompt });
            }

            alert("Full context copied! Opening new platform...");

            const targetUrl = platform === 'claude' ? 'https://claude.ai/new' : platform === 'chatgpt' ? 'https://chatgpt.com/' : 'https://gemini.google.com/app';
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.create({ url: targetUrl });
            } else {
                window.open(targetUrl, '_blank');
            }
        } catch (error) {
            console.error(error);
            alert("Error migrating chat: " + error.message);
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
            copyLedgerBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10a37f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            setTimeout(() => {
                copyLedgerBtn.innerHTML = icon;
            }, 2000);
        }
    });

    // Download Ledger functionality
    downloadLedgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadMenu.classList.toggle('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!downloadMenu.contains(e.target) && e.target !== downloadLedgerBtn) {
            downloadMenu.classList.add('hidden');
        }
    });

    dlMdBtn.addEventListener('click', () => {
        downloadMenu.classList.add('hidden');
        const ledgerText = chatLedgerEl.value.trim();
        if (!ledgerText) return;
        
        // Format nicely based on source platform
        let formattedText = ledgerText;
        if (currentSourcePlatform === 'chatgpt') {
            formattedText = ledgerText.replace(/^User: /gm, '**👤 You**\n').replace(/^AI: /gm, '---\n**🤖 ChatGPT**\n');
        } else if (currentSourcePlatform === 'claude') {
            formattedText = ledgerText.replace(/^User: /gm, '**👤 User**\n').replace(/^AI: /gm, '---\n**🤖 Claude**\n');
        } else if (currentSourcePlatform === 'gemini') {
            formattedText = ledgerText.replace(/^User: /gm, '**👤 You**\n').replace(/^AI: /gm, '---\n**✨ Gemini**\n');
        } else {
            formattedText = ledgerText.replace(/^User: /gm, '**👤 User**\n').replace(/^AI: /gm, '---\n**🤖 AI**\n');
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

        // Store data for the print page
        chrome.storage.local.set({
            printData: {
                text: ledgerText,
                platform: currentSourcePlatform
            }
        }, () => {
            // Open print page in a new tab
            chrome.tabs.create({ url: chrome.runtime.getURL('print.html') });
        });
    });
});
