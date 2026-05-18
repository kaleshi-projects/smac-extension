// src/background/crypto.js

async function getDerivedKey() {
    // Generate a 256-bit key from the chrome.runtime.id
    const encoder = new TextEncoder();
    const idData = encoder.encode(chrome.runtime.id || 'smac-fallback-id');
    const hash = await crypto.subtle.digest('SHA-256', idData);
    return await crypto.subtle.importKey(
        'raw',
        hash,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptKey(plaintextKey) {
    if (!plaintextKey) return null;
    const key = await getDerivedKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintextKey);
    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );
    
    // Store iv and ciphertext as base64
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const ciphertextArray = new Uint8Array(ciphertextBuffer);
    const ciphertextBase64 = btoa(String.fromCharCode(...ciphertextArray));
    return { iv: ivBase64, ciphertext: ciphertextBase64 };
}

export async function decryptKey(ivBase64, ciphertextBase64) {
    if (!ivBase64 || !ciphertextBase64) return null;
    const key = await getDerivedKey();
    
    const ivStr = atob(ivBase64);
    const iv = new Uint8Array(ivStr.length);
    for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);
    
    const ciphertextStr = atob(ciphertextBase64);
    const ciphertext = new Uint8Array(ciphertextStr.length);
    for (let i = 0; i < ciphertextStr.length; i++) ciphertext[i] = ciphertextStr.charCodeAt(i);
    
    try {
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );
        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
    } catch (e) {
        // We do not log the specific error to avoid leaking information
        return null;
    }
}
