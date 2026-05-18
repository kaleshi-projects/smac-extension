import { encryptKey, decryptKey } from './crypto.js';
import { captureAndCrop } from './screenshot.js';
import { runOllama } from './backends/ollama.js';
import { runRemote } from './backends/remote.js';

function cleanResponse(text) {
    if (!text) return 'SKIP';
    let cleaned = text.trim();
    if (cleaned.toUpperCase() === 'SKIP') return 'SKIP';

    cleaned = cleaned.replace(/```[\w]*\n?/g, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.replace(/`/g, '');
    cleaned = cleaned.replace(/^(Comment|Response|Reply|Output):\s*/i, '');
    cleaned = cleaned.replace(/[\s.,;:!"']*[Ss][Kk][Ii][Pp][\s.,;:!"']*$/g, '');
    cleaned = cleaned.replace(/\s+Skip\s*$/gi, '');
    cleaned = cleaned.replace(/\.\s*Skip\s*$/gi, '.');
    cleaned = cleaned.replace(/^Skip\s+/gi, '');
    cleaned = cleaned.replace(/^SKIP\s+/gi, '');
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/^["'"'"'`]+|["'"'"'`]+$/g, '');
    cleaned = cleaned.trim();

    if (!cleaned || cleaned.length < 5) return 'SKIP';
    return cleaned;
}

function buildPrompt(payload) {
    if (payload.mode === 'post') {
        return `You are a Senior Software Engineer with strong communication skills and a professional-yet-warm tone.

Post text:
${payload.text}
${payload.hasImage ? 'A cropped screenshot of the post is also attached. Use it only if it adds genuinely useful context.' : ''}

Task: Write a ${payload.intentLabel} comment. 2-4 sentences. Human and specific. No "Great post!" openers.

Use details from the post when possible. No markdown, no hashtags, no placeholders, no square brackets.
Return ONLY the comment text.`;
    }

    if (payload.mode === 'profile') {
        return `You are writing a LinkedIn outreach message.

Profile you read:
${payload.text}

Task: Write a ${payload.intentLabel} message to this person.

STRICT RULES:
1. Use their ACTUAL name from the profile above — never write [Name]
2. Reference ONE specific real detail: their actual job title, company, a post topic, a skill
3. NEVER use [Company], [Topic], [Specific Industry Trend] or any bracket placeholder
4. NEVER say "I came across your profile" or "I noticed your impressive work"
5. 3-4 sentences. Warm and direct, not salesy
6. No markdown, no subject line

Return ONLY the message. Nothing else.`;
    }

    if (payload.mode === 'message') {
        return `You are composing a message in a LinkedIn DM thread.

Conversation (oldest first, most recent last):
${payload.text}

The LAST message above is what you must respond to.

Task: Write a ${payload.intentLabel} reply from "You".

STRICT RULES — violating any of these makes the output unusable:
1. Read the actual last message and respond to its specific content
2. Use the real name of the person if it appears in the thread — NEVER write [Name]
3. Reference what was actually said — a specific question, offer, or statement
4. NEVER use brackets like [Company], [Topic], [Specific Detail]
5. 1-3 sentences. Match the conversational tone (casual if they are casual)
6. Sound like a real person replying, not a template

Return ONLY the message text. Nothing else.`;
    }

    return '';
}

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.remove(['encryptedApiKey', 'apiKeyIv'], () => {
            chrome.storage.local.set({ isActive: false });
        });
    }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    void _sender;

    if (request.action === 'GENERATE_AI_RESPONSE') {
        handleGeneration(request.payload)
            .then(sendResponse)
            .catch((error) => {
                sendResponse({ success: false, error: formatRuntimeError(error) });
            });
        return true;
    }

    if (request.action === 'ENCRYPT_AND_SAVE_KEY') {
        encryptKey(request.key)
            .then((encrypted) => {
                if (!encrypted) {
                    throw createRuntimeError('CONFIG', 'Please enter an API key.');
                }

                chrome.storage.local.set({
                    encryptedApiKey: encrypted.ciphertext,
                    apiKeyIv: encrypted.iv
                }, () => {
                    sendResponse({ success: true });
                });
            })
            .catch((error) => {
                sendResponse({ success: false, error: formatRuntimeError(error) });
            });
        return true;
    }

    if (request.action === 'CLEAR_API_KEY') {
        chrome.storage.local.remove(['encryptedApiKey', 'apiKeyIv'], () => {
            sendResponse({ success: true });
        });
        return true;
    }
});

