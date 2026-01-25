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
