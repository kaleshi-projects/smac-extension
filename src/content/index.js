import { MODES, PLATFORMS, SELECTORS, detectModeFromUrl, detectPlatform } from '../utils/dom.js';
import { handlePostClick } from './modes/post.js';
import { handleProfileClick } from './modes/profile.js';
import { handleMessageClick } from './modes/message.js';

// State
let isActive = false;
let currentPlatform = null;
let currentMode = null;

// Guard: returns false if the extension context was invalidated (tab open during reload)
function isChromeContextValid() {
    try {
        return !!chrome?.runtime?.id;
    } catch (e) {
        return false;
    }
}

// Initialize
(async () => {
    currentPlatform = detectPlatform();
    if (!currentPlatform) return;
    if (!isChromeContextValid()) return;

    await loadSettings();
    injectToastContainer();

    // CRITICAL: detectMode MUST run before startObserver so currentMode is set
    detectMode();

    if (isActive) {
        startObserver();
        setTimeout(logSelectorHealth, 3000);
        // Poll every 1.5s for 30s — LinkedIn lazy-loads posts long after DOM ready
        let pollCount = 0;
        const pollId = setInterval(() => {
            if (!isActive || ++pollCount > 20) { clearInterval(pollId); return; }
            injectButtons();
        }, 1500);
    }

    // Watch for SPA URL changes
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            onUrlChange();
        }
    }).observe(document, { subtree: true, childList: true });
})();

async function loadSettings() {
    if (!isChromeContextValid()) return;
    const result = await chrome.storage.local.get(['isActive']);
    isActive = !!result.isActive;

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (!isChromeContextValid()) return;
        if (namespace === 'local' && changes.isActive) {
            isActive = changes.isActive.newValue;
            if (isActive && currentPlatform) {
                detectMode();
                startObserver();
            } else {
                stopObserver();
                removeButtons();
            }
        }
    });
}

function detectMode() {
    currentMode = detectModeFromUrl(window.location.href, currentPlatform);
}

function onUrlChange() {
    if (!isActive) return;
    detectMode();
    stopObserver();
    removeButtons();
    if (!currentMode) return;
    startObserver();
    // Inject immediately after mode switch, then retry for slow renders
    injectButtons();
    setTimeout(() => { if (isActive) injectButtons(); }, 1500);
}

function removeButtons() {
    document.querySelectorAll('.smac-btn').forEach(b => b.remove());
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

let observerInstance = null;
function startObserver() {
    if (!isActive || !currentPlatform || !currentMode) return;

    injectButtons();

    const debouncedInject = debounce(() => {
        if (!isActive) return;
        injectButtons();
    }, 500);

    stopObserver();
    
    observerInstance = new MutationObserver((mutations) => {
        if (!isActive) return;
        if (mutations.some(m => m.addedNodes.length > 0)) {
            debouncedInject();
        }
    });

    observerInstance.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
    if (observerInstance) {
        observerInstance.disconnect();
        observerInstance = null;
    }
}

function updateFloatingButton() {
    const existing = document.getElementById('smac-floating-btn');
    if (existing) existing.remove();

    if (currentMode === MODES.POST || !currentMode) return;

    const btn = document.createElement('button');
    btn.id = 'smac-floating-btn';
    btn.className = 'smac-btn smac-injected';
    
    const text = currentMode === MODES.PROFILE ? 'SMAC Profile' : 'SMAC Reply';
    
    btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-right: 6px;">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span>${text}</span>
    `;
    
    btn.style.cssText = `
        position: fixed; top: 72px; right: 16px; z-index: 2147483640;
        background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%);
        color: white; border: none; padding: 8px 16px; border-radius: 99px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px; font-weight: 600; cursor: pointer;
        box-shadow: 0 4px 12px rgba(139,92,246,0.4);
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    `;
    btn.onmouseenter = () => { btn.style.transform = 'translateY(-1px)'; btn.style.boxShadow = '0 6px 16px rgba(139,92,246,0.55)'; };
    btn.onmouseleave = () => { btn.style.transform = ''; btn.style.boxShadow = '0 4px 12px rgba(139,92,246,0.4)'; };

    if (currentMode === MODES.PROFILE) {
        handleBtnClick(btn, () => handleProfileClick(currentPlatform));
    } else if (currentMode === MODES.MESSAGE) {
        handleBtnClick(btn, () => handleMessageClick(currentPlatform));
    }

    document.body.appendChild(btn);
}

const _pushState = history.pushState.bind(history);
history.pushState = (...args) => {
    _pushState(...args);
    setTimeout(() => { if (isActive) onUrlChange(); }, 500);
};
window.addEventListener('popstate', () => setTimeout(() => { if (isActive) onUrlChange(); }, 500));

function injectButtons() {
    if (!isActive || !currentPlatform || !currentMode) return;
    if (!chrome.runtime?.id) return;

    if (currentMode === MODES.POST) {
        injectPostButtons();
    }
    updateFloatingButton();
}

function logSelectorHealth() {
    if (!currentPlatform || currentMode !== 'post') return;
    const s = SELECTORS[currentPlatform];
    const postMatches = [];

    for (const selector of s.feedPost || []) {
        const count = countSelectorMatches(selector);
        if (count > 0) {
            console.log(`[SMAC] Post selector working: ${selector} (${count})`);
            postMatches.push(selector);
        }
    }

    const anchorCount = countSelectors(s.buttonAnchor || []);
    if (postMatches.length === 0 && anchorCount === 0) {
        console.warn('[SMAC] No post or anchor selector matched. LinkedIn DOM may have changed.');
        showToast('⚠️ SMAC: Post buttons unavailable — LinkedIn updated their layout.', 'error');
    }
}

function createSmacButton(platform, isFloating = false) {
    const btn = document.createElement('button');
    btn.className = 'smac-btn smac-injected';
    btn.type = 'button';
    // Use inline SVG only — no network requests, no chrome-extension:// URL fetches
    btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;flex-shrink:0">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span>SMAC It</span>
    `;

    if (platform === PLATFORMS.X || isFloating) {
        btn.style.cssText = `
            background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%);
            color: white; border: none; padding: 6px 14px; border-radius: 99px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px; font-weight: 600; cursor: pointer; z-index: 9999;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: flex; align-items: center;
        `;
    } else {
        btn.style.cssText = `
            display: inline-flex; align-items: center; justify-content: center;
            background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%);
            color: white; border: none; box-shadow: 0 8px 18px rgba(139,92,246,0.28);
            padding: 7px 14px; border-radius: 999px; font-family: -apple-system, sans-serif;
            font-size: 13px; font-weight: 700; cursor: pointer; height: 34px;
            white-space: nowrap;
        `;
    }

    if (isFloating) {
        btn.style.position = 'absolute';
    }

    return btn;
}

