(function () {
    console.log('[SMAC] Injected script started');

    // Get text from the data attribute on body
    const text = document.body.getAttribute('data-smac-text');
    if (!text) {
        console.warn('[SMAC] No text found in data-smac-text attribute');
        return;
    }

    // Cleanup immediately
    document.body.removeAttribute('data-smac-text');

    console.log('[SMAC] Attempting to trigger React update for text:', text);

    // Helpers
    const findEditor = () => {
        // Twitter specific selectors
        return document.querySelector('.public-DraftEditor-content') ||
            document.querySelector('[contenteditable="true"]');
    };

    const getReactFiber = (el) => {
        const key = Object.keys(el).find(k => k.startsWith('__reactFiber'));
        return key ? el[key] : null;
    };

    const getHandlers = (fiberNode) => {
        return fiberNode.memoizedProps || fiberNode.pendingProps || {};
    };

    // Execution
    const editor = findEditor();
    if (!editor) {
        console.error('[SMAC] Editor element not found');
        return;
    }

    const fiber = getReactFiber(editor);
    if (!fiber) {
        console.error('[SMAC] React Fiber not found on editor');
        return;
    }

    console.log('[SMAC] Found React Fiber instance');
    const props = getHandlers(fiber);

    // Construct Synthetic Event
    const syntheticEvent = {
        nativeEvent: new InputEvent('textInput', {
            bubbles: true,
            cancelable: true,
            data: text,
            inputType: 'insertText',
            view: window
        }),
        bubbles: true,
        cancelable: true,
        currentTarget: editor,
        target: editor,
        data: text,
        inputType: 'insertText',
        type: 'input',
        defaultPrevented: false,
        isTrusted: true,
        preventDefault: () => { },
        stopPropagation: () => { },
        persist: () => { },
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false
    };

    let success = false;

    // 1. Try onBeforeInput (Critical for Draft.js)
    if (typeof props.onBeforeInput === 'function') {
        try {
            console.log('[SMAC] Calling onBeforeInput');
            props.onBeforeInput(syntheticEvent);
            success = true;
        } catch (e) { console.error('[SMAC] onBeforeInput failed', e); }
    }

    // 2. Try onInput
    if (typeof props.onInput === 'function') {
        try {
            console.log('[SMAC] Calling onInput');
            props.onInput(syntheticEvent);
            success = true;
        } catch (e) { console.error('[SMAC] onInput failed', e); }
    }

    // 3. Try onChange
    if (typeof props.onChange === 'function') {
        try {
            console.log('[SMAC] Calling onChange');
            const changeEvent = { ...syntheticEvent, type: 'change', target: { value: text, ...editor } };
            props.onChange(changeEvent);
            success = true;
        } catch (e) { console.error('[SMAC] onChange failed', e); }
    }

    console.log('[SMAC] Injection complete. Success flag:', success);

    // Signal completion to content script via custom event
    window.dispatchEvent(new CustomEvent('SMAC_INJECTION_COMPLETE', { detail: { success } }));
})();
