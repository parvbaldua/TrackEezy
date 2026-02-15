import Tesseract from 'tesseract.js';

// Pre-initialize worker so it's ready when needed
let workerReady = null;
let cachedWorker = null;

export function preloadOcrWorker() {
    if (!workerReady) {
        workerReady = Tesseract.createWorker('eng', 1, {
            logger: () => { },
        }).then(worker => {
            cachedWorker = worker;
            console.log('[OCR] Worker ready');
            return worker;
        }).catch(err => {
            console.error('[OCR] Worker init failed:', err);
            workerReady = null;
        });
    }
    return workerReady;
}

/**
 * Run OCR on an image file and return extracted text
 */
export async function extractTextFromImage(imageFile, onProgress) {
    // Use cached worker if available, otherwise create new
    if (cachedWorker) {
        const result = await cachedWorker.recognize(imageFile);
        return result.data.text;
    }

    // Fallback: use simple recognize
    const result = await Tesseract.recognize(imageFile, 'eng', {
        logger: (m) => {
            if (m.status === 'recognizing text' && onProgress) {
                onProgress(Math.round(m.progress * 100));
            }
        },
    });
    return result.data.text;
}

/**
 * Parse OCR text and extract product info
 */
export function parseProductLabel(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const result = {};

    // Clean text — remove common OCR artifacts
    const cleanText = text.replace(/[|}{[\]]/g, '');

    // 1. MRP / Price — very flexible matching
    const priceMatch = cleanText.match(/(?:mrp|m\.?\s*r\.?\s*p\.?|price|rs\.?)\s*[:.₹]?\s*[₹Rs.]*\s*(\d+\.?\d*)/i)
        || cleanText.match(/₹\s*(\d+\.?\d*)/)
        || cleanText.match(/(\d+\.?\d*)\s*\/-/); // "55/-" format
    if (priceMatch) result.price = priceMatch[1];

    // 2. Net Weight / Volume
    const weightMatch = cleanText.match(/(?:net\s*(?:wt|weight|qty|quantity|content|w[il1])|contents?)\s*[:.~]?\s*(\d+\.?\d*)\s*(kg|g|gm|gram|grams|ml|l|ltr|litre|liter|litres|liters|piece|pcs)/i)
        || cleanText.match(/(\d+\.?\d*)\s*(kg|gm|gram|grams|ml|ltr|litre|liter|litres|liters)\b/i);
    if (weightMatch) {
        const val = parseFloat(weightMatch[1]);
        const rawUnit = weightMatch[2].toLowerCase();

        if (['kg'].includes(rawUnit)) {
            result.baseUnit = 'gram'; result.displayUnit = 'kilogram';
            result.conversionFactor = '1000'; result._packetWeight = String(val * 1000);
        } else if (['g', 'gm', 'gram', 'grams'].includes(rawUnit)) {
            result.baseUnit = 'gram'; result.displayUnit = 'gram';
            result.conversionFactor = '1'; result._packetWeight = String(val);
        } else if (['l', 'ltr', 'litre', 'liter', 'litres', 'liters'].includes(rawUnit)) {
            result.baseUnit = 'millilitre'; result.displayUnit = 'litre';
            result.conversionFactor = '1000'; result._packetWeight = String(val * 1000);
        } else if (['ml'].includes(rawUnit)) {
            result.baseUnit = 'millilitre'; result.displayUnit = 'millilitre';
            result.conversionFactor = '1'; result._packetWeight = String(val);
        }
    }

    // 3. Expiry Date — very flexible
    const expiryMatch = cleanText.match(/(?:exp(?:iry)?\.?\s*(?:date)?|best\s*before|use\s*by|bb|b\.?\s*b)\s*[:.\/\-]?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i)
        || cleanText.match(/(?:exp(?:iry)?\.?\s*(?:date)?|best\s*before|use\s*by|bb)\s*[:.\/\-]?\s*(\d{1,2})[\/\-\.](\d{2,4})/i)
        || cleanText.match(/(?:exp(?:iry)?\.?\s*(?:date)?|best\s*before|use\s*by)\s*[:.\/\-]?\s*([A-Za-z]+)\s*[\-\/]?\s*(\d{2,4})/i); // "Dec 2026"
    if (expiryMatch) {
        if (expiryMatch[3]) {
            let year = expiryMatch[3].length === 2 ? '20' + expiryMatch[3] : expiryMatch[3];
            let month = expiryMatch[2].padStart(2, '0');
            let day = expiryMatch[1].padStart(2, '0');
            result.expiryDate = `${year}-${month}-${day}`;
        } else if (expiryMatch[2]) {
            // Could be MM/YYYY or Month YYYY
            const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
            let month = months[expiryMatch[1].toLowerCase().substring(0, 3)] || expiryMatch[1].padStart(2, '0');
            let year = expiryMatch[2].length === 2 ? '20' + expiryMatch[2] : expiryMatch[2];
            result.expiryDate = `${year}-${month}-01`;
        }
    }

    // 4. Batch Number
    const batchMatch = cleanText.match(/(?:batch|b\.?\s*no\.?|lot\s*no\.?|b\.?n\.?)\s*[:.]\s*([A-Z0-9][A-Z0-9\-\/]+)/i);
    if (batchMatch) result.batchNo = batchMatch[1].trim();

    // 5. HSN Code
    const hsnMatch = cleanText.match(/(?:hsn)\s*[:.]\s*(\d{4,8})/i);
    if (hsnMatch) result.hsnCode = hsnMatch[1];

    // 6. GST %
    const gstMatch = cleanText.match(/(?:gst|igst|tax)\s*[@:]?\s*(\d+\.?\d*)\s*%/i)
        || cleanText.match(/(\d+\.?\d*)\s*%\s*(?:gst|igst|tax)/i);
    const cgstMatch = cleanText.match(/(?:cgst|sgst)\s*[@:]?\s*(\d+\.?\d*)\s*%/i);
    if (gstMatch) {
        result.gstPercent = gstMatch[1];
    } else if (cgstMatch) {
        result.gstPercent = String(parseFloat(cgstMatch[1]) * 2);
    }

    // 7. Product Name
    for (const line of lines) {
        const clean = line.replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
        if (
            clean.length > 3 &&
            !/^\d+$/.test(clean) &&
            !/^(mrp|price|net|batch|exp|hsn|gst|cgst|sgst|igst|mfg|manufactured|packed|best|use|date|fssai|lic|marketed|address)/i.test(clean) &&
            !/^\d+\s*(kg|g|ml|l|%)/i.test(clean)
        ) {
            result.name = clean;
            break;
        }
    }

    return result;
}

/**
 * Main function: scan image and return parsed product data
 */
export async function scanProductLabel(imageFile, onProgress) {
    const text = await extractTextFromImage(imageFile, onProgress);
    const parsed = parseProductLabel(text);
    return { rawText: text, ...parsed };
}
