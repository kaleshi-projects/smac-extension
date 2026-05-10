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

Post text: ${payload.text}
${payload.hasImage ? 'The post also contains an image (attached). Incorporate relevant visual details when they are genuinely useful.' : ''}

Task: Write a ${payload.intentLabel} comment. 2-4 sentences. Human and specific. No "Great post!" openers.

No markdown, no hashtags. Return ONLY the comment text.`;
    }

    if (payload.mode === 'profile') {
        return `You are a thoughtful professional who writes personalised outreach messages.

You have read the following profile information:
${payload.text}

Your task: Write a ${payload.intentLabel} outreach message to this person. It must:
- Reference at least one specific detail from their profile (post, role, project, or opinion)
- Feel warm and genuine - not salesy or templated
- Be 3-5 sentences maximum
- Never mention that you "came across their profile" or use similar cliches
- Contain no markdown formatting

Return ONLY the message text. No subject line, no greeting prefix.`;
    }

    if (payload.mode === 'message') {
        if (payload.isEmptyThread) {
            return `You are helping someone start a new conversation on a professional social network.

Context:
${payload.text}

Your task: Write a ${payload.intentLabel} opener from the perspective of "You". It must:
- Sound natural and specific, not templated
- Be concise - usually 1 to 3 sentences
- Fit a professional networking context
- Give the recipient a clear reason to respond

Return ONLY the message text.`;
        }

        return `You are helping someone respond in a messaging thread on a professional social network.

Conversation history (most recent last):
${payload.text}

Your task: Write a ${payload.intentLabel} message from the perspective of "You". It must:
- Match the existing conversational tone in the thread
- Be concise - usually 1 to 3 sentences
- Sound fully human - no AI giveaways, no stiff corporate language
- Require no editing before sending

Return ONLY the message text.`;
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

    if (payload.mode === 'post' && payload.coords) {
        imageBase64 = await captureAndCrop(payload.coords);
    }

    payload.hasImage = !!imageBase64;
    const promptText = buildPrompt(payload);

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
        throw createRuntimeError('EMPTY_RESPONSE', 'The model returned an empty response. Try a different intent.');
    }

    return { success: true, comment: cleaned };
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
