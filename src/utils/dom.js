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
            await new Promise(r => setTimeout(r, 1500));

            const composeArea = document.querySelector('[data-testid="tweetTextarea_0"]');
            if (composeArea) {
                return composeArea;
            }

            const modal = document.querySelector('[aria-modal="true"]');
            if (modal) {
                const editable = modal.querySelector('[contenteditable="true"]');
                if (editable) return editable;
            }
        }
    }
    return null;
}

export async function simulateTyping(element, text) {
    if (!element) return;

    // Find the actual contenteditable element
    let editableEl = element;
    if (element.getAttribute('contenteditable') !== 'true') {
        editableEl = element.closest('[contenteditable="true"]') || element;
    }

    // Phase 1: Focus and key interaction simulation
    editableEl.focus();
    editableEl.click();
    await new Promise(r => setTimeout(r, 100));

    // Phase 2: Visual update using execCommand
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editableEl);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);

    document.execCommand('insertText', false, text);

    // Give the visual update a moment to settle
    await new Promise(r => setTimeout(r, 100));

    // Phase 3: MAIN WORLD INJECTION to trigger React state
    // This code runs inside the page context via src injection (CSP compliant)
    console.log('SMAC: Starting Main World injection via src file');

    // Pass data via DOM attribute
    document.body.setAttribute('data-smac-text', text);

    // Create script tag pointing to our web accessible resource
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/utils/injected.js');

    // Setup cleanup listener
    script.onload = function () {
        console.log('SMAC: Injected script loaded');
        this.remove();
    };

    (document.head || document.documentElement).appendChild(script);

    // Wait slightly for injection to execute
    await new Promise(r => setTimeout(r, 200));

    // Final cleanup: set cursor to end and blur/focus
    editableEl.blur();
    await new Promise(r => setTimeout(r, 50));
    editableEl.focus();

    // Set cursor to end
    const endRange = document.createRange();
    endRange.selectNodeContents(editableEl);
    endRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(endRange);

    console.log('SMAC: Advanced typing simulation complete');
}
