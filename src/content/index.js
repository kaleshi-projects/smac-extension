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
        addButtonsToPosts(platform);
    }, 1000);

    const observer = new MutationObserver((mutations) => {
        if (!isActive) return;
        if (mutations.some(m => m.addedNodes.length > 0)) {
            debouncedCheck();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    if (isActive) addButtonsToPosts(platform);
}

// Add SMAC button to each post
function addButtonsToPosts(platform) {
    if (!isActive) return;
    if (!chrome.runtime?.id) return;

    const selector = SELECTORS[platform].post;
    const posts = document.querySelectorAll(selector);

    posts.forEach((post) => {
        // Skip if button already added
        if (post.querySelector('.smac-btn')) return;

        let postId = getPostId(post, platform);
        if (!postId) return;

        // Skip video/audio posts
        if (hasMediaContent(post)) return;

        // Create SMAC button
        const btn = document.createElement('button');
        btn.className = 'smac-btn';
        btn.innerText = '🤖 SMAC';
        btn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: transform 0.2s, box-shadow 0.2s;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        });

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.innerText = '⏳ Thinking...';
            btn.disabled = true;
            await generateComment(post, platform, postId);
            btn.innerText = '✅ Done';
            setTimeout(() => {
                btn.innerText = '🤖 SMAC';
                btn.disabled = false;
            }, 2000);
        });

        // Make post relative for absolute positioning
        post.style.position = 'relative';
        post.appendChild(btn);
    });
}

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
        logs.push({ timestamp: new Date().toISOString(), ...entry });
        await chrome.storage.local.set({ smacLogs: logs });
    } catch (e) { }
}

async function generateComment(post, platform, postId) {
    const selector = SELECTORS[platform];
    const textEl = post.querySelector(selector.text);
    const imageEl = post.querySelector(selector.image);
    let imageUrl = imageEl ? imageEl.src : null;

    if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = null;
    }

    if (!textEl && !imageUrl) {
        console.log('SMAC: No content to analyze');
        return;
    }

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
                console.log('=== SMAC AI ===');
                console.log('Post:', postId);
                console.log('Result: SKIPPED (not tech-related)');
            } else {
                post.style.border = '2px solid #1DA1F2';

                console.log('=== SMAC AI ===');
                console.log('Post:', postId);
                console.log('Vision:', imageUrl ? 'YES' : 'NO');
                console.log('Generated Comment:', response.comment);

                // Type comment into the reply input box
                const input = await findAndFocusInput(post, platform);
                if (input) {
                    simulateTyping(input, response.comment);
                    console.log('SMAC: Comment typed into reply box!');
                } else {
                    console.warn('SMAC: Could not find reply input box. Comment:', response.comment);
                }

                addLog({
                    status: "SUCCESS",
                    post_url: postId,
                    vision: !!imageUrl,
                    comment: response.comment,
                });
            }
        } else if (response?.error) {
            console.error('SMAC Analysis failed:', response.error);
        }
    } catch (err) {
        if (!err.message.includes('Extension context invalidated') && !err.message.includes('Receiving end does not exist')) {
            console.error('SMAC Message error:', err);
        }
    }
}
