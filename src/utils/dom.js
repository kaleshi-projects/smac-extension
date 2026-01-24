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

    editableEl.focus();

    // Clear existing content
    while (editableEl.firstChild) {
        editableEl.removeChild(editableEl.firstChild);
    }

    // Type character by character with proper React events
    for (const char of text) {
        // Set selection at end
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editableEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        // beforeinput event (React 17+ listens to this)
        const beforeInputEvent = new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: char,
        });
        editableEl.dispatchEvent(beforeInputEvent);

        // Insert character manually
        const textNode = document.createTextNode(char);
        if (editableEl.lastChild && editableEl.lastChild.nodeType === Node.TEXT_NODE) {
            editableEl.lastChild.textContent += char;
        } else {
            editableEl.appendChild(textNode);
        }

        // input event
        const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: false,
            inputType: 'insertText',
            data: char,
        });
        editableEl.dispatchEvent(inputEvent);

        // Small delay
        await new Promise(r => setTimeout(r, 3));
    }

    // Final events to trigger React reconciliation
    editableEl.dispatchEvent(new Event('change', { bubbles: true }));

    // Click inside to ensure focus
    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    editableEl.dispatchEvent(clickEvent);

    // Add a space at the end and delete it (trick to trigger state update)
    await new Promise(r => setTimeout(r, 100));

    const spaceEvent = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: ' ',
    });
    editableEl.dispatchEvent(spaceEvent);
    editableEl.textContent = editableEl.textContent + ' ';
    editableEl.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: ' ',
    }));

    await new Promise(r => setTimeout(r, 50));

    // Delete the space
    const deleteEvent = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContentBackward',
    });
    editableEl.dispatchEvent(deleteEvent);
    editableEl.textContent = editableEl.textContent.slice(0, -1);
    editableEl.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'deleteContentBackward',
    }));

    console.log('SMAC: Typing simulation complete');
}
