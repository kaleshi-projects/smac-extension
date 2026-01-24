import { PLATFORMS, SELECTORS, findAndFocusInput, simulateTyping } from '../utils/dom';

// State
let processedPosts = new Set();
let isActive = false;

// Initialize
(async () => {
    await loadSettings();
    console.log('SMAC Extension: Content Script Loaded. Initial State:', isActive ? 'ACTIVE' : 'INACTIVE');
    if (isActive) {
        startObserver();
    }
})();

async function loadSettings() {
    const result = await chrome.storage.local.get(['processedPosts', 'isActive']);
    if (result.processedPosts) {
        processedPosts = new Set(result.processedPosts);
    }
    isActive = !!result.isActive;

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.isActive) {
            isActive = changes.isActive.newValue;
            console.log(`SMAC Extension is now ${isActive ? 'ACTIVE' : 'INACTIVE'}`);

            if (isActive) {
                startObserver();
            }
        }
    });
}

async function saveProcessedPost(id) {
    processedPosts.add(id);
    await chrome.storage.local.set({ processedPosts: Array.from(processedPosts) });
}

function getPlatform() {
    const host = window.location.hostname;
    if (host.includes('twitter.com') || host.includes('x.com')) return PLATFORMS.X;
    return null;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function startObserver() {
    if (!isActive) return;

    const platform = getPlatform();
    if (!platform) return;

    const debouncedCheck = debounce(() => {
        if (!isActive) return;
        checkForPosts(platform);
    }, 1000);

    const observer = new MutationObserver((mutations) => {
        if (!isActive) return;
        if (mutations.some(m => m.addedNodes.length > 0)) {
            debouncedCheck();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    if (isActive) checkForPosts(platform);
}

function checkForPosts(platform) {
    if (!isActive) return;
    if (!chrome.runtime?.id) {
        console.warn('SMAC: Extension context invalidated.');
        return;
    }

    const selector = SELECTORS[platform].post;
    const posts = document.querySelectorAll(selector);

    posts.forEach(async (post) => {
        let postId = getPostId(post, platform);
        if (!postId) return;
        if (processedPosts.has(postId)) return;
        if (!isInViewport(post)) return;

        // Skip video/audio posts
        if (hasMediaContent(post)) {
            console.debug('SMAC: Skipping media post', postId);
            await saveProcessedPost(postId);
            return;
        }

        await saveProcessedPost(postId);
        processPost(post, platform, postId);
    });
}

// Detect video/audio posts
function hasMediaContent(post) {
    const hasVideo = post.querySelector('video') !== null;
    const hasAudioSpace = post.querySelector('[data-testid="audioSpace"]') !== null;
    const hasVoiceNote = post.querySelector('[data-testid="voiceRecording"]') !== null;
    const hasVideoPlayer = post.querySelector('[data-testid="videoPlayer"]') !== null;
    const hasVideoComponent = post.querySelector('[data-testid="videoComponent"]') !== null;

    return hasVideo || hasAudioSpace || hasVoiceNote || hasVideoPlayer || hasVideoComponent;
}

function getPostId(post, platform) {
    try {
        if (platform === PLATFORMS.X) {
            const timeLink = post.querySelector('time')?.closest('a');
            if (timeLink) return timeLink.href;
        }
    } catch (e) {
        return null;
    }
    return null;
}

function isInViewport(element) {
    try {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    } catch (e) { return false; }
}

async function addLog(entry) {
    try {
        const result = await chrome.storage.local.get(['smacLogs']);
        const logs = result.smacLogs || [];
        if (logs.length > 100) logs.shift();

        logs.push({
            timestamp: new Date().toISOString(),
            ...entry
        });

        await chrome.storage.local.set({ smacLogs: logs });
    } catch (e) {
        // ignore
    }
}

async function processPost(post, platform, postId) {
    const selector = SELECTORS[platform];
    const textEl = post.querySelector(selector.text);
    const imageEl = post.querySelector(selector.image);
    let imageUrl = imageEl ? imageEl.src : null;

    if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = null;
    }

    if (!textEl && !imageUrl) return;

    const text = textEl ? textEl.innerText : "";

    try {
        if (!chrome.runtime?.id) return;

        const response = await chrome.runtime.sendMessage({
            action: 'ANALYZE_POST',
            text,
            imageUrl
        });

        if (response && response.success) {
            if (response.comment === 'SKIP') {
                console.debug(`Skipped post ${postId}`);
            } else {
                handleGeneratedComment(post, response.comment, platform, postId, !!imageUrl);
            }
        } else if (response?.error) {
            console.error('Analysis failed:', response.error);
        }
    } catch (err) {
        if (!err.message.includes('Extension context invalidated') && !err.message.includes('Receiving end does not exist')) {
            console.error('SMAC Message error:', err);
        }
    }
}

async function handleGeneratedComment(post, comment, platform, postId, hasImage) {
    // Only show visual indicator (blue border)
    post.style.border = '2px solid #1DA1F2';

    // CONSOLE LOG ONLY - No injection
    console.log('=== SMAC AI ===');
    console.log('Post:', postId);
    console.log('Vision:', hasImage ? 'YES' : 'NO');
    console.log('Generated Comment:', comment);

    const logEntry = {
        status: "SUCCESS",
        post_url: postId,
        vision: hasImage,
        comment: comment,
    };

    console.log(logEntry);
    addLog(logEntry);
}