function handleBtnClick(btn, handlerFn) {
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isChromeContextValid()) {
            showToast('⚠️ Extension was reloaded. Please refresh this tab.', 'error');
            return;
        }

        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<span style="animation: pulse 1s infinite">⏳</span>`;
        btn.disabled = true;

        showToast('⏳ Generating...', 'info');

        try {
            const comment = await handlerFn();
            if (comment) {
                await navigator.clipboard.writeText(comment);
                btn.innerHTML = originalHTML;
                showToast('✅ Copied to clipboard!', 'success');
            } else {
                btn.innerHTML = originalHTML;
            }
        } catch (err) {
            btn.innerHTML = originalHTML;
            if (err.type === 'CORS') {
                showToast(`❌ ${err.message}`, 'error');
            } else {
                showToast(`❌ Error: ${err.message}`, 'error');
            }
        } finally {
            btn.disabled = false;
        }
    });
}


function findElement(selectors, parent = document) {
    for (const selector of selectors) {
        const el = parent.querySelector(selector);
        if (el) return el;
    }
    return null;
}

const processedPosts = new WeakSet();

function injectPostButtons() {
  const s = SELECTORS[currentPlatform];
  if (!s || !s.feedPost) return;

  let posts = [];
  for (const selector of s.feedPost) {
    const found = Array.from(document.querySelectorAll(selector));
    if (found.length > 0) { posts = found; break; }
  }

  if (posts.length === 0) {
    if (!window._smacNoPostWarned) {
      window._smacNoPostWarned = true;
      showToast('SMAC: No posts found — update wrapper selectors', 'error');
    }
    return;
  }

  posts.forEach(post => {
    if (processedPosts.has(post)) return;
    processedPosts.add(post);

    let anchor = null;
    for (const sel of s.buttonAnchor) {
      anchor = post.querySelector(sel);
      if (anchor) break;
    }

    const btn = createSmacButton(currentPlatform);
    handleBtnClick(btn, () => handlePostClick(post, currentPlatform));

    if (anchor) {
      anchor.appendChild(btn);
    } else {
      // Fallback: Force button into the top-right of the main post wrapper
      post.style.position = 'relative';
      btn.style.cssText += ';position:absolute;top:12px;right:12px;z-index:999;';
      post.appendChild(btn);
    }
  });
}

function resolvePostContainer(node) {
    if (currentPlatform !== PLATFORMS.LINKEDIN) {
        return node;
    }

    return node.closest(
        '.feed-shared-update-v2, .feed-shared-update-v2__content-wrapper, .fie-impression-container, .occludable-update, article, [data-id^="urn:li:activity"], [data-urn^="urn:li:activity"]'
    ) || node;
}

function collectPostCandidates(selectors) {
    const candidates = [];
    const seen = new Set();

    for (const selector of selectors.feedPost || []) {
        try {
            for (const node of document.querySelectorAll(selector)) {
                const post = resolvePostContainer(node);
                if (post && !seen.has(post)) {
                    seen.add(post);
                    candidates.push(post);
                }
            }
        } catch {
            continue;
        }
    }

    if (candidates.length > 0 || currentPlatform !== PLATFORMS.LINKEDIN) {
        return candidates;
    }

    for (const selector of selectors.buttonAnchor || []) {
        try {
            for (const anchor of document.querySelectorAll(selector)) {
                const post = resolvePostContainer(anchor);
                if (!post || seen.has(post)) {
                    continue;
                }

                seen.add(post);
                candidates.push(post);
            }
        } catch {
            continue;
        }
    }

    return candidates;
}

function countSelectors(selectors) {
    let total = 0;
    for (const selector of selectors) {
        total += countSelectorMatches(selector);
    }
    return total;
}

function countSelectorMatches(selector) {
    try {
        return document.querySelectorAll(selector).length;
    } catch {
        return 0;
    }
}



function injectToastContainer() {
    if (document.getElementById('smac-toast-container')) return;
    const container = document.createElement('div');
    container.id = 'smac-toast-container';
    container.style.cssText = `position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; display: flex; flex-direction: column; gap: 10px; pointer-events: none;`;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes smac-slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes smac-fade-out { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('smac-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    let bg = '#1e293b'; let icon = 'ℹ️';
    if (type === 'success') { bg = '#10B981'; icon = '✅'; }
    if (type === 'error') { bg = '#EF4444'; icon = '❌'; }
    
    toast.style.cssText = `background: ${bg}; color: white; padding: 12px 20px; border-radius: 8px; font-family: -apple-system, sans-serif; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; min-width: 250px; pointer-events: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: smac-slide-in 0.3s ease-out;`;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'smac-fade-out 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