async function handleGeneration(payload) {
    let imageBase64 = null;

    const settings = await chrome.storage.local.get([
        'useRemote',
        'remoteEndpoint',
        'remoteModel',
        'localModel',
        'encryptedApiKey',
        'apiKeyIv'
    ]);

    const useRemote = !!settings.useRemote;
    const localModel = typeof settings.localModel === 'string' ? settings.localModel.trim() : '';
    const remoteEndpoint = typeof settings.remoteEndpoint === 'string' ? settings.remoteEndpoint.trim() : '';
    const remoteModel = typeof settings.remoteModel === 'string' ? settings.remoteModel.trim() : '';

    if (payload.mode === 'post' && payload.coords && shouldAttachImage(useRemote, localModel, remoteModel, remoteEndpoint)) {
        imageBase64 = await captureAndCrop(payload.coords);
    }

    payload.hasImage = !!imageBase64;
    const promptText = buildPrompt(payload);

    let resultText = '';

    if (useRemote) {
        if (!remoteEndpoint) {
            throw createRuntimeError('CONFIG', 'Please enter a remote API endpoint in the popup.');
        }
        if (!remoteModel) {
            throw createRuntimeError('CONFIG', 'Please enter a remote model name in the popup.');
        }

        const apiKey = await decryptKey(settings.apiKeyIv, settings.encryptedApiKey);
        if (!apiKey) {
            throw createRuntimeError('CONFIG', 'Remote API key not configured. Save your key in the popup first.');
        }

        resultText = await runRemote(
            apiKey,
            remoteEndpoint,
            remoteModel,
            promptText,
            imageBase64
        );
    } else {
        if (!localModel) {
            throw createRuntimeError('CONFIG', 'No local model configured. Open the SMAC popup and enter a model name.');
        }

        resultText = await runOllama(
            localModel,
            promptText,
            imageBase64
        );
    }

    const cleaned = cleanResponse(resultText);
    if (cleaned === 'SKIP') {
        throw createRuntimeError('EMPTY_RESPONSE', 'Model returned no usable output. Try a different intent.');
    }

    const validated = validateOutput(cleaned, payload.mode);
    return { success: true, comment: validated };
}

function validateOutput(text, mode) {
    let normalized = normalizeGeneratedText(text, mode);

    const minLength = mode === 'message' ? 8 : 20;
    if (!normalized || normalized.length < minLength) {
        throw new Error('Generated output too short. Try again.');
    }

    // Reject unresolved placeholders only after attempting cleanup.
    const placeholderPattern = /\[.{2,40}\]/;
    if (placeholderPattern.test(normalized)) {
        throw new Error('Model returned placeholder text. Retrying is recommended.');
    }

    // Reject responses that are just the prompt echoed back
    if (normalized.toLowerCase().startsWith('you are') || normalized.toLowerCase().startsWith('your task')) {
        throw new Error('Model returned prompt instead of output. Try again.');
    }

    // Post mode: enforce length
    if (mode === 'post') {
        const sentences = normalized.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 4) {
            return sentences.slice(0, 4).join('. ').trim() + '.';
        }
    }

    return normalized;
}

function normalizeGeneratedText(text, mode) {
    let normalized = text.trim();

    if (mode === 'message' || mode === 'profile') {
        normalized = normalized
            .replace(/\b(?:hi|hello|hey)\s*,?\s*\[[^\]]{2,40}\]\s*/i, '')
            .replace(/\[[^\]]{2,40}\]/g, '')
            .replace(/\s+([,!.?;:])/g, '$1')
            .replace(/\(\s*\)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    if (mode === 'post') {
        normalized = normalized.replace(/\[[^\]]{2,40}\]/g, '').trim();
    }

    return normalized;
}

function extractField(text, label) {
    const pattern = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, 'mi');
    const match = text.match(pattern);
    return match?.[1]?.trim() || '';
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shouldAttachImage(useRemote, localModel, remoteModel, remoteEndpoint) {
    if (useRemote) {
        return remoteModelSupportsVision(remoteModel, remoteEndpoint);
    }

    return localModelSupportsVision(localModel);
}

function localModelSupportsVision(model) {
    const normalized = model.toLowerCase();
    if (!normalized) return false;

    return [
        'bakllava',
        'gemma3',
        'llama3.2-vision',
        'llava',
        'minicpm-v',
        'minicpmv',
        'moondream',
        'phi3v',
        'phi-3-vision',
        'qwen-vl',
        'qwen2-vl',
        'qwen2.5-vl',
        'vision',
        'vl'
    ].some((token) => normalized.includes(token));
}

function remoteModelSupportsVision(model, endpoint) {
    const normalizedModel = model.toLowerCase();
    const normalizedEndpoint = endpoint.toLowerCase();

    if (normalizedEndpoint.includes('generativelanguage.googleapis.com')) {
        return true;
    }

    return [
        'claude-3',
        'gemini',
        'gpt-4.1',
        'gpt-4o',
        'gpt-4-turbo',
        'llama-vision',
        'o4',
        'vision',
        'vl'
    ].some((token) => normalizedModel.includes(token));
}

function createRuntimeError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function formatRuntimeError(error) {
    if (error?.code === 'CORS') {
        return { type: 'CORS', message: error.message };
    }

    if (error?.message) {
        return error.message;
    }

    return 'Unknown error.';
}
