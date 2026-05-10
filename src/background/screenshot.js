// src/background/screenshot.js

export async function captureAndCrop(coords) {
    if (!coords || typeof coords.width !== 'number' || typeof coords.height !== 'number') {
        return null;
    }

    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'jpeg',
            quality: 85
        });
        if (!dataUrl) return null;

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);

        const dpr = coords.dpr || 1;
        const cropX = Math.max(0, Math.round(coords.x * dpr));
        const cropY = Math.max(0, Math.round(coords.y * dpr));
        const cropWidth = Math.round(coords.width * dpr);
        const cropHeight = Math.round(coords.height * dpr);
        const finalWidth = Math.min(cropWidth, bitmap.width - cropX);
        const finalHeight = Math.min(cropHeight, bitmap.height - cropY);

        if (finalWidth <= 0 || finalHeight <= 0) {
            return null;
        }

        const canvas = new OffscreenCanvas(finalWidth, finalHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(
            bitmap,
            cropX, cropY, finalWidth, finalHeight,
            0, 0, finalWidth, finalHeight
        );

        const croppedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });

        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = typeof reader.result === 'string' ? reader.result : '';
                resolve(extractBase64(result));
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsDataURL(croppedBlob);
        });
    } catch (error) {
        console.warn('SMAC: Screenshot failed, continuing text-only.');
        return null;
    }
}

function extractBase64(dataUrl) {
    return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}
