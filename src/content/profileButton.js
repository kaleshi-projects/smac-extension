import { PLATFORMS, PROFILE_SELECTORS, queryWithFallbacks, queryAllWithFallbacks } from '../utils/dom';

function scrapeLinkedInProfile() {
    const sel = PROFILE_SELECTORS[PLATFORMS.LINKEDIN];
    const data = {};

    const nameEl = queryWithFallbacks(sel.name);
    data.name = nameEl?.innerText?.trim() || '';

    const headlineEl = queryWithFallbacks(sel.headline);
    data.headline = headlineEl?.innerText?.trim() || '';

    const locationEl = queryWithFallbacks(sel.location);
    data.location = locationEl?.innerText?.trim() || '';

    const aboutEl = queryWithFallbacks(sel.about);
    data.about = aboutEl?.innerText?.trim() || '';

    const expEntries = queryAllWithFallbacks(sel.experience);
    data.experience = Array.from(expEntries).slice(0, 5).map(el => el.innerText?.trim()).filter(Boolean);

    const eduEntries = queryAllWithFallbacks(sel.education);
    data.education = Array.from(eduEntries).slice(0, 3).map(el => el.innerText?.trim()).filter(Boolean);

    const skillEntries = queryAllWithFallbacks(sel.skills);
    data.skills = Array.from(skillEntries).slice(0, 10).map(el => el.innerText?.trim()).filter(Boolean);

    // Featured section
    const featuredEl = queryWithFallbacks(sel.featured);
    if (featuredEl) {
        const featuredImages = featuredEl.querySelectorAll('img');
        data.featured = Array.from(featuredImages).slice(0, 5).map(img => img.alt || img.title || '').filter(Boolean);
        const featuredText = featuredEl.querySelectorAll('span.visually-hidden, span[aria-hidden="true"]');
        const texts = Array.from(featuredText).map(el => el.innerText?.trim()).filter(Boolean);
        if (texts.length) data.featuredTexts = texts.slice(0, 5);
    }

    // Activity section
    const activityEl = queryWithFallbacks(sel.activity);
    if (activityEl) {
        const activityTexts = activityEl.querySelectorAll('span[aria-hidden="true"]');
        data.activity = Array.from(activityTexts).slice(0, 5).map(el => el.innerText?.trim()).filter(Boolean);
    }

    data.profileUrl = window.location.href;

    return data;
}

function scrapeXProfile() {
    const sel = PROFILE_SELECTORS[PLATFORMS.X];
    const data = {};

    const nameEl = document.querySelector(sel.name);
    data.name = nameEl?.innerText?.trim() || '';

    const bioEl = document.querySelector(sel.bio);
    data.bio = bioEl?.innerText?.trim() || '';

    const locationEl = document.querySelector(sel.location);
    data.location = locationEl?.innerText?.trim() || '';

    const urlEl = document.querySelector(sel.url);
    data.url = urlEl?.href || urlEl?.innerText?.trim() || '';

    const joinDateEl = document.querySelector(sel.joinDate);
    data.joinDate = joinDateEl?.innerText?.trim() || '';

    const followersEl = document.querySelector(sel.followersCount);
    data.followers = followersEl?.innerText?.trim() || '';

    const followingEl = document.querySelector(sel.followingCount);
    data.following = followingEl?.innerText?.trim() || '';

    // Grab pinned/recent tweet if visible
    const pinnedTweet = document.querySelector('article[data-testid="tweet"] [data-testid="tweetText"]');
    data.pinnedTweet = pinnedTweet?.innerText?.trim() || '';

    data.profileUrl = window.location.href;

    return data;
}

function scrapeProfile(platform) {
    if (platform === PLATFORMS.LINKEDIN) return scrapeLinkedInProfile();
    if (platform === PLATFORMS.X) return scrapeXProfile();
    return {};
}

