// src/content/modes/post.js
import { SELECTORS } from '../../utils/dom.js';
import { showIntentModal } from '../modal.js';

export async function handlePostClick(post, platform) {
    const s = SELECTORS[platform];
    let text = readFirstText(post, s.postText);

    if (!text) {
        // Last resort: get all text from post container, strip UI noise
        text = post.innerText
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 10) // remove short UI labels
            .filter(l => !['Like', 'Comment', 'Repost', 'Send', 'React', 'Share'].includes(l))
            .slice(0, 20)
            .join('\n');
    }

    if (!text) {
        throw new Error('Could not extract post text. Try clicking the button on a different post.');
    }

    const author = readFirstText(post, s.postAuthor);
    const hashtags = Array.from(new Set(text.match(/#[\p{L}\p{N}_-]+/gu) || []));
    const imageAltText = Array.from(post.querySelectorAll(s.postImage.join(', ')))
        .map((image) => image.getAttribute('alt')?.trim() || image.getAttribute('aria-label')?.trim() || '')
        .filter(Boolean);

    const extractedSections = [];
    if (author) extractedSections.push(`Author: ${author}`);
    extractedSections.push(`Post text: ${text}`);
    if (hashtags.length > 0) extractedSections.push(`Hashtags: ${hashtags.join(', ')}`);
    if (imageAltText.length > 0) extractedSections.push(`Image alt text: ${imageAltText.join(' | ')}`);

    const intent = await showIntentModal('post');
    if (!intent) return null; // Cancelled

    // Get coordinates for screenshot
    const rect = post.getBoundingClientRect();
    const coords = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        dpr: window.devicePixelRatio || 1
    };

    const response = await chrome.runtime.sendMessage({
        action: 'GENERATE_AI_RESPONSE',
        payload: {
            mode: 'post',
            intentLabel: intent,
            text: extractedSections.join('\n'),
            coords
        }
    });

    if (response && response.success) {
        return response.comment;
    } else if (response?.error) {
        if (response.error.type === 'CORS') {
            throw { type: 'CORS', message: response.error.message };
        }
        throw new Error(response.error);
    }
    
    return null;
}

function readFirstText(parent, selectors = []) {
    for (const selector of selectors || []) {
        const el = parent.querySelector(selector);
        const value = el?.innerText?.trim();
        if (value) return value;
    }
    return '';
}
