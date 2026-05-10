// src/background/backends/ollama.js

export async function runOllama(model, promptText, imageBase64) {
    const endpoint = 'http://localhost:11434/api/generate';
    const selectedModel = typeof model === 'string' ? model.trim() : '';

    if (!selectedModel) {
        throw createBackendError('CONFIG', 'No local model configured. Open the SMAC popup and enter a model name.');
    }

    const body = {
        model: selectedModel,
        prompt: promptText,
        stream: false,
        options: { num_ctx: 4096 }
    };

    if (imageBase64) {
        body.images = [imageBase64];
    }

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
        });
    } catch (networkErr) {
        throw createBackendError('OLLAMA_UNREACHABLE', 'Ollama unreachable. Is it running?');
    }

    if (response.status === 403) {
        throw createBackendError('CORS', 'Run ./start-smac.sh and fully reopen the LinkedIn or X tab.');
    }

    if (response.status === 404) {
        throw createBackendError('MODEL_NOT_FOUND', `Model "${selectedModel}" not found. Run: ollama pull ${selectedModel}`);
    }

    if (!response.ok) {
        throw createBackendError('OLLAMA_ERROR', `Ollama error (${response.status}). Check Ollama logs.`);
    }

    const data = await response.json();
    return data.response?.trim() || '';
}

function createBackendError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}
