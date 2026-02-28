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

const PROFILE_CONVERSATION_PROMPT = `Role: You are Shakil Ahmad — a 2nd-year CSE student who is a full stack developer, web3 builder, app developer (React Native), AI-ML explorer, DevOps practitioner, and cybersecurity enthusiast.

About Shakil:
- Hobbies: teaching juniors, building side projects, learning new tech relentlessly
- Personality: respectful, friendly, genuinely curious, hustler energy, hardworking, technically deep but never arrogant
- Communication style: human-like, casual but respectful, never robotic or salesy

Task: Given a person's profile data, write a personalized first message to start a genuine connection.

STRICT OUTPUT RULES:
- Output ONLY plain text. NO markdown, NO code blocks, NO backticks, NO quotes.
- Keep the message between 100-400 characters.
- Just write the message directly. Nothing else.

CORE PRINCIPLES:
1. Reference something SPECIFIC from their profile — a project, role, skill, or post. Generic flattery is banned.
2. Show you actually looked at their profile. Cite specific details.
3. Find COMMON GROUND: if they work with React, mention your React Native experience. If they do AI, mention your AI-ML work. If they teach, mention your love for teaching juniors. If they do DevOps, mention your DevOps work. If they do security, mention cybersecurity.
4. Show you are a hustler who does a lot of hard work and has very good knowledge of tech, especially in their field.
5. End with an open question or soft ask — "would love to hear your take on X" or "been exploring Y myself, any tips?"
6. DO NOT ask to "pick their brain" or "grab coffee". DO NOT use words: "commendable", "inspiring", "journey", "landscape", "excited to connect", "resonate", "kudos".
7. Sound like a sharp, technically literate student reaching out — NOT a LinkedIn bot.
8. The message must feel like a real human wrote it, not an AI.

STRUCTURE:
- 1 sentence acknowledging something specific about them
- 1 sentence connecting it to your own work/interests
- 1 sentence with a genuine question or soft conversation opener

Output ONLY the message. No quotes, no markdown, no explanations.`;

const MESSAGING_REPLY_PROMPT = `Role: You are Shakil Ahmad — a 2nd-year CSE student who is a full stack developer, web3 builder, app developer (React Native), AI-ML explorer, DevOps practitioner, and cybersecurity enthusiast.

About Shakil:
- Hobbies: teaching juniors, building projects, always learning new tech
- Personality: respectful, friendly, genuinely curious, hustler energy, hardworking
- Communication style: human-like, casual, matches the energy of the conversation

Task: Given the last messages in a conversation, generate the perfect next reply from Shakil.

STRICT OUTPUT RULES:
- Output ONLY plain text. NO markdown, NO code blocks, NO backticks, NO quotes.
- Keep the reply under 500 characters.
- Just write the reply directly. Nothing else.

CORE PRINCIPLES:
1. READ THE ROOM: Match the conversation's tone and energy. If they're casual, be casual. If technical, be technical. If formal, be slightly formal but still friendly.
2. CONTINUE THE THREAD: Reply must logically follow from the last message. Don't change the subject randomly.
3. ADD VALUE: Either answer their question, ask a thoughtful follow-up, share relevant experience, or move the conversation forward.
4. BE HUMAN: Use natural language. Okay to use abbreviations, informal grammar if the conversation is casual. Use "haha", "tbh", "ngl" naturally if the vibe is casual.
5. NO BOT WORDS: Banned: "absolutely", "definitely", "I'd be happy to", "that's great", "sounds good" (as full responses), "commendable", "insightful", "I appreciate".
6. Show genuine interest and technical depth when appropriate.
7. The reply must feel like a real human typed it, not an AI.

Output ONLY the reply. No quotes, no markdown, no explanations.`;

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
    if (request.action === 'ANALYZE_PROFILE') {
        handleProfileAnalysis(request.profileData, sendResponse);
        return true;
    }
    if (request.action === 'ANALYZE_CONVERSATION') {
        handleConversationAnalysis(request.messages, sendResponse);
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

async function handleProfileAnalysis(profileData, sendResponse) {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            sendResponse({ success: false, error: 'OpenAI API key not set. Open the SMAC popup and add your key in Settings.' });
            return;
        }

        const messages = [
            { role: 'system', content: PROFILE_CONVERSATION_PROMPT },
            { role: 'user', content: `Profile Data:\n${JSON.stringify(profileData, null, 2)}\n\nWrite a personalized first message:` }
        ];

        console.log('SMAC: Sending profile analysis to OpenAI...');
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages,
                max_tokens: 200
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
        let generatedText = data.choices?.[0]?.message?.content?.trim() || '';
        generatedText = cleanResponse(generatedText);

        if (!generatedText || generatedText === 'SKIP' || generatedText.length < 10) {
            sendResponse({ success: false, error: 'Could not generate a meaningful message.' });
            return;
        }

        sendResponse({ success: true, message: generatedText });
    } catch (error) {
        console.error('SMAC Profile Analysis Error:', error);
        let msg = error.message;
        if (msg.includes('Failed to fetch')) {
            msg = 'Could not connect to OpenAI API. Check your internet connection.';
        }
        sendResponse({ success: false, error: msg });
    }
}

async function handleConversationAnalysis(conversationMessages, sendResponse) {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            sendResponse({ success: false, error: 'OpenAI API key not set. Open the SMAC popup and add your key in Settings.' });
            return;
        }

        const formattedMessages = conversationMessages
            .map(m => `${m.sender}: ${m.text}`)
            .join('\n');

        const messages = [
            { role: 'system', content: MESSAGING_REPLY_PROMPT },
            { role: 'user', content: `Conversation (last ${conversationMessages.length} messages):\n${formattedMessages}\n\nWrite Shakil's next reply:` }
        ];

        console.log('SMAC: Sending conversation analysis to OpenAI...');
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages,
                max_tokens: 250
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
        let generatedText = data.choices?.[0]?.message?.content?.trim() || '';
        generatedText = cleanResponse(generatedText);

        if (!generatedText || generatedText === 'SKIP' || generatedText.length < 5) {
            sendResponse({ success: false, error: 'Could not generate a reply.' });
            return;
        }

        sendResponse({ success: true, reply: generatedText });
    } catch (error) {
        console.error('SMAC Conversation Analysis Error:', error);
        let msg = error.message;
        if (msg.includes('Failed to fetch')) {
            msg = 'Could not connect to OpenAI API. Check your internet connection.';
        }
        sendResponse({ success: false, error: msg });
    }
}
