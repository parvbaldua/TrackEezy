/**
 * Look up product information by barcode using Open Food Facts API
 */
export async function lookupBarcode(barcode) {
    try {
        // Try Open Food Facts first (has lots of Indian products)
        const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
        const data = await res.json();

        if (data.status === 1 && data.product) {
            const p = data.product;
            return {
                found: true,
                name: p.product_name || p.generic_name || '',
                price: '', // Open Food Facts doesn't have pricing
                weight: p.quantity || '',
                brand: p.brands || '',
                barcode: barcode,
                // Parse weight/volume
                ...parseWeight(p.quantity || p.product_quantity_unit || ''),
            };
        }

        // Product not found — return barcode only
        return { found: false, barcode };
    } catch (err) {
        console.error('Barcode lookup failed:', err);
        return { found: false, barcode };
    }
}

/**
 * Parse weight string like "55 g", "1 kg", "500 ml" into structured data
 */
function parseWeight(weightStr) {
    if (!weightStr) return {};

    const match = weightStr.match(/(\d+\.?\d*)\s*(kg|g|gm|gram|grams|ml|l|ltr|litre|liter|litres|liters|piece|pcs)/i);
    if (!match) return {};

    const val = parseFloat(match[1]);
    const rawUnit = match[2].toLowerCase();

    if (['kg'].includes(rawUnit)) {
        return { baseUnit: 'gram', displayUnit: 'kilogram', conversionFactor: '1000', _packetWeight: String(val * 1000) };
    } else if (['g', 'gm', 'gram', 'grams'].includes(rawUnit)) {
        return { baseUnit: 'gram', displayUnit: 'gram', conversionFactor: '1', _packetWeight: String(val) };
    } else if (['l', 'ltr', 'litre', 'liter', 'litres', 'liters'].includes(rawUnit)) {
        return { baseUnit: 'millilitre', displayUnit: 'litre', conversionFactor: '1000', _packetWeight: String(val * 1000) };
    } else if (['ml'].includes(rawUnit)) {
        return { baseUnit: 'millilitre', displayUnit: 'millilitre', conversionFactor: '1', _packetWeight: String(val) };
    }
    return {};
}

/**
 * Play a beep sound (like barcode scanner)
 */
export function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(1800, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.15);

        // Also vibrate if supported
        if (navigator.vibrate) navigator.vibrate(100);
    } catch (e) {
        // Fallback — ignore audio errors
    }
}
