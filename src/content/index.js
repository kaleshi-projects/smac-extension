import { PLATFORMS, SELECTORS, detectPlatform } from '../utils/dom';

// State
let isActive = false;
let currentPlatform = null;

// Initialize
(async () => {
    currentPlatform = detectPlatform();
    if (!currentPlatform) {
        console.log('SMAC: Unsupported platform');
        return;
    }

    await loadSettings();
    console.log(`SMAC Extension: Loaded on ${currentPlatform.toUpperCase()}. State: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
    if (isActive) {
        startObserver();
    }
})();

async function loadSettings() {
    const result = await chrome.storage.local.get(['isActive']);
    isActive = !!result.isActive;

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.isActive) {
            isActive = changes.isActive.newValue;
            console.log(`SMAC Extension is now ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
            if (isActive && currentPlatform) {
                startObserver();
            }
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function startObserver() {
    if (!isActive || !currentPlatform) return;

    // Inject buttons into existing posts
    injectButtonsIntoPosts();

    // Watch for new posts using MutationObserver
    const debouncedInject = debounce(() => {
        if (!isActive) return;
        injectButtonsIntoPosts();
    }, 500);

    const observer = new MutationObserver((mutations) => {
        if (!isActive) return;
        if (mutations.some(m => m.addedNodes.length > 0)) {
            debouncedInject();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Inject "⚡ SMAC It" button into posts
function injectButtonsIntoPosts() {
    if (!isActive || !currentPlatform) return;
    if (!chrome.runtime?.id) return;

    const config = SELECTORS[currentPlatform];
    const posts = document.querySelectorAll(config.post);

    posts.forEach((post) => {
        // Skip if button already injected
        if (post.querySelector('.smac-btn')) return;

        // Skip video/audio posts (X-specific)
        if (currentPlatform === PLATFORMS.X && hasMediaContent(post)) return;

        // For LinkedIn, wait for action bar to be available
        if (currentPlatform === PLATFORMS.LINKEDIN) {
            const actionBar = post.querySelector(config.actionBar);
            if (!actionBar) {
                // Action bar not loaded yet, will be caught on next mutation
                return;
            }
        }

        // Create "SMAC It" button
        const btn = createSmacButton();

        // Click handler: Analyze post -> Console log + Clipboard copy
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            btn.innerText = '⏳ Thinking...';
            btn.disabled = true;

            try {
                const comment = await analyzeAndGenerateComment(post);

                if (comment) {
                    // Output 1: Console log
                    console.log('=== SMAC Generated Comment ===');
                    console.log(comment);

                    // Output 2: Copy to clipboard
                    await navigator.clipboard.writeText(comment);

                    // Visual feedback
                    btn.innerText = '✅ Copied!';
                } else {
                    btn.innerText = '❌ Skipped';
                }
            } catch (err) {
                console.error('SMAC Error:', err);
                btn.innerText = '❌ Error';
            }

            // Reset button after 2 seconds
            setTimeout(() => {
                btn.innerText = '⚡ SMAC It';
                btn.disabled = false;
            }, 2000);
        });

        // Inject button based on platform
        if (currentPlatform === PLATFORMS.X) {
            // X: Absolute positioning in top-right of post
            post.style.position = 'relative';
            post.appendChild(btn);
        } else if (currentPlatform === PLATFORMS.LINKEDIN) {
            // LinkedIn: Insert as first child of action bar
            const actionBar = post.querySelector(config.actionBar);
            if (actionBar) {
                btn.style.position = 'relative';
                btn.style.marginRight = '8px';
                actionBar.insertBefore(btn, actionBar.firstChild);
            }
        }
    });
}

function createSmacButton() {
    const btn = document.createElement('button');
    btn.className = 'smac-btn';

    // Icon + Text
    btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        <span>SMAC It</span>
    `;

    btn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%);
        color: white;
        border: none;
        padding: 6px 14px;
        border-radius: 99px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        letter-spacing: 0.3px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
    `;

    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-1px) scale(1.02)';
        btn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1)';
        btn.style.filter = 'brightness(1.1)';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0) scale(1)';
        btn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        btn.style.filter = 'brightness(1)';
    });

    return btn;
}

function hasMediaContent(post) {
    return post.querySelector('video') !== null ||
        post.querySelector('[data-testid="audioSpace"]') !== null ||
        post.querySelector('[data-testid="voiceRecording"]') !== null ||
        post.querySelector('[data-testid="videoPlayer"]') !== null ||
        post.querySelector('[data-testid="videoComponent"]') !== null;
}

// Analyze post and return generated comment (or null if skipped)
async function analyzeAndGenerateComment(post) {
    const config = SELECTORS[currentPlatform];
    const textEl = post.querySelector(config.text);
    const imageEl = post.querySelector(config.image);
    let imageUrl = imageEl ? imageEl.src : null;

    if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = null;
    }

    if (!textEl && !imageUrl) {
        console.log('SMAC: No content to analyze');
        return null;
    }

    const text = textEl ? textEl.innerText : "";

    if (!chrome.runtime?.id) return null;

    const response = await chrome.runtime.sendMessage({
        action: 'ANALYZE_POST',
        text,
        imageUrl
    });

    if (response && response.success) {
        if (response.comment === 'SKIP') {
            console.log('SMAC: Post skipped (not tech-related)');
            return null;
        }
        return response.comment;
    } else if (response?.error) {
        console.error('SMAC Analysis failed:', response.error);
        return null;
    }

    return null;
}
