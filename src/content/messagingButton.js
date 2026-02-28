import { PLATFORMS, MESSAGING_SELECTORS } from '../utils/dom';

// ---- LinkedIn Message Scraping (class-name independent) ----

function scrapeLinkedInMessages() {
    // Strategy: Find all message-like text in the conversation area
    // Messages are typically in a scrollable list of items
    const messages = [];

    // Find the conversation container — look for a scrollable area with many list items
    const main = document.querySelector('main') || document.body;

    // Strategy 1: Find li elements that look like messages (contain text and timestamps)
    const allLi = main.querySelectorAll('li');
    const messageLis = [];
    for (const li of allLi) {
        const text = li.innerText?.trim();
        // Message items typically have some text content and are not too long (not a full section)
        if (text && text.length > 2 && text.length < 2000) {
            // Check if it looks like a message (has text content, not just a button)
            const hasButtons = li.querySelectorAll('button').length;
            const hasLinks = li.querySelectorAll('a').length;
            // Messages typically don't have many interactive elements
            if (hasButtons <= 2 && hasLinks <= 2) {
                messageLis.push(li);
            }
        }
    }

    // Take last 10
    const recent = messageLis.slice(-10);
    for (const li of recent) {
        const text = li.innerText?.trim();
        if (text) {
            messages.push({
                sender: 'Unknown',
                text: text
            });
        }
    }

    // Strategy 2: If no li items found, look for message-like elements by structure
    if (messages.length === 0) {
        // Try to find contenteditable's sibling container that holds messages
        const contentEditable = document.querySelector('[contenteditable="true"]');
        if (contentEditable) {
            // Walk up to find the conversation container
            let container = contentEditable.parentElement;
            for (let i = 0; i < 10 && container; i++) {
                const items = container.querySelectorAll('div[class], p');
                if (items.length > 5) {
                    // Found a container with multiple items - these might be messages
                    const textBlocks = [];
                    for (const item of items) {
                        const t = item.innerText?.trim();
                        if (t && t.length > 2 && t.length < 1000) {
                            textBlocks.push(t);
                        }
                    }
                    const unique = [...new Set(textBlocks)].slice(-10);
                    for (const t of unique) {
                        messages.push({ sender: 'Unknown', text: t });
                    }
                    if (messages.length > 0) break;
                }
                container = container.parentElement;
            }
        }
    }

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

// ---- Find LinkedIn messaging input (class-name independent) ----

function findLinkedInInputAreas() {
    const found = [];

    // Strategy 1: Any contenteditable in a messaging context
    const allEditable = document.querySelectorAll('[contenteditable="true"], [role="textbox"]');
    for (const el of allEditable) {
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        // Check if it's a messaging input by aria-label
        if (ariaLabel.includes('message') || ariaLabel.includes('write') ||
            ariaLabel.includes('reply') || ariaLabel.includes('chat') ||
            ariaLabel.includes('type')) {
            found.push(el);
            continue;
        }
        // Check if it's inside a messaging-related container (URL-based)
        if (window.location.pathname.startsWith('/messaging/')) {
            found.push(el);
            continue;
        }
        // Check if it's inside an overlay bubble
        const overlay = el.closest('[class*="msg-overlay"], [class*="msg-convo"], [class*="messaging"]');
        if (overlay) {
            found.push(el);
        }
    }

    if (found.length > 0) {
        console.log('SMAC: Found', found.length, 'LinkedIn message inputs');
    }

    return found;
}

function findInputContainer(inputArea) {
    // Walk up to find a form or form-like container
    let el = inputArea.parentElement;
    for (let i = 0; i < 6 && el; i++) {
        const tag = el.tagName?.toLowerCase();
        // Look for a form, or a container with a send button
        if (tag === 'form') return el;
        const sendBtn = el.querySelector('button[type="submit"], button[aria-label*="Send" i], button[aria-label*="send" i]');
        if (sendBtn) return el;
        el = el.parentElement;
    }
    return inputArea.parentElement;
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
            container = findInputContainer(inputArea);
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

        // Place the button next to the input area
        if (platform === PLATFORMS.LINKEDIN) {
            // Try to place before the input
            inputArea.parentElement?.insertBefore(btn, inputArea);
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
