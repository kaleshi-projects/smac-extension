import { PLATFORMS, PROFILE_SELECTORS } from '../utils/dom';

// ---- LinkedIn Profile Scraping (class-name independent) ----

function scrapeLinkedInProfile() {
    const data = {};

    // 1. Name — from document.title: "FirstName LastName - Title | LinkedIn"
    //    or from meta og:title
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    const pageTitle = document.title || '';
    if (ogTitle) {
        data.name = ogTitle.split(' - ')[0]?.trim() || ogTitle.split('|')[0]?.trim() || '';
    } else {
        data.name = pageTitle.split(' - ')[0]?.trim() || pageTitle.split('|')[0]?.trim() || '';
    }

    // 2. Headline — from meta description or og:description
    const metaDesc = document.querySelector('meta[name="description"]')?.content ||
                     document.querySelector('meta[property="og:description"]')?.content || '';
    data.headline = metaDesc;

    // 3. Location — find by looking for text near a location icon or in the top card
    //    LinkedIn's top section has location text, try to find it by structural position
    data.location = findTextByProximity(['location', 'city', 'country', 'india', 'states', 'region']);

    // 4. Profile URL
    data.profileUrl = window.location.href;

    // 5. About — find section by heading text "About"
    const aboutSection = findSectionByHeading('About');
    if (aboutSection) {
        data.about = extractSectionText(aboutSection);
    }

    // 6. Experience — find section by heading text "Experience"
    const expSection = findSectionByHeading('Experience');
    if (expSection) {
        const items = expSection.querySelectorAll('li');
        data.experience = Array.from(items).slice(0, 5).map(li => li.innerText?.trim()).filter(t => t.length > 5);
        if (data.experience.length === 0) {
            data.experience = [extractSectionText(expSection)];
        }
    }

    // 7. Education
    const eduSection = findSectionByHeading('Education');
    if (eduSection) {
        const items = eduSection.querySelectorAll('li');
        data.education = Array.from(items).slice(0, 3).map(li => li.innerText?.trim()).filter(t => t.length > 5);
        if (data.education.length === 0) {
            data.education = [extractSectionText(eduSection)];
        }
    }

    // 8. Skills
    const skillsSection = findSectionByHeading('Skills');
    if (skillsSection) {
        const items = skillsSection.querySelectorAll('li');
        data.skills = Array.from(items).slice(0, 10).map(li => li.innerText?.trim()).filter(t => t.length > 2);
        if (data.skills.length === 0) {
            data.skills = [extractSectionText(skillsSection)];
        }
    }

    // 9. Featured
    const featuredSection = findSectionByHeading('Featured');
    if (featuredSection) {
        const images = featuredSection.querySelectorAll('img');
        data.featured = Array.from(images).slice(0, 5).map(img => img.alt || '').filter(Boolean);
        const text = extractSectionText(featuredSection);
        if (text) data.featuredText = text;
    }

    // 10. Activity
    const activitySection = findSectionByHeading('Activity');
    if (activitySection) {
        data.activity = extractSectionText(activitySection);
    }

    // 11. Also scrape visible text from the top card area (first section)
    const firstSection = document.querySelector('main section');
    if (firstSection) {
        const topTexts = [];
        firstSection.querySelectorAll('span, a, div').forEach(el => {
            const text = el.innerText?.trim();
            if (text && text.length > 3 && text.length < 200 && !topTexts.includes(text)) {
                topTexts.push(text);
            }
        });
        // Deduplicate and get unique short strings from the top card
        data.topCardInfo = [...new Set(topTexts)].slice(0, 15).join(' | ');
    }

    return data;
}

