// DOM Utility functions for SMAC Extension (Multi-Platform)

export const PLATFORMS = {
    X: 'x',
    LINKEDIN: 'linkedin',
};

export const SELECTORS = {
    [PLATFORMS.X]: {
        post: 'article[data-testid="tweet"]',
        text: '[data-testid="tweetText"]',
        image: '[data-testid="tweetPhoto"] img',
        actionBar: '[role="group"]',
    },
    [PLATFORMS.LINKEDIN]: {
        post: '.feed-shared-update-v2',
        text: '.update-components-text span.break-words, .feed-shared-update-v2__description',
        image: '.update-components-image__image, img[src*="media.licdn.com"]',
        actionBar: '.feed-shared-social-action-bar, .feed-shared-control-bar',
    }
};

export const PROFILE_SELECTORS = {
    [PLATFORMS.X]: {
        urlPattern: /^\/[A-Za-z0-9_]{1,15}\/?$/,
        excludePatterns: ['/home', '/explore', '/search', '/notifications', '/messages', '/settings', '/i/', '/compose'],
        name: '[data-testid="UserName"]',
        bio: '[data-testid="UserDescription"]',
        location: '[data-testid="UserLocation"]',
        url: '[data-testid="UserUrl"] a',
        joinDate: '[data-testid="UserJoinDate"]',
        followersCount: 'a[href$="/verified_followers"] span, a[href$="/followers"] span',
        followingCount: 'a[href$="/following"] span',
        buttonAnchor: '[data-testid="placementTracking"]',
    },
    [PLATFORMS.LINKEDIN]: {
        urlPattern: /^\/in\/[A-Za-z0-9\-_%]+\/?$/,
        // Multiple fallbacks for each field - LinkedIn changes class names frequently
        name: [
            'h1.text-heading-xlarge',
            'h1[class*="text-heading"]',
            '.pv-top-card .text-heading-xlarge',
            '.ph5 h1',
            'main section:first-child h1',
        ],
        headline: [
            '.text-body-medium.break-words',
            '.pv-top-card .text-body-medium',
            '.ph5 .text-body-medium',
        ],
        location: [
            '.text-body-small.inline.t-black--light.break-words',
            '.pv-top-card .text-body-small.inline',
            '.ph5 .text-body-small span.t-black--light',
        ],
        about: [
            '#about ~ .display-flex .inline-show-more-text',
            '#about + .display-flex .pv-shared-text-with-see-more span[aria-hidden="true"]',
            '#about ~ div span.visually-hidden + span',
            'section:has(#about) .inline-show-more-text',
            'section:has(#about) span[aria-hidden="true"]',
        ],
        experience: [
            '#experience ~ .pvs-list__outer-container .pvs-entity--padded',
            'section:has(#experience) li.artdeco-list__item',
            '#experience ~ div li',
            'section:has(#experience) li',
        ],
        education: [
            '#education ~ .pvs-list__outer-container .pvs-entity--padded',
            'section:has(#education) li.artdeco-list__item',
            '#education ~ div li',
            'section:has(#education) li',
        ],
        skills: [
            '#skills ~ .pvs-list__outer-container .pvs-entity--padded',
            'section:has(#skills) li.artdeco-list__item',
            '#skills ~ div li',
            'section:has(#skills) li',
        ],
        featured: [
            '#featured ~ .pvs-list__outer-container',
            'section:has(#featured) .pvs-list__outer-container',
            'section:has(#featured) ul',
        ],
        activity: [
            '#content_collections ~ .pvs-list__outer-container',
            'section:has(#content_collections) .pvs-list__outer-container',
        ],
        // Multiple fallback anchors for button placement
        buttonAnchors: [
            '.pvs-profile-actions',
            '.pv-top-card-v2-ctas',
            '.pv-top-card .pv-top-card-v2-ctas',
            '.ph5 .pvs-profile-actions',
        ],
    }
};

