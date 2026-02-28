// Background script for SMAC Extension
// Uses OpenAI GPT-4o-mini with vision for post analysis

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL_NAME = 'gpt-4o-mini';
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

async function getApiKey() {
    const result = await chrome.storage.local.get(['openaiApiKey']);
    return result.openaiApiKey || null;
}

async function handleAnalysis(postText, imageUrl, sendResponse) {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            sendResponse({ success: false, error: 'OpenAI API key not set. Open the SMAC popup and add your key in Settings.' });
            return;
        }

        const messages = [
            { role: 'system', content: SYSTEM_PROMPT }
        ];

        let userContent;

        if (imageUrl && imageUrl.startsWith('http')) {
            console.log('SMAC: Fetching image:', imageUrl);
            try {
                const base64DataUrl = await fetchImageWithTimeout(imageUrl, IMAGE_TIMEOUT_MS);
                if (base64DataUrl) {
                    userContent = [
                        { type: 'text', text: `Analyze this image and text:\n${postText}\n\nComment:` },
                        { type: 'image_url', image_url: { url: base64DataUrl } }
                    ];
                }
            } catch (e) {
                console.warn('SMAC: Image fetch failed or timed out, PROCEEDING WITH TEXT ONLY:', e.message);
            }
        }

        if (!userContent) {
            userContent = `Post:\n${postText}\n\nComment:`;
        }

        messages.push({ role: 'user', content: userContent });

        console.log('SMAC: Sending request to OpenAI...');
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: messages,
                max_tokens: 150
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMsg = errorData?.error?.message || `API Error (${response.status})`;
            if (response.status === 401) {
                throw new Error('Invalid OpenAI API key. Check your key in SMAC Settings.');
            }
            if (response.status === 429) {
                throw new Error('OpenAI rate limit exceeded. Try again in a moment.');
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        let generatedText = data.choices?.[0]?.message?.content?.trim() || 'SKIP';

        // Clean up the response - remove any markdown or formatting
        generatedText = cleanResponse(generatedText);

        // Enforce character limit
        if (generatedText !== 'SKIP' && generatedText.length > MAX_COMMENT_LENGTH) {
            generatedText = generatedText.substring(0, MAX_COMMENT_LENGTH - 3) + '...';
        }

        sendResponse({ success: true, comment: generatedText });
    } catch (error) {
        console.error('SMAC OpenAI Error:', error);
        let msg = error.message;
        if (msg.includes('Failed to fetch')) {
            msg = 'Could not connect to OpenAI API. Check your internet connection.';
        }
        sendResponse({ success: false, error: msg });
    }
}

// Clean up AI response - remove markdown, code blocks, quotes, etc.
function cleanResponse(text) {
    if (!text) return 'SKIP';

    let cleaned = text.trim();

    // If just SKIP, return early
    if (cleaned.toUpperCase() === 'SKIP') return 'SKIP';

    // Remove code blocks with language specifier
    cleaned = cleaned.replace(/```[\w]*\n?/g, '');
    cleaned = cleaned.replace(/```/g, '');

    // Remove inline code backticks
    cleaned = cleaned.replace(/`/g, '');

    // Remove "Comment:" or similar prefixes
    cleaned = cleaned.replace(/^(Comment|Response|Reply|Output):\s*/i, '');

    // Remove trailing "SKIP" or "Skip" (sometimes AI adds SKIP at end)
    cleaned = cleaned.replace(/[\s.,;:!"']*[Ss][Kk][Ii][Pp][\s.,;:!"']*$/g, '');
    cleaned = cleaned.replace(/\s+Skip\s*$/gi, '');
    cleaned = cleaned.replace(/\.\s*Skip\s*$/gi, '.');

    // Remove leading "Skip" (sometimes AI puts Skip at start)
    cleaned = cleaned.replace(/^Skip\s+/gi, '');
    cleaned = cleaned.replace(/^SKIP\s+/gi, '');

    // Remove all types of surrounding quotes (multiple passes)
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/^["'"'"'`]+|["'"'"'`]+$/g, '');
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/^["'"'"'`]+|["'"'"'`]+$/g, '');

    // Remove leading/trailing whitespace and newlines
    cleaned = cleaned.trim();

    // If mostly empty after cleanup, return SKIP
    if (!cleaned || cleaned.length < 5) {
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
                resolve(reader.result.toString());
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