// Find a section on the page by its heading text (e.g., "About", "Experience")
function findSectionByHeading(headingText) {
    // Strategy 1: Look through all section elements for one whose heading matches
    const sections = document.querySelectorAll('main section, [role="main"] section');
    for (const section of sections) {
        // Check first few text nodes/headings in the section
        const headings = section.querySelectorAll('h2, h3, [role="heading"]');
        for (const h of headings) {
            const text = h.innerText?.trim();
            if (text && text.toLowerCase().includes(headingText.toLowerCase())) {
                return section;
            }
        }
        // Also check if the section has an anchor/span with id matching
        const anchor = section.querySelector(`#${headingText.toLowerCase()}`);
        if (anchor) return section;
    }

    // Strategy 2: Find a heading anywhere and walk up to section-like container
    const allHeadings = document.querySelectorAll('h2, h3, [role="heading"]');
    for (const h of allHeadings) {
        if (h.innerText?.trim().toLowerCase().includes(headingText.toLowerCase())) {
            // Walk up to find a section or suitable container
            let parent = h.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                if (parent.tagName === 'SECTION' || parent.querySelector('ul, li')) {
                    return parent;
                }
                parent = parent.parentElement;
            }
        }
    }

    // Strategy 3: Text content scan — find any element that says exactly the heading text
    const walker = document.createTreeWalker(
        document.querySelector('main') || document.body,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode: (node) => {
                const directText = Array.from(node.childNodes)
                    .filter(n => n.nodeType === Node.TEXT_NODE)
                    .map(n => n.textContent.trim())
                    .join('');
                if (directText.toLowerCase() === headingText.toLowerCase()) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        }
    );
    const heading = walker.nextNode();
    if (heading) {
        let parent = heading.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
            if (parent.tagName === 'SECTION') return parent;
            parent = parent.parentElement;
        }
    }

    return null;
}

// Extract meaningful text from a section (skip the heading itself)
function extractSectionText(section) {
    const texts = [];
    const children = section.querySelectorAll('span, p, div');
    for (const el of children) {
        const text = el.innerText?.trim();
        if (text && text.length > 10 && text.length < 2000 && !texts.includes(text)) {
            texts.push(text);
        }
    }
    // Return the longest meaningful text (likely the actual content, not labels)
    const sorted = texts.sort((a, b) => b.length - a.length);
    return sorted[0] || '';
}

// Try to find location text by looking near common location patterns
function findTextByProximity(keywords) {
    const main = document.querySelector('main') || document.body;
    const spans = main.querySelectorAll('span, div');
    for (const el of spans) {
        const text = el.innerText?.trim();
        if (!text || text.length > 100 || text.length < 3) continue;
        // Check if nearby sibling or parent has location-like content
        const lower = text.toLowerCase();
        for (const kw of keywords) {
            if (lower.includes(kw)) return text;
        }
    }
    return '';
}

// ---- X/Twitter Profile Scraping ----

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

    const pinnedTweet = document.querySelector('article[data-testid="tweet"] [data-testid="tweetText"]');
    data.pinnedTweet = pinnedTweet?.innerText?.trim() || '';

    data.profileUrl = window.location.href;

    return data;
}

// ---- Entry Points ----

function scrapeProfile(platform) {
    if (platform === PLATFORMS.LINKEDIN) return scrapeLinkedInProfile();
    if (platform === PLATFORMS.X) return scrapeXProfile();
    return {};
}

// Find the best anchor point for the LinkedIn profile button
function findLinkedInProfileAnchor() {
    // Strategy 1: Find the container of Connect/Message/Follow buttons by text content
    const allButtons = document.querySelectorAll('main button, button');
    for (const btn of allButtons) {
        const text = btn.innerText?.trim().toLowerCase() || '';
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (text === 'connect' || text === 'message' || text === 'follow' || text === 'more' ||
            ariaLabel.includes('connect') || ariaLabel.includes('invite') ||
            ariaLabel.includes('message') || ariaLabel.includes('follow')) {
            const parent = btn.parentElement;
            if (parent && parent.querySelectorAll('button').length >= 1) {
                console.log('SMAC: Found LinkedIn anchor via button text:', text || ariaLabel);
                return parent;
            }
        }
    }

    // Strategy 2: Find the first section in main and look for button container
    const firstSection = document.querySelector('main section');
    if (firstSection) {
        const buttons = firstSection.querySelectorAll('button');
        if (buttons.length >= 2) {
            // Find the common parent of the first two buttons
            const btn1 = buttons[0];
            let container = btn1.parentElement;
            for (let i = 0; i < 4 && container; i++) {
                if (container.querySelectorAll('button').length >= 2) {
                    console.log('SMAC: Found LinkedIn anchor via first section buttons');
                    return container;
                }
                container = container.parentElement;
            }
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

            console.log('SMAC: Scraped profile data:', JSON.stringify(profileData).substring(0, 500));

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
