// src/content/modes/profile.js
import { SELECTORS, PLATFORMS } from '../../utils/dom.js';
import { showIntentModal } from '../modal.js';

export async function handleProfileClick(platform) {
    const config = SELECTORS[platform].profile;
    let extractedText = '';

    if (platform === PLATFORMS.X) {
        const name = readFirstText(config.userName);
        const bio = readFirstText(config.bio);
        const header = readFirstText(config.header);
        const tweets = readCollectionText(config.tweets, { limit: 4, minLength: 20 }).join('\n---\n');

        const sections = [];
        if (name) sections.push(`Name: ${name}`);
        if (bio) sections.push(`Bio: ${bio}`);
        if (header) sections.push(`Info: ${header}`);
        if (tweets) sections.push(`Recent Tweets:\n${tweets}`);
        extractedText = sections.join('\n');
    } else if (platform === PLATFORMS.LINKEDIN) {
        const s = SELECTORS[platform].profile;
        const main = document.querySelector('main');

        const name = readFirstText(s.name);
        const headline = readFirstText(s.headline);
        const location = readFirstText(s.location);
        const about = readFirstText(s.about);
        const featured = readCollectionText(s.featured, { limit: 4, minLength: 20 }).join('\n---\n');
        const experience = readCollectionText(s.experience, { limit: 2, minLength: 10 }).join(' | ');
        const posts = readCollectionText(s.posts, { limit: 5, minLength: 20 }).join('\n---\n');
        const visibleProfileText = extractVisibleProfileText(main);

        extractedText = [
            name ? `Name: ${name}` : '',
            headline ? `Headline: ${headline}` : '',
            location ? `Location: ${location}` : '',
            about ? `About: ${about}` : '',
            featured ? `Featured:\n${featured}` : '',
            experience ? `Experience: ${experience}` : '',
            posts ? `Recent Posts:\n${posts}` : '',
            visibleProfileText ? `Visible Profile Text:\n${visibleProfileText}` : '',
        ].filter(Boolean).join('\n');
    }

    if (platform === PLATFORMS.LINKEDIN) {
        if (cleanText(extractedText).length < 80) {
            throw new Error('Could not read this profile. Scroll to load the page fully and try again.');
        }
    } else {
        if (!extractedText.trim()) {
            throw new Error('Could not extract profile information.');
        }
    }

    // Limit to 3000 tokens roughly (approx 12000 chars)
    if (extractedText.length > 12000) {
        extractedText = extractedText.substring(0, 12000) + '...';
    }

    const intent = await showIntentModal('profile');
    if (!intent) return null;

    const response = await chrome.runtime.sendMessage({
        action: 'GENERATE_AI_RESPONSE',
        payload: {
            mode: 'profile',
            intentLabel: intent,
            text: extractedText
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

function readFirstText(selectors, parent = document) {
    for (const selector of normalizeSelectors(selectors)) {
        const node = querySelectorSafe(parent, selector);
        const text = cleanText(node?.innerText);
        if (text) return text;
    }
    return '';
}

function readCollectionText(selectors, options = {}) {
    const {
        limit = Number.POSITIVE_INFINITY,
        minLength = 0,
        parent = document,
    } = options;

    for (const selector of normalizeSelectors(selectors)) {
        const items = [];
        const seen = new Set();

        for (const node of querySelectorAllSafe(parent, selector)) {
            const text = cleanText(node?.innerText);
            if (!text || text.length < minLength || seen.has(text)) {
                continue;
            }

            seen.add(text);
            items.push(text);

            if (items.length >= limit) {
                return items;
            }
        }

        if (items.length > 0) {
            return items;
        }
    }

    return [];
}

function normalizeSelectors(selectors) {
    if (!selectors) return [];
    return Array.isArray(selectors) ? selectors : [selectors];
}

function querySelectorSafe(parent, selector) {
    try {
        return parent.querySelector(selector);
    } catch {
        return null;
    }
}

function querySelectorAllSafe(parent, selector) {
    try {
        return Array.from(parent.querySelectorAll(selector));
    } catch {
        return [];
    }
}

function cleanText(value) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

function extractVisibleProfileText(root) {
    const source = root?.innerText;
    if (!source) return '';

    const ignoredExact = new Set([
        'Message',
        'More',
        'Connect',
        'Pending',
        'Follow',
        'Show all',
        'Open to work',
        'Posts',
        'Comments',
        'Videos',
        'Images',
    ]);

    const lines = [];
    const seen = new Set();

    for (const rawLine of source.split('\n')) {
        const line = cleanText(rawLine);
        if (!line || line.length < 3 || ignoredExact.has(line)) {
            continue;
        }

        if (
            /^Try Premium/i.test(line) ||
            /^Search$/i.test(line) ||
            /^Home$/i.test(line) ||
            /^My Network$/i.test(line) ||
            /^Jobs$/i.test(line) ||
            /^Messaging$/i.test(line) ||
            /^Notifications$/i.test(line) ||
            /^Analytics$/i.test(line)
        ) {
            continue;
        }

        if (seen.has(line)) {
            continue;
        }

        seen.add(line);
        lines.push(line);

        if (lines.length >= 80) {
            break;
        }
    }

    return lines.join('\n');
}
