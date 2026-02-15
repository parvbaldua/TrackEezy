import Tesseract from 'tesseract.js';

/**
 * Run OCR on an image file and return extracted text
 */
export async function extractTextFromImage(imageFile, onProgress) {
    const result = await Tesseract.recognize(imageFile, 'eng+hin', {
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

    // 1. MRP / Price
    const priceMatch = text.match(/(?:mrp|m\.?\s*r\.?\s*p\.?|price)\s*[:.₹]?\s*[₹Rs.]*\s*(\d+\.?\d*)/i)
        || text.match(/₹\s*(\d+\.?\d*)/);
    if (priceMatch) result.price = priceMatch[1];

    // 2. Net Weight / Volume — extract unit too
    const weightMatch = text.match(/(?:net\s*(?:wt|weight|qty|quantity|content)|contents?)\s*[:.]\s*(\d+\.?\d*)\s*(kg|g|gm|gram|grams|ml|l|ltr|litre|liter|litres|liters|piece|pcs)/i)
        || text.match(/(\d+\.?\d*)\s*(kg|gm|gram|grams|ml|ltr|litre|liter|litres|liters)\b/i);
    if (weightMatch) {
        const val = parseFloat(weightMatch[1]);
        const rawUnit = weightMatch[2].toLowerCase();

        if (['kg'].includes(rawUnit)) {
            result.baseUnit = 'gram';
            result.displayUnit = 'kilogram';
            result.conversionFactor = '1000';
            result._packetWeight = String(val * 1000);
        } else if (['g', 'gm', 'gram', 'grams'].includes(rawUnit)) {
            result.baseUnit = 'gram';
            result.displayUnit = 'gram';
            result.conversionFactor = '1';
            result._packetWeight = String(val);
        } else if (['l', 'ltr', 'litre', 'liter', 'litres', 'liters'].includes(rawUnit)) {
            result.baseUnit = 'millilitre';
            result.displayUnit = 'litre';
            result.conversionFactor = '1000';
            result._packetWeight = String(val * 1000);
        } else if (['ml'].includes(rawUnit)) {
            result.baseUnit = 'millilitre';
            result.displayUnit = 'millilitre';
            result.conversionFactor = '1';
            result._packetWeight = String(val);
        }
    }

    // 3. Expiry Date
    const expiryMatch = text.match(/(?:exp(?:iry)?\.?\s*(?:date)?|best\s*before|use\s*by|bb)\s*[:.\/]?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i)
        || text.match(/(?:exp(?:iry)?\.?\s*(?:date)?|best\s*before|use\s*by|bb)\s*[:.\/]?\s*(\d{1,2})[\/\-\.](\d{2,4})/i);
    if (expiryMatch) {
        if (expiryMatch[3]) {
            // DD/MM/YYYY or MM/YYYY
            let year = expiryMatch[3].length === 2 ? '20' + expiryMatch[3] : expiryMatch[3];
            let month = expiryMatch[2].padStart(2, '0');
            let day = expiryMatch[1].padStart(2, '0');
            result.expiryDate = `${year}-${month}-${day}`;
        } else if (expiryMatch[2]) {
            // MM/YYYY format
            let month = expiryMatch[1].padStart(2, '0');
            let year = expiryMatch[2].length === 2 ? '20' + expiryMatch[2] : expiryMatch[2];
            result.expiryDate = `${year}-${month}-01`;
        }
    }

    // 4. Batch Number
    const batchMatch = text.match(/(?:batch|b\.?\s*no\.?|lot\s*no\.?)\s*[:.]\s*([A-Z0-9][A-Z0-9\-\/]+)/i);
    if (batchMatch) result.batchNo = batchMatch[1].trim();

    // 5. HSN Code
    const hsnMatch = text.match(/(?:hsn)\s*[:.]\s*(\d{4,8})/i);
    if (hsnMatch) result.hsnCode = hsnMatch[1];

    // 6. GST %
    const gstMatch = text.match(/(?:gst|igst)\s*[@:]?\s*(\d+\.?\d*)\s*%/i);
    const cgstMatch = text.match(/(?:cgst|sgst)\s*[@:]?\s*(\d+\.?\d*)\s*%/i);
    if (gstMatch) {
        result.gstPercent = gstMatch[1];
    } else if (cgstMatch) {
        // CGST + SGST = total GST (CGST = SGST, so total = 2x)
        result.gstPercent = String(parseFloat(cgstMatch[1]) * 2);
    }

    // 7. Product Name — heuristic: first meaningful line that isn't a number/code
    for (const line of lines) {
        const clean = line.replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
        if (
            clean.length > 3 &&
            !/^\d+$/.test(clean) &&
            !/^(mrp|price|net|batch|exp|hsn|gst|cgst|sgst|igst|mfg|manufactured|packed|best|use|date)/i.test(clean) &&
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
