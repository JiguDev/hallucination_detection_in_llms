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
            btnText.textContent = 'Analyze Claim';
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
});
