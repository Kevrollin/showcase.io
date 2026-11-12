import { DEFAULT_CURRENCY, type PriceMode } from '@/config/catalog';

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 1500 → "KES 1,500"; 99.5 → "KES 99.50". */
export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY): string {
  const cents = Math.round(amount * 100);
  const whole = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100);
  const value = fraction === 0 ? groupThousands(String(whole)) : `${groupThousands(String(whole))}.${String(fraction).padStart(2, '0')}`;
  return `${currency} ${value}`;
}

/**
 * Customer-facing price label, or null when no price should be shown.
 * Postgres numeric can arrive as a string or a number.
 */
export function formatPrice(
  mode: PriceMode,
  price: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string | null {
  const amount = price === null || price === undefined || price === '' ? null : Number(price);
  const valid = amount !== null && !Number.isNaN(amount);
  switch (mode) {
    case 'fixed':
      return valid ? formatMoney(amount, currency) : null;
    case 'starting_from':
      return valid ? `From ${formatMoney(amount, currency)}` : null;
    case 'quote':
      return 'Request a quote';
    case 'contact':
      return 'Price on request';
    case 'none':
      return null;
  }
}

/** Parses user input such as "1,500" or "KES 1500.50" into a number. */
export function parsePriceInput(input: string): number | null {
  const cleaned = input.replace(/kes|ksh|sh/gi, '').replace(/[\s,]/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}
