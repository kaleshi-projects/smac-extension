// DOM Utility functions for SMAC Extension (Multi-Platform)

export const PLATFORMS = {
    X: 'x',
    LINKEDIN: 'linkedin',
};

export const MODES = {
    POST: 'post',
    PROFILE: 'profile',
    MESSAGE: 'message',
};

const X_RESERVED_PATHS = new Set([
    'explore',
    'home',
    'i',
    'intent',
    'login',
    'messages',
    'notifications',
    'search',
    'settings',
    'signup',
]);

export const SELECTORS = {
    [PLATFORMS.X]: {
        feedPost: ['article[data-testid="tweet"]'],
        postText: ['[data-testid="tweetText"]'],
        postAuthor: ['[data-testid="User-Name"] span'],
        postImage: ['[data-testid="tweetPhoto"] img'],
        buttonAnchor: ['[role="group"]'],
        profile: {
            header: ['[data-testid="UserProfileHeader_Items"]'],
            userName: ['[data-testid="UserName"]'],
            bio: ['[data-testid="UserDescription"]'],
            tweets: ['article[data-testid="tweet"] [data-testid="tweetText"]']
        },
        message: {
            container: '[data-testid="messageEntry"]',
            text: '[data-testid="messageEntry"] div[dir="auto"]',
            recipientName: [
                'header [data-testid="UserName"]',
                '[data-testid="conversation"] [data-testid="UserName"]',
                '[data-testid="DMDrawer"] [data-testid="UserName"]'
            ],
            recipientMeta: [
                'header [data-testid="UserDescription"]',
                '[data-testid="conversation"] [dir="ltr"]',
                '[data-testid="DMDrawer"] [dir="ltr"]'
            ]
        }
    },
    [PLATFORMS.LINKEDIN]: {
        feedPost: [
            '.fie-impression-container',            
            '[data-finite-scroll-hotspot]',
            '[data-id^="urn:li:activity"]',
            '[data-urn^="urn:li:activity"]',
            '.feed-shared-update-v2',
            '.occludable-update',
        ],
        postText: [
            '.update-components-text__text-view',
            '.feed-shared-update-v2__description',
            '.update-components-text',
            '.feed-shared-text',
            '[data-test-id="main-feed-activity-card__commentary"]',
        ],
        postAuthor: [
            '.update-components-actor__title span[aria-hidden="true"]',
            '.feed-shared-actor__name',
            '.update-components-actor__name',
        ],
        postImage: ['.feed-shared-image img', '.update-components-image img'],
        buttonAnchor: [
            '.update-v2-social-activity',
            '.social-details-social-activity',
            '.feed-shared-social-action-bar',
            '.feed-shared-footer',
        ],
        profile: {
            name: [
                '.text-heading-xlarge',
                'h1'
            ],
            headline: [
                '.text-body-medium.break-words',
                '.pv-text-details__left-panel .text-body-medium'
            ],
            location: [
                '[data-generated-suggestion-target] span[aria-hidden="true"]',
                '.pv-text-details__left-panel .text-body-small'
            ],
            about: [
                '#about ~ .pvs-list__outer-container .inline-show-more-text span[aria-hidden="true"]',
                '#about ~ .pvs-list__outer-container',
                '.pv-about-section'
            ],
            featured: [
                '#featured ~ .pvs-list__outer-container',
                '.pv-featured-section'
            ],
            experience: [
                '#experience ~ .pvs-list__outer-container li',
                '.pvs-list__outer-container li .mr1 span[aria-hidden="true"]'
            ],
            posts: [
                '.profile-creator-shared-feed-update__container .update-components-text',
                '.profile-creator-shared-feed-update__container',
                '.feed-shared-update-v2__content-wrapper'
            ],
        },
        message: {
            container: '.msg-s-message-list__event, .msg-s-event-listitem',
            text: '.msg-s-event-listitem__body, .msg-s-event-listitem__message-bubble, .msg-s-message-group__body',
            recipientName: [
                '.msg-thread__link-to-profile .hoverable-link-text',
                '.msg-thread__link-to-profile',
                '.msg-thread__topic-name',
                '.artdeco-entity-lockup__title span[aria-hidden="true"]'
            ],
            recipientMeta: [
                '.msg-thread__topic-subtext',
                '.artdeco-entity-lockup__subtitle span[aria-hidden="true"]',
                '.msg-thread__link-to-profile + div'
            ]
        }
    }
};

// Detect current platform from hostname
export function detectPlatform() {
    return detectPlatformFromHostname(window.location.hostname);
}

export function detectPlatformFromHostname(hostname) {
    if (hostname.includes('twitter.com') || hostname === 'x.com' || hostname.endsWith('.x.com')) {
        return PLATFORMS.X;
    }
    if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) {
        return PLATFORMS.LINKEDIN;
    }
    return null;
}

export function detectModeFromUrl(rawUrl, providedPlatform = null) {
    if (!rawUrl) return null;

    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return null;
    }

    const platform = providedPlatform || detectPlatformFromHostname(parsed.hostname);
    if (!platform) return null;

    const path = parsed.pathname || '/';
    const segments = path.split('/').filter(Boolean);
    const firstSegment = segments[0] || '';

    if (platform === PLATFORMS.LINKEDIN) {
        if (path.startsWith('/messaging')) return MODES.MESSAGE;
        if (path.startsWith('/in/')) return MODES.PROFILE;
        if (path.startsWith('/feed') || path.startsWith('/posts/') || path.startsWith('/feed/update/')) {
            return MODES.POST;
        }
        return null;
    }

    if (path.startsWith('/messages')) return MODES.MESSAGE;
    if (
        path.startsWith('/home') ||
        path.startsWith('/explore') ||
        path.startsWith('/search') ||
        path.includes('/status/')
    ) {
        return MODES.POST;
    }
    if (segments.length === 1 && firstSegment && !X_RESERVED_PATHS.has(firstSegment)) {
        return MODES.PROFILE;
    }

    return null;
}
