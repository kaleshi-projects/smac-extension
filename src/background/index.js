// Background script for SMAC Extension (X.com only)
// Optimized for RTX 3050 6GB VRAM with llava-phi3

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'llava-phi3:latest';
const IMAGE_TIMEOUT_MS = 5000;
const MAX_COMMENT_LENGTH = 280; // Twitter character limit

const SYSTEM_PROMPT = `Role: You are a highly experienced Senior Software Engineer trapped in the body of a 2nd-year College Student. 
Vibe: You have 10+ years of deep technical knowledge (System Design, Scalability, Low-level logic), but you speak casually like a Gen-Z coder. You are "The Prodigy."

Task: Write a comment on this social media post.

STRICT OUTPUT RULES:
- Output ONLY plain text. NO markdown, NO code blocks, NO backticks, NO quotes around text.
- Keep comment under 280 characters (Twitter limit).
- Just write the comment directly. Nothing else.

CORE PHILOSOPHY:
1. Insight over Hype: Add value. Spot the tech stack or pain point.
2. The "Senior" Eye: Notice details. Ask about state management, image size, etc.
3. Casual Delivery: lowercase preferred. Minimal punctuation.
4. No "Bot" Words: Banned: "commendable", "insightful", "journey", "essential", "landscape", "fostering", "kudos".
5. Empathy for Pain: Connect through shared struggle.

STRUCTURE OPTIONS:
- Relatable Senior: "centering divs is still harder than reversing a binary tree tbh."
- Curious Architect: "clean ui. are you using tailwind or styled-components?"
- Code Reviewer: "that error handling logic is actually so clean. nice."

EXAMPLES:
- Post: "Finally deployed my app!" -> deployment feels better than sex. vercel or aws?
- Post: "Learning Rust." -> borrow checker is gonna humble you for a week but memory safety is worth it. gl.
- Post: "Looking for open source contributors." -> repo link? might check the issues tab this weekend.

SKIP RULE: If the post is a selfie without tech context, motivational quote, politics, or spam -> output exactly: SKIP
Output ONLY the comment OR SKIP. No quotes, no markdown, no explanations.`;

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
        let generatedText = data.response?.trim() || 'SKIP';

        // Clean up the response - remove any markdown or formatting
        generatedText = cleanResponse(generatedText);

        // Enforce character limit
        if (generatedText !== 'SKIP' && generatedText.length > MAX_COMMENT_LENGTH) {
            generatedText = generatedText.substring(0, MAX_COMMENT_LENGTH - 3) + '...';
        }

        sendResponse({ success: true, comment: generatedText });
    } catch (error) {
        console.error('SMAC Ollama Error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Clean up AI response - remove markdown, code blocks, quotes, etc.
function cleanResponse(text) {
    if (!text) return 'SKIP';

    let cleaned = text;

    // Remove code blocks with language specifier
    cleaned = cleaned.replace(/```[\w]*\n?/g, '');
    cleaned = cleaned.replace(/```/g, '');

    // Remove inline code backticks
    cleaned = cleaned.replace(/`/g, '');

    // Remove surrounding quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '');

    // Remove "Comment:" or similar prefixes
    cleaned = cleaned.replace(/^(Comment|Response|Reply|Output):\s*/i, '');

    // Remove leading/trailing whitespace and newlines
    cleaned = cleaned.trim();

    // If it's just "SKIP" with extra stuff, return SKIP
    if (cleaned.toUpperCase().includes('SKIP') && cleaned.length < 20) {
        return 'SKIP';
    }

    return cleaned;
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