export const MESSAGING_SELECTORS = {
    [PLATFORMS.X]: {
        urlPattern: /^\/messages\//,
        messageContainer: '[data-testid="DmScrollerContainer"]',
        messageEntry: '[data-testid="messageEntry"]',
        messageText: '[data-testid="tweetText"]',
        messageSender: '[data-testid="User-Name"]',
        inputArea: '[data-testid="dmComposerTextInput"]',
        inputContainer: '[data-testid="DMDrawer"]',
        toolbarArea: '[data-testid="DMDrawer"] [role="toolbar"]',
    },
    [PLATFORMS.LINKEDIN]: {
        urlPattern: /^\/messaging\//,
        overlaySelector: '.msg-overlay-list-bubble, .msg-overlay-conversation-bubble',
        messageContainer: '.msg-s-message-list-container, .msg-convo-wrapper',
        messageEntries: [
            '.msg-s-message-list__event',
            '.msg-s-event-listitem',
            '.msg-convo-wrapper li',
        ],
        messageTexts: [
            '.msg-s-event-listitem__body',
            '.msg-s-event__content',
            '.msg-s-message-body',
        ],
        messageSenders: [
            '.msg-s-message-group__name',
            '.msg-s-message-group__profile-link',
            '.msg-s-event-listitem__link',
        ],
        inputAreas: [
            '.msg-form__contenteditable',
            '.msg-form [contenteditable="true"]',
            '.msg-form [role="textbox"]',
            '.msg-overlay-conversation-bubble [contenteditable="true"]',
            '.msg-convo-wrapper [contenteditable="true"]',
            '[contenteditable="true"][aria-label*="message" i]',
            '[contenteditable="true"][aria-label*="Write" i]',
            'div[role="textbox"][aria-label*="message" i]',
        ],
        inputContainers: [
            '.msg-form__msg-content-container',
            '.msg-form',
            '.msg-form__footer',
            '.msg-overlay-conversation-bubble__content',
        ],
        toolbarAreas: [
            '.msg-form__left-actions',
            '.msg-form__footer',
            '.msg-form',
        ],
    }
};

export const PAGE_TYPES = {
    FEED: 'feed',
    PROFILE: 'profile',
    MESSAGING: 'messaging',
    OTHER: 'other',
};

export function detectPageType(platform) {
    const path = window.location.pathname;
    if (!platform) return PAGE_TYPES.OTHER;

    // Check messaging first (more specific URL)
    const msgSel = MESSAGING_SELECTORS[platform];
    if (msgSel && msgSel.urlPattern.test(path)) {
        return PAGE_TYPES.MESSAGING;
    }

    // Check profile
    const profSel = PROFILE_SELECTORS[platform];
    if (profSel && profSel.urlPattern.test(path)) {
        if (platform === PLATFORMS.X && profSel.excludePatterns.some(p => path.startsWith(p))) {
            return PAGE_TYPES.FEED;
        }
        return PAGE_TYPES.PROFILE;
    }

    return PAGE_TYPES.FEED;
}

// Detect current platform from hostname
export function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('twitter.com') || host.includes('x.com')) {
        return PLATFORMS.X;
    }
    if (host.includes('linkedin.com')) {
        return PLATFORMS.LINKEDIN;
    }
    return null;
}

// Query with fallback selectors - tries each selector until one matches
export function queryWithFallbacks(selectors, parent = document) {
    if (typeof selectors === 'string') {
        return parent.querySelector(selectors);
    }
    if (Array.isArray(selectors)) {
        for (const sel of selectors) {
            try {
                const el = parent.querySelector(sel);
                if (el) return el;
            } catch (e) {
                // Skip invalid selectors
            }
        }
    }
    return null;
}

// QueryAll with fallback selectors - tries each selector until one returns results
export function queryAllWithFallbacks(selectors, parent = document) {
    if (typeof selectors === 'string') {
        return parent.querySelectorAll(selectors);
    }
    if (Array.isArray(selectors)) {
        for (const sel of selectors) {
            try {
                const els = parent.querySelectorAll(sel);
                if (els.length > 0) return els;
            } catch (e) {
                // Skip invalid selectors
            }
        }
    }
    return [];
}
