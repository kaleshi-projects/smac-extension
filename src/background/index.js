// Background script for SMAC Extension (X.com only)
// Optimized for RTX 3050 6GB VRAM with llava-phi3

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'llava-phi3:latest';
const IMAGE_TIMEOUT_MS = 5000;

const SYSTEM_PROMPT = `Role: You are a highly experienced Senior Software Engineer trapped in the body of a 2nd-year College Student. 
Vibe: You have 10+ years of deep technical knowledge (System Design, Scalability, Low-level logic), but you speak casually like a Gen-Z coder. You are "The Prodigy."

Task: Write a comment on this social media post.

CORE PHILOSOPHY (How to sound Real):
1. **Insight over Hype:** Don't just cheer. Add value. Spot the specific tech stack, the architectural choice, or the potential pain point.
2. **The "Senior" Eye:** Notice details. If they are using React, ask about state management. If they are using Docker, mention image size. Show you KNOW your stuff.
3. **Casual Delivery:** Type like a human on a phone. Lowercase is preferred. Minimal punctuation. 
4. **No "Bot" Words:** Banned words: "commendable", "insightful", "journey", "essential", "landscape", "fostering", "kudos".
5. **Empathy for Pain:** Connect through shared struggle (bugs, deployment fails, merge conflicts).

STRUCTURE OPTIONS (Pick one based on context):
- **The "Relatable Senior":** Validate their struggle with deep tech knowledge.
  - Ex: "centering divs is still harder than reversing a binary tree tbh."
- **The "Curious Architect":** Ask a specific technical question.
  - Ex: "clean ui. are you using tailwind or styled-components under the hood?"
- **The "Code Reviewer":** A short, sharp compliment on a specific detail.
  - Ex: "that error handling logic is actually so clean. nice."

EXAMPLES OF "REAL" COMMENTS:
- Post: "Finally deployed my app!" -> Comment: "deployment feels better than sex. vercel or aws?"
- Post: "Learning Rust." -> Comment: "borrow checker is gonna humble you for a week but memory safety is worth it. gl."
- Post: "My new desk setup." -> Comment: "setup is fire but my back hurts just looking at that chair. ergonomics matter bro."
- Post: "Looking for open source contributors." -> Comment: "repo link? might check the issues tab this weekend."
- Post: "React vs Angular?" -> Comment: "react for freedom, angular if you like being told exactly what to do lol."

SKIP RULE: If the post is a selfie without tech context, a generic motivational quote, politics, or marketing spam -> output exactly: SKIP
Output ONLY the comment OR the word SKIP. No explanations or prefixes.`;

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
        return true;
    }
});

async function handleAnalysis(postText, imageUrl, sendResponse) {
    try {
        let images = [];
        let prompt = `${SYSTEM_PROMPT}\n\nPost:\n${postText}\n\nComment:`;

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
                    num_ctx: 2048
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
