// src/lib/moderation.ts

const BAD_WORDS = [
    "anjing", "babi", "bangsat", "tolol", "goblok", "idiot", "kontol", "memek", "porn", "sex", "judi", "slot", "gacor", 
    "casino", "penipu", "fuck", "shit", "asshole"
];

const AD_WORDS = [
    "cek ig kami", "jual murah", "promo slot", "kunjungi link", "berlangganan sekarang", "gratis ongkir", "wa ke", "whatsapp kami"
];

/**
 * Validates text against bad words, ads, and repetition.
 * Returns { valid: boolean, reason?: string }
 */
export function validateContent(text: string, previousTexts: string[] = []): { valid: boolean, reason?: string } {
    const cleanText = text.toLowerCase().trim();

    if (!cleanText) return { valid: false, reason: "Konten tidak boleh kosong." };

    // 1. Check Profanity
    for (const word of BAD_WORDS) {
        if (cleanText.includes(word)) {
            return { valid: false, reason: "Konten mengandung kata-kata yang melanggar etika." };
        }
    }

    // 2. Check Ads
    for (const word of AD_WORDS) {
        if (cleanText.includes(word)) {
            return { valid: false, reason: "Konten terdeteksi sebagai iklan atau spam." };
        }
    }

    // 3. Check Repetitive (Spam)
    if (previousTexts.length > 0) {
        // Simple exact match spam check
        const isDuplicate = previousTexts.some(prev => prev.toLowerCase().trim() === cleanText);
        if (isDuplicate) {
            return { valid: false, reason: "Pesan berulang tidak diperbolehkan." };
        }
    }

    return { valid: true };
}
