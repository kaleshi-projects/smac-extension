// DOM Utility functions for SMAC Extension (X.com Only)

export const PLATFORMS = {
    X: 'x',
};

export const SELECTORS = {
    [PLATFORMS.X]: {
        post: '[data-testid="tweet"]',
        text: '[data-testid="tweetText"]',
        image: '[data-testid="tweetPhoto"] img',
        input: '[data-testid="tweetTextarea_0"]',
        replyButton: '[data-testid="reply"]',
    }
};

export async function findAndFocusInput(post, platform) {
    if (platform === PLATFORMS.X) {
        const replyBtn = post.querySelector('[data-testid="reply"]');
        if (replyBtn) {
            replyBtn.click();
            await new Promise(r => setTimeout(r, 1000));
            return document.querySelector('[data-testid="tweetTextarea_0"]');
        }
    }
    return null;
}

export function simulateTyping(element, text) {
    element.focus();

    if (element.getAttribute('contenteditable') === 'true') {
        element.innerText = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        const setter = element.tagName === 'INPUT' ? nativeInputValueSetter : nativeTextAreaValueSetter;
        setter.call(element, text);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        element.innerText = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
