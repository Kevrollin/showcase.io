/**
 * Phone number normalisation to E.164 (+2547XXXXXXXX), with first-class support
 * for Kenyan formats and a strict fallback for other international numbers.
 *
 * Accepted Kenyan inputs (spaces, dashes, dots and brackets are ignored):
 *   0712 345 678 · 0112 345 678 · 712345678 · 254712345678 · +254 712 345 678
 */
export type PhoneResult = { ok: true; e164: string } | { ok: false; reason: 'empty' | 'invalid' };

const KENYA_CC = '254';
/** Kenyan mobile subscriber numbers: 7XXXXXXXX or 1XXXXXXXX. */
const KENYA_MOBILE = /^(7\d{8}|1\d{8})$/;

export function normalizePhone(input: string | null | undefined): PhoneResult {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };
  if (/[^\d\s+().-]/.test(raw)) return { ok: false, reason: 'invalid' };

  const hasPlus = raw.startsWith('+');
  const hasDoubleZero = !hasPlus && raw.replace(/\D/g, '').startsWith('00');
  let digits = raw.replace(/\D/g, '');
  if (hasDoubleZero) digits = digits.slice(2);

  if (!hasPlus && !hasDoubleZero) {
    // Kenyan national formats: 07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX.
    if (digits.startsWith('0') && KENYA_MOBILE.test(digits.slice(1))) {
      return { ok: true, e164: `+${KENYA_CC}${digits.slice(1)}` };
    }
    if (KENYA_MOBILE.test(digits)) {
      return { ok: true, e164: `+${KENYA_CC}${digits}` };
    }
  }

  if (digits.startsWith(KENYA_CC)) {
    const national = digits.slice(KENYA_CC.length).replace(/^0/, '');
    return KENYA_MOBILE.test(national)
      ? { ok: true, e164: `+${KENYA_CC}${national}` }
      : { ok: false, reason: 'invalid' };
  }

  // Other countries must be entered in international format (+ or 00).
  if ((hasPlus || hasDoubleZero) && /^[1-9]\d{7,14}$/.test(digits)) {
    return { ok: true, e164: `+${digits}` };
  }
  return { ok: false, reason: 'invalid' };
}

/** "+254712345678" → "+254 712 345 678" for display. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(e164);
  if (m) return `+254 ${m[1]} ${m[2]} ${m[3]}`;
  return e164;
}

/** "+254712345678" → "0712 345 678" for prefilling Kenyan form fields. */
export function toLocalKenyan(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Digits only, as required by wa.me links. */
export function toWhatsAppDigits(e164: string): string {
  return e164.replace(/\D/g, '');
}
