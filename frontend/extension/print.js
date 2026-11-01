document.addEventListener('DOMContentLoaded', () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['printData'], (result) => {
            if (result.printData) {
                const { text, platform } = result.printData;
                renderChat(text, platform);
                
                // Trigger print dialog after a short delay to ensure rendering is complete
                setTimeout(() => {
                    window.print();
                }, 500);
            } else {
                document.getElementById('chat-container').innerHTML = '<p>No chat data found to print.</p>';
            }
        });
    }
});

function renderChat(text, platform) {
    const container = document.getElementById('chat-container');
    document.body.className = `theme-${platform}`;
    
    // Determine labels based on platform
    let userLabel = '👤 You';
    let aiLabel = '🤖 AI';
    
    if (platform === 'chatgpt') {
        aiLabel = '🤖 ChatGPT';
    } else if (platform === 'claude') {
        userLabel = '👤 User';
        aiLabel = '🤖 Claude';
    } else if (platform === 'gemini') {
        aiLabel = '✨ Gemini';
    }

    // Split text by "User: " and "AI: "
    // This regex splits on lines starting with User: or AI:, keeping the delimiter
    const tokens = text.split(/^(User:\s*|AI:\s*)/m);
    
    let currentRole = null;
    let currentContent = '';

    const messages = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.startsWith('User:')) {
            if (currentRole) messages.push({ role: currentRole, content: currentContent.trim() });
            currentRole = 'user';
            currentContent = '';
        } else if (token.startsWith('AI:')) {
            if (currentRole) messages.push({ role: currentRole, content: currentContent.trim() });
            currentRole = 'ai';
            currentContent = '';
        } else {
            currentContent += token;
        }
    }
    if (currentRole) {
        messages.push({ role: currentRole, content: currentContent.trim() });
    }

    // If it couldn't parse normally, just wrap the whole thing
    if (messages.length === 0) {
        messages.push({ role: 'unknown', content: text });
    }

    messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${msg.role}`;
        
        let label = '';
        if (msg.role === 'user') label = userLabel;
        else if (msg.role === 'ai') label = aiLabel;
        
        if (label) {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'role-label';
            labelDiv.textContent = label;
            msgDiv.appendChild(labelDiv);
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.textContent = msg.content;
        msgDiv.appendChild(contentDiv);

        container.appendChild(msgDiv);
    });
}
