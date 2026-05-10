// src/background/backends/remote.js

export async function runRemote(apiKey, endpoint, model, promptText, imageBase64) {
    if (!endpoint || !endpoint.startsWith('https://')) {
        throw createBackendError('HTTPS_REQUIRED', 'Endpoint must use HTTPS');
    }

    if (!model) {
        throw createBackendError('CONFIG', 'Please enter a remote model name in the popup.');
    }

    // NATIVE GEMINI API SUPPORT
    if (endpoint.includes('generativelanguage.googleapis.com') && !endpoint.includes('/chat/completions')) {
        let baseUrl = endpoint.replace(/\/$/, '');
        if (!baseUrl.includes(':generateContent')) {
            if (baseUrl.endsWith('/v1beta') || baseUrl.endsWith('/v1')) {
                baseUrl = `${baseUrl}/models/${model}:generateContent`;
            } else {
                baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            }
        }

        const parts = [{ text: promptText }];
        if (imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64
                }
            });
        }

        const response = await fetch(`${baseUrl}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] })
        });

        if (!response.ok) {
            throw mapRemoteError(response.status, true);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }

    // OPENAI COMPATIBLE API SUPPORT (Default)
    let messages = [{
        role: 'user',
        content: []
    }];

    messages[0].content.push({
        type: 'text',
        text: promptText
    });

    if (imageBase64) {
        messages[0].content.push({
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
            }
        });
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: messages,
            stream: false
        })
    });

    if (!response.ok) {
        throw mapRemoteError(response.status, false);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

function mapRemoteError(status, isGemini) {
    if (status === 401 || status === 403) {
        return createBackendError('REMOTE_AUTH', `${isGemini ? 'Gemini API Error' : 'Remote API Error'} (${status}). Check your API key.`);
    }

    if (status === 429) {
        return createBackendError('REMOTE_RATE_LIMIT', 'API rate limit hit. Try again shortly.');
    }

    return createBackendError(
        'REMOTE_ERROR',
        `${isGemini ? 'Gemini API Error' : 'Remote API Error'} (${status}). Check your API key and endpoint.`
    );
}

function createBackendError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}