// Find the best anchor point for the LinkedIn profile button
function findLinkedInProfileAnchor() {
    const sel = PROFILE_SELECTORS[PLATFORMS.LINKEDIN];

    // Strategy 1: Try explicit selectors
    for (const selector of sel.buttonAnchors) {
        try {
            const el = document.querySelector(selector);
            if (el) {
                console.log('SMAC: Found LinkedIn anchor via selector:', selector);
                return el;
            }
        } catch (e) {}
    }

    // Strategy 2: Find the container of Connect/Message/Follow buttons by text content
    const allButtons = document.querySelectorAll('main button, .scaffold-layout__main button');
    for (const btn of allButtons) {
        const text = btn.innerText?.trim().toLowerCase() || '';
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (text === 'connect' || text === 'message' || text === 'follow' ||
            ariaLabel.includes('connect') || ariaLabel.includes('invite') || ariaLabel.includes('message')) {
            // Found a profile action button, use its parent container
            const parent = btn.parentElement;
            if (parent) {
                console.log('SMAC: Found LinkedIn anchor via button text:', text || ariaLabel);
                return parent;
            }
        }
    }

    // Strategy 3: Find the first section/card in main content that contains a h1
    const nameEl = queryWithFallbacks(sel.name);
    if (nameEl) {
        // Walk up to find a suitable container - the actions are usually siblings of the name's container
        let container = nameEl.parentElement;
        for (let i = 0; i < 6 && container; i++) {
            // Look for a div that contains buttons (the actions area)
            const buttons = container.querySelectorAll('button');
            if (buttons.length >= 2) {
                console.log('SMAC: Found LinkedIn anchor via name proximity');
                return container;
            }
            container = container.parentElement;
        }
    }

    console.log('SMAC: Could not find LinkedIn profile anchor');
    return null;
}

export function injectProfileButton(platform, showToast) {
    if (document.querySelector('.smac-profile-btn')) return;

    const sel = PROFILE_SELECTORS[platform];
    if (!sel) return;

    let anchor;
    if (platform === PLATFORMS.LINKEDIN) {
        anchor = findLinkedInProfileAnchor();
    } else {
        anchor = document.querySelector(sel.buttonAnchor);
    }

    if (!anchor) return;

    const btn = document.createElement('button');
    btn.className = 'smac-profile-btn';
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Start Conversation</span>
    `;

    if (platform === PLATFORMS.LINKEDIN) {
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 16px;
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-left: 8px;
            transition: all 0.2s ease;
            height: 32px;
            box-sizing: border-box;
        `;
    } else if (platform === PLATFORMS.X) {
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 99px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            margin-left: 12px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        `;
    }

    btn.addEventListener('mouseenter', () => {
        btn.style.filter = 'brightness(1.1)';
        btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.filter = 'brightness(1)';
        btn.style.transform = 'translateY(0)';
    });

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span style="animation: pulse 1s infinite">⏳</span> Analyzing...';
        btn.disabled = true;
        showToast('⏳ Analyzing profile...', 'info');

        try {
            const profileData = scrapeProfile(platform);

            if (!profileData.name && !profileData.bio && !profileData.headline) {
                showToast('⚠️ Could not read profile data. Try scrolling down first.', 'warning');
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                return;
            }

            if (!chrome.runtime?.id) {
                showToast('❌ Extension context lost. Reload the page.', 'error');
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                return;
            }

            const response = await chrome.runtime.sendMessage({
                action: 'ANALYZE_PROFILE',
                profileData
            });

            if (response?.success && response.message) {
                await navigator.clipboard.writeText(response.message);
                showToast('✅ Conversation starter copied to clipboard!', 'success');
            } else if (response?.error) {
                throw new Error(response.error);
            } else {
                showToast('⚠️ Could not generate a message.', 'warning');
            }
        } catch (err) {
            console.error('SMAC Profile Error:', err);
            showToast(`❌ Error: ${err.message || 'Unknown error'}`, 'error');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    });

    if (platform === PLATFORMS.LINKEDIN) {
        anchor.appendChild(btn);
    } else if (platform === PLATFORMS.X) {
        anchor.parentElement?.appendChild(btn);
    }
}
