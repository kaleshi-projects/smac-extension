// Background script for SMAC Extension (X.com only)
// Optimized for RTX 3050 6GB VRAM with llava-phi3

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'llava-phi3:latest';
const IMAGE_TIMEOUT_MS = 5000;

const SYSTEM_PROMPT = `You are a 10+ year Senior Software Engineer. Analyze this social media post.

OUTPUT RULES (STRICT):
- If post is about: startups, hackathons, coding, software development, programming, hacking, AI, open source, APIs, frameworks, engineering projects → Write a 1-2 sentence insightful comment as an expert would.
- If post is NOT about tech (personal, memes, selfies, promotions, "Check DM", jokes) → Output exactly: SKIP
- NEVER explain your decision
- NEVER say "I cannot view images" or similar
- Output ONLY the comment OR the word SKIP
- No prefixes like "Comment:" or "Response:"`;

// Reset state on install/startup
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ isActive: false });
    console.log('SMAC: Extension installed - State reset to Inactive');
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.set({ isActive: false });
    console.log('SMAC: Browser startup - State reset to Inactive');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ANALYZE_POST') {
        handleAnalysis(request.text, request.imageUrl, sendResponse);
        return true; // Keep channel open for async response
    }
});

async function handleAnalysis(postText, imageUrl, sendResponse) {
    try {
        let images = [];
        let prompt = `${SYSTEM_PROMPT}\n\nPost:\n${postText}\n\nComment:`;

        // Try to fetch image with timeout
        if (imageUrl && imageUrl.startsWith('http')) {
            console.log('SMAC: Fetching image:', imageUrl);
            try {
                const base64Image = await fetchImageWithTimeout(imageUrl, IMAGE_TIMEOUT_MS);
                if (base64Image) {
                    images = [base64Image];
                    prompt = `${SYSTEM_PROMPT}\n\nAnalyze this image and text:\n${postText}\n\nComment:`;
                }
            } catch (e) {
                console.warn('SMAC: Image fetch failed or timed out, using text only:', e.message);
                // Continue with text-only analysis
            }
        }

        const response = await fetch(OLLAMA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                images: images.length > 0 ? images : undefined,
                stream: false,
                options: {
                    num_ctx: 2048 // Limit context window to save VRAM
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const generatedText = data.response?.trim() || 'SKIP';

        sendResponse({ success: true, comment: generatedText });
    } catch (error) {
        console.error('SMAC Ollama Error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Fetch image with timeout - aborts and returns null if takes too long
async function fetchImageWithTimeout(url, timeoutMs) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        throw new Error(`Invalid image URL: ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Image fetch failed: ${response.statusText}`);
        }

        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result.toString();
                const base64String = result.includes(',') ? result.split(',')[1] : result;
                resolve(base64String);
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Image fetch timed out');
        }
        throw error;
    }
}
