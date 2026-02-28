import { PLATFORMS, SELECTORS, detectPlatform, PAGE_TYPES, detectPageType } from '../utils/dom';
import { injectProfileButton } from './profileButton';
import { injectMessagingButton } from './messagingButton';

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
    injectToastContainer(); // Prepare toast UI
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

    // Run initial injections
    runInjections();

    // Watch for new DOM nodes (posts loading, messaging panels opening)
    const debouncedInject = debounce(() => {
        if (!isActive) return;
        runInjections();
    }, 500);

    const observer = new MutationObserver((mutations) => {
        if (!isActive) return;
        if (mutations.some(m => m.addedNodes.length > 0)) {
            debouncedInject();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // SPA navigation detection (LinkedIn and X are SPAs)
    let lastUrl = window.location.href;
    const titleEl = document.querySelector('head > title') || document.head;
    const urlObserver = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            console.log('SMAC: URL changed to', lastUrl);
            setTimeout(() => runInjections(), 1000);
        }
    });
    urlObserver.observe(titleEl, { childList: true, subtree: true, characterData: true });
}

function runInjections() {
    if (!isActive || !currentPlatform) return;
    if (!chrome.runtime?.id) return;

    const pageType = detectPageType(currentPlatform);

    // Feed posts buttons (existing feature) - show on feed and profile pages
    if (pageType === PAGE_TYPES.FEED || pageType === PAGE_TYPES.PROFILE) {
        injectButtonsIntoPosts();
    }

    // Profile "Start Conversation" button
    if (pageType === PAGE_TYPES.PROFILE) {
        injectProfileButton(currentPlatform, showToast);
    }

    // Messaging "Thinking" button
    if (pageType === PAGE_TYPES.MESSAGING) {
        injectMessagingButton(currentPlatform, showToast);
    }

    // LinkedIn messaging overlay can appear on any page
    if (currentPlatform === PLATFORMS.LINKEDIN && pageType !== PAGE_TYPES.MESSAGING) {
        const hasOverlay = document.querySelector(
            '.msg-overlay-list-bubble [contenteditable="true"], ' +
            '.msg-overlay-conversation-bubble [contenteditable="true"], ' +
            '.msg-form__contenteditable'
        );
        if (hasOverlay) {
            injectMessagingButton(currentPlatform, showToast);
        }
    }
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
            if (!actionBar) return;
        }

        // 1. Create the button with correct platform style
        const btn = createSmacButton(currentPlatform);

        // 2. Attach Click Handler
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Visual Feedback: Button State
            const originalInnerHTML = btn.innerHTML;
            btn.innerHTML = `<span style="animation: pulse 1s infinite">⏳</span>`;
            btn.disabled = true;

            // Visual Feedback: Toast
            showToast('⏳ Reading post...', 'info');

            try {
                const comment = await analyzeAndGenerateComment(post);

                if (comment) {
                    // Output 1: Console log
                    console.log('=== SMAC Generated Comment ===');
                    console.log(comment);

                    // Output 2: Copy to clipboard
                    await navigator.clipboard.writeText(comment);

                    // Visual feedback
                    btn.innerHTML = originalInnerHTML;
                    showToast('✅ Comment copied to clipboard!', 'success');
                } else {
                    btn.innerHTML = originalInnerHTML;
                    showToast('⚠️ Skipped (No tech context)', 'warning');
                }
            } catch (err) {
                console.error('SMAC Error:', err);
                btn.innerHTML = originalInnerHTML;
                showToast(`❌ Error: ${err.message || 'Unknown error'}`, 'error');
            } finally {
                btn.disabled = false;
            }
        });

        // 3. Inject button based on platform
        if (currentPlatform === PLATFORMS.X) {
            // X: Absolute positioning in top-right of post
            post.style.position = 'relative';
            post.appendChild(btn);
        } else if (currentPlatform === PLATFORMS.LINKEDIN) {
            // LinkedIn: Insert as first child of action bar
            const actionBar = post.querySelector(config.actionBar);
            if (actionBar) {
                btn.style.marginRight = '8px';
                actionBar.insertBefore(btn, actionBar.firstChild);
            }
        }
    });
}

function createSmacButton(platform = PLATFORMS.X) {
    const btn = document.createElement('button');
    btn.className = 'smac-btn';

    // Icon + Text
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        <span>SMAC It</span>
    `;

    if (platform === PLATFORMS.X) {
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

    } else if (platform === PLATFORMS.LINKEDIN) {
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            color: #8B5CF6; /* SMAC Purple */
            border: 1.5px solid #8B5CF6;
            padding: 6px 12px; /* Smaller padding */
            border-radius: 16px; /* Less rounded than X */
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px; /* Slightly larger native text */
            font-weight: 600;
            cursor: pointer;
            margin-right: 8px; /* Spacing */
            transition: all 0.2s ease;
            height: 32px; /* Match native button height roughly */
            box-sizing: border-box;
        `;

        // Update icon size/color for LinkedIn
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.style.marginRight = '6px';
        }

        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = 'rgba(139, 92, 246, 0.1)'; // Light purple background
            btn.style.borderColor = '#7C3AED';
            btn.style.color = '#7C3AED';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = 'transparent';
            btn.style.borderColor = '#8B5CF6';
            btn.style.color = '#8B5CF6';
        });
    }

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
        throw new Error(response.error);
    }

    return null;
}

// --- Toast Notification System ---
function injectToastContainer() {
    if (document.getElementById('smac-toast-container')) return;

    const container = document.createElement('div');
    container.id = 'smac-toast-container';
    container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
    `;
    document.body.appendChild(container);

    // Inject styles for toast animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes smac-slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes smac-fade-out {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('smac-toast-container');
    if (!container) return;

    const toast = document.createElement('div');

    let bg = '#1e293b';
    let icon = 'ℹ️';

    if (type === 'success') { bg = '#10B981'; icon = '✅'; }
    if (type === 'error') { bg = '#EF4444'; icon = '❌'; }
    if (type === 'warning') { bg = '#F59E0B'; icon = '⚠️'; }

    toast.style.cssText = `
        background: ${bg};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: smac-slide-in 0.3s ease-out;
        pointer-events: auto;
        min-width: 250px;
    `;

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'smac-fade-out 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
