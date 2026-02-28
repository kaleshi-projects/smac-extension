import { PLATFORMS, MESSAGING_SELECTORS, queryWithFallbacks, queryAllWithFallbacks } from '../utils/dom';

function scrapeLinkedInMessages() {
    const sel = MESSAGING_SELECTORS[PLATFORMS.LINKEDIN];

    // Find message entries with fallbacks
    const entries = queryAllWithFallbacks(sel.messageEntries);
    const messages = [];

    const recent = Array.from(entries).slice(-10);

    recent.forEach(entry => {
        const textEl = queryWithFallbacks(sel.messageTexts, entry);
        const senderEl = entry.closest('.msg-s-message-group')?.querySelector(
            queryAllWithFallbacks(sel.messageSenders).length > 0 ? sel.messageSenders[0] : '.msg-s-message-group__name'
        ) || queryWithFallbacks(sel.messageSenders, entry.parentElement || entry);

        if (textEl && textEl.innerText?.trim()) {
            messages.push({
                sender: senderEl?.innerText?.trim() || 'Other',
                text: textEl.innerText.trim()
            });
        }
    });

    return messages;
}

function scrapeXMessages() {
    const sel = MESSAGING_SELECTORS[PLATFORMS.X];
    const container = document.querySelector(sel.messageContainer);
    if (!container) return [];

    const entries = container.querySelectorAll(sel.messageEntry);
    const messages = [];

    const recent = Array.from(entries).slice(-10);

    recent.forEach(entry => {
        const textEl = entry.querySelector(sel.messageText) || entry.querySelector('span');
        if (textEl && textEl.innerText?.trim()) {
            messages.push({
                sender: 'Unknown',
                text: textEl.innerText.trim()
            });
        }
    });

    return messages;
}

function scrapeMessages(platform) {
    if (platform === PLATFORMS.LINKEDIN) return scrapeLinkedInMessages();
    if (platform === PLATFORMS.X) return scrapeXMessages();
    return [];
}

// Find LinkedIn messaging input areas using multiple fallback strategies
function findLinkedInInputAreas() {
    const sel = MESSAGING_SELECTORS[PLATFORMS.LINKEDIN];

    // Try each input area selector
    for (const selector of sel.inputAreas) {
        try {
            const areas = document.querySelectorAll(selector);
            if (areas.length > 0) {
                console.log('SMAC: Found LinkedIn input via:', selector);
                return areas;
            }
        } catch (e) {}
    }

    return [];
}

// Find the best container for the input area
function findLinkedInInputContainer(inputArea) {
    const sel = MESSAGING_SELECTORS[PLATFORMS.LINKEDIN];

    // Try explicit container selectors going upward from input
    for (const containerSel of sel.inputContainers) {
        try {
            const container = inputArea.closest(containerSel);
            if (container) return container;
        } catch (e) {}
    }

    // Fallback: walk up until we find a form-like container
    let el = inputArea.parentElement;
    for (let i = 0; i < 5 && el; i++) {
        const tag = el.tagName?.toLowerCase();
        const cls = el.className || '';
        if (tag === 'form' || cls.includes('msg-form') || cls.includes('msg-compose') ||
            cls.includes('msg-overlay') || el.querySelector('button[type="submit"], button[aria-label*="Send" i]')) {
            return el;
        }
        el = el.parentElement;
    }

    return inputArea.parentElement;
}

// Find toolbar area for button placement
function findLinkedInToolbar(container) {
    const sel = MESSAGING_SELECTORS[PLATFORMS.LINKEDIN];

    for (const toolbarSel of sel.toolbarAreas) {
        try {
            const toolbar = container.querySelector(toolbarSel);
            if (toolbar) return toolbar;
        } catch (e) {}
    }

    return null;
}

export function injectMessagingButton(platform, showToast) {
    const sel = MESSAGING_SELECTORS[platform];
    if (!sel) return;

    let inputAreas;
    if (platform === PLATFORMS.LINKEDIN) {
        inputAreas = findLinkedInInputAreas();
    } else {
        inputAreas = document.querySelectorAll(sel.inputArea);
    }

    if (!inputAreas || inputAreas.length === 0) return;

    Array.from(inputAreas).forEach(inputArea => {
        let container;
        if (platform === PLATFORMS.LINKEDIN) {
            container = findLinkedInInputContainer(inputArea);
        } else {
            container = inputArea.closest(sel.inputContainer) || inputArea.parentElement;
        }
        if (!container) return;

        if (container.querySelector('.smac-thinking-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'smac-thinking-btn';
        btn.title = 'SMAC: Generate smart reply';
        btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 17.469V18a2 2 0 0 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
        `;

        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%);
            color: white;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s ease;
            margin: 4px;
            padding: 0;
            flex-shrink: 0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            z-index: 9999;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.filter = 'brightness(1.15)';
            btn.style.transform = 'scale(1.08)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.filter = 'brightness(1)';
            btn.style.transform = 'scale(1)';
        });

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span style="font-size:14px; animation: pulse 1s infinite">⏳</span>';
            btn.disabled = true;
            showToast('⏳ Analyzing conversation...', 'info');

            try {
                const messages = scrapeMessages(platform);

                if (messages.length === 0) {
                    showToast('⚠️ No messages found in conversation.', 'warning');
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
                    action: 'ANALYZE_CONVERSATION',
                    messages
                });

                if (response?.success && response.reply) {
                    await navigator.clipboard.writeText(response.reply);
                    showToast('✅ Reply copied to clipboard!', 'success');
                } else if (response?.error) {
                    throw new Error(response.error);
                } else {
                    showToast('⚠️ Could not generate a reply.', 'warning');
                }
            } catch (err) {
                console.error('SMAC Messaging Error:', err);
                showToast(`❌ Error: ${err.message || 'Unknown error'}`, 'error');
            } finally {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        });

        // Place the button
        if (platform === PLATFORMS.LINKEDIN) {
            const toolbar = findLinkedInToolbar(container);
            if (toolbar) {
                toolbar.appendChild(btn);
            } else {
                // Place before the input area
                inputArea.parentElement?.insertBefore(btn, inputArea);
            }
        } else if (platform === PLATFORMS.X) {
            const toolbarArea = document.querySelector(sel.toolbarArea);
            if (toolbarArea) {
                toolbarArea.appendChild(btn);
            } else {
                inputArea.parentElement?.insertBefore(btn, inputArea);
            }
        }
    });
}
