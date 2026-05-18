// src/content/modes/message.js
import { SELECTORS, PLATFORMS } from '../../utils/dom.js';
import { showIntentModal } from '../modal.js';

export async function handleMessageClick(platform) {
    const config = SELECTORS[platform].message;
    const entries = Array.from(document.querySelectorAll(config.container)).slice(-30);
    const history = [];
    const recipientName = readFirstText(config.recipientName);
    const recipientMeta = readFirstText(config.recipientMeta);

    entries.forEach((entry) => {
        const bubble = entry.querySelector(config.text) || entry;
        const text = cleanText(bubble?.innerText);
        if (!text) return;

        const isYou = detectSender(entry, bubble, platform);

        history.push(`${isYou ? 'You' : 'Them'}: ${text}`);
    });

    const isEmptyThread = history.length === 0;
    const intent = await showIntentModal('message', isEmptyThread);
    if (!intent) return null;

    const historyText = isEmptyThread
        ? buildEmptyThreadContext(recipientName, recipientMeta)
        : buildThreadContext(history, recipientName, recipientMeta);

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

function buildEmptyThreadContext(recipientName, recipientMeta) {
    const sections = [];
    if (recipientName) {
        sections.push(`Recipient: ${recipientName}`);
    }
    if (recipientMeta && recipientMeta !== recipientName) {
        sections.push(`Recipient details: ${recipientMeta}`);
    }
    sections.push('No prior messages in this thread yet.');

    return sections.join('\n');
}

function buildThreadContext(history, recipientName, recipientMeta) {
    const sections = [];
    if (recipientName) {
        sections.push(`Recipient: ${recipientName}`);
    }
    if (recipientMeta && recipientMeta !== recipientName) {
        sections.push(`Recipient details: ${recipientMeta}`);
    }

    const latestThem = [...history].reverse().find((line) => line.startsWith('Them:'));
    if (latestThem) {
        sections.push(`Latest message from them: ${latestThem.replace(/^Them:\s*/, '')}`);
    }

    const latestYou = [...history].reverse().find((line) => line.startsWith('You:'));
    if (latestYou) {
        sections.push(`Your latest message: ${latestYou.replace(/^You:\s*/, '')}`);
    }

    sections.push('Conversation transcript:');
    sections.push(history.join('\n'));
    return sections.join('\n');
}

function readFirstText(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of list) {
        try {
            const value = cleanText(document.querySelector(selector)?.innerText);
            if (value) return value;
        } catch {
            continue;
        }
    }
    return '';
}

function cleanText(value) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}
