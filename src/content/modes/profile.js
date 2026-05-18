// src/content/modes/profile.js
import { SELECTORS, PLATFORMS } from '../../utils/dom.js';
import { showIntentModal } from '../modal.js';

export async function handleProfileClick(platform) {
    const config = SELECTORS[platform].profile;
    let extractedText = '';

    if (platform === PLATFORMS.X) {
        const name = readText(config.userName);
        const bio = readText(config.bio);
        const header = readText(config.header);
        
        const tweetNodes = document.querySelectorAll(config.tweets);
        const tweets = Array.from(tweetNodes)
            .slice(0, 4)
            .map((tweet) => tweet.innerText?.trim())
            .filter(Boolean)
            .join('\n---\n');

        const sections = [];
        if (name) sections.push(`Name: ${name}`);
        if (bio) sections.push(`Bio: ${bio}`);
        if (header) sections.push(`Info: ${header}`);
        if (tweets) sections.push(`Recent Tweets:\n${tweets}`);
        extractedText = sections.join('\n');
    } else if (platform === PLATFORMS.LINKEDIN) {
        const name = readText(config.name);
        const headline = readText(config.headline);
        const about = readText(config.about);
        const featured = readText(config.featured);
        
        const expNodes = document.querySelectorAll(config.experience);
        const experience = Array.from(expNodes)
            .slice(0, 2)
            .map((entry) => entry.innerText?.trim())
            .filter(Boolean)
            .join('\n');
        
        const postNodes = document.querySelectorAll(config.posts);
        const posts = Array.from(postNodes)
            .slice(0, 4)
            .map((entry) => entry.innerText?.trim())
            .filter(Boolean)
            .join('\n---\n');

        const sections = [];
        if (name) sections.push(`Name: ${name}`);
        if (headline) sections.push(`Headline: ${headline}`);
        if (about) sections.push(`About: ${about}`);
        if (featured) sections.push(`Featured: ${featured}`);
        if (experience) sections.push(`Experience:\n${experience}`);
        if (posts) sections.push(`Recent Posts:\n${posts}`);
        extractedText = sections.join('\n');
    }

    if (!extractedText.trim()) {
        throw new Error('Could not extract profile information.');
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

function readText(selector) {
    return document.querySelector(selector)?.innerText?.trim() || '';
}
