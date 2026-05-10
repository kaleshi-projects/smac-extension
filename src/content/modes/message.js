// src/content/modes/message.js
import { SELECTORS, PLATFORMS } from '../../utils/dom.js';
import { showIntentModal } from '../modal.js';

export async function handleMessageClick(platform) {
    const config = SELECTORS[platform].message;
    const entries = Array.from(document.querySelectorAll(config.container)).slice(-30);
    const history = [];

    entries.forEach((entry) => {
        const bubble = entry.querySelector(config.text) || entry;
        const text = bubble?.innerText?.trim();
        if (!text) return;

        const isYou = detectSender(entry, bubble, platform);

        history.push(`${isYou ? 'You' : 'Them'}: ${text}`);
    });

    const isEmptyThread = history.length === 0;
    const intent = await showIntentModal('message', isEmptyThread);
    if (!intent) return null;

    const historyText = isEmptyThread
        ? 'No prior messages in this thread yet.'
        : history.join('\n');

    const response = await chrome.runtime.sendMessage({
        action: 'GENERATE_AI_RESPONSE',
        payload: {
            mode: 'message',
            intentLabel: intent,
            text: historyText,
            isEmptyThread
        }
    });

    if (response?.success) {
        return response.comment;
    }

    if (response?.error?.type === 'CORS') {
        throw { type: 'CORS', message: response.error.message };
    }

    throw new Error(response?.error || 'Unknown error from background worker.');
}

function detectSender(entry, bubble, platform) {
    const classNames = entry.className?.toString() || '';
    const entryStyle = window.getComputedStyle(entry);
    const bubbleStyle = bubble ? window.getComputedStyle(bubble) : null;

    if (platform === PLATFORMS.LINKEDIN) {
        return (
            classNames.includes('right') ||
            classNames.includes('sent') ||
            entryStyle.alignSelf === 'flex-end' ||
            entryStyle.justifyContent === 'flex-end' ||
            bubbleStyle?.alignSelf === 'flex-end'
        );
    }

    return (
        !!entry.querySelector('[data-testid="deleteMessageButton"]') ||
        entryStyle.alignSelf === 'flex-end' ||
        entryStyle.justifyContent === 'flex-end' ||
        bubbleStyle?.alignSelf === 'flex-end'
    );
}
