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
            header: '[data-testid="UserProfileHeader_Items"]',
            userName: '[data-testid="UserName"]',
            bio: '[data-testid="UserDescription"]',
            tweets: 'article[data-testid="tweet"] [data-testid="tweetText"]'
        },
        message: {
            container: '[data-testid="messageEntry"]',
            text: '[data-testid="messageEntry"] div[dir="auto"]'
        }
    },
    [PLATFORMS.LINKEDIN]: {
        feedPost: [
            '[data-id^="urn:li:activity"]',
            '[data-urn^="urn:li:activity"]',
            '.feed-shared-update-v2',
            '.occludable-update',
        ],
        postText: [
            '.feed-shared-update-v2__description',
            '.feed-shared-text',
            '[data-test-id="main-feed-activity-card__commentary"]',
            '.update-components-text',
        ],
        postAuthor: [
            '.update-components-actor__title span[aria-hidden="true"]',
            '.feed-shared-actor__name',
            '.update-components-actor__name',
        ],
        postImage: ['.feed-shared-image img', '.update-components-image img'],
        buttonAnchor: [
            '.social-details-social-activity', 
            '.feed-shared-social-action-bar', 
            '.feed-shared-social-actions', 
            '.feed-shared-control-bar'
        ],
        profile: {
            name: '.text-heading-xlarge',
            headline: '.text-body-medium.break-words',
            about: '#about ~ .pvs-list__outer-container, .pv-about-section',
            featured: '#featured ~ .pvs-list__outer-container, .pv-featured-section',
            experience: '#experience ~ .pvs-list__outer-container li',
            posts: '.profile-creator-shared-feed-update__container .update-components-text'
        },
        message: {
            container: '.msg-s-message-list__event, .msg-s-event-listitem',
            text: '.msg-s-event-listitem__body, .msg-s-event-listitem__message-bubble, .msg-s-message-group__body'
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
