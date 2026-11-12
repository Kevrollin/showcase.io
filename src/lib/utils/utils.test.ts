import { describe, expect, it } from 'vitest';
import { contactSchema, contactToColumns, itemSchema, itemValuesToColumns, signUpSchema, slugSchema } from '@/lib/validation/schemas';
import { AppError, NETWORK_ERROR, toUserMessage } from './errors';
import { coverCrop, fitWithin, validateImageFile } from './image';
import { formatPhone, normalizePhone, toLocalKenyan } from './phone';
import { formatMoney, formatPrice, parsePriceInput } from './price';
import { slugify, validateSlug } from './slug';
import { normalizeSocial, normalizeWebsite, socialHandle } from './social';
import { facebookShareLink, itemEnquiry, whatsappLink, whatsappShareLink } from './whatsapp';

describe('normalizePhone', () => {
  it.each([
    ['0712345678', '+254712345678'],
    ['0712 345 678', '+254712345678'],
    ['0112-345-678', '+254112345678'],
    ['712345678', '+254712345678'],
    ['254712345678', '+254712345678'],
    ['+254 712 345 678', '+254712345678'],
    ['+254 (0) 712 345 678', '+254712345678'],
    ['00254712345678', '+254712345678'],
    ['+255 754 123 456', '+255754123456'],
    ['+1 415 555 0132', '+14155550132'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, e164: expected });
  });

  it.each(['', '   ', '0812345678', '07123', '071234567890', 'call me', '+0712345678', '254812345678', '4155550132'])(
    'rejects %j',
    (input) => {
      expect(normalizePhone(input).ok).toBe(false);
    },
  );

  it('formats for display', () => {
    expect(formatPhone('+254712345678')).toBe('+254 712 345 678');
    expect(formatPhone('+14155550132')).toBe('+14155550132');
    expect(toLocalKenyan('+254712345678')).toBe('0712 345 678');
  });
});

describe('WhatsApp links', () => {
  it('uses digits only and encodes the message', () => {
    expect(whatsappLink('+254712345678')).toBe('https://wa.me/254712345678');
    expect(whatsappLink('+254712345678', "Hi, I'm interested in the Nike Air Max & more")).toBe(
      'https://wa.me/254712345678?text=Hi%2C%20I\'m%20interested%20in%20the%20Nike%20Air%20Max%20%26%20more',
    );
  });

  it('builds item enquiries with the public item link', () => {
    const message = itemEnquiry('Nike Air Max sneakers', 'https://example.com/s/kicks/nike-air-max');
    expect(message).toBe(
      "Hi, I found your catalogue and I'm interested in the Nike Air Max sneakers.\nhttps://example.com/s/kicks/nike-air-max",
    );
    expect(whatsappLink('+254712345678', message)).toContain('%0Ahttps%3A%2F%2Fexample.com%2Fs%2Fkicks%2Fnike-air-max');
  });

  it('builds share links', () => {
    expect(whatsappShareLink('See https://x.co')).toBe('https://wa.me/?text=See%20https%3A%2F%2Fx.co');
    expect(facebookShareLink('https://x.co/s/a')).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fx.co%2Fs%2Fa');
  });
});

describe('prices', () => {
  it('formats KES amounts', () => {
    expect(formatMoney(500)).toBe('KES 500');
    expect(formatMoney(1500)).toBe('KES 1,500');
    expect(formatMoney(1234567.5)).toBe('KES 1,234,567.50');
    expect(formatMoney(0)).toBe('KES 0');
  });

  it('formats by price mode', () => {
    expect(formatPrice('fixed', 500)).toBe('KES 500');
    expect(formatPrice('fixed', '1500.00')).toBe('KES 1,500');
    expect(formatPrice('starting_from', 1500)).toBe('From KES 1,500');
    expect(formatPrice('quote', null)).toBe('Request a quote');
    expect(formatPrice('contact', null)).toBe('Price on request');
    expect(formatPrice('none', 100)).toBeNull();
    expect(formatPrice('fixed', null)).toBeNull();
  });

  it('parses user input', () => {
    expect(parsePriceInput('1,500')).toBe(1500);
    expect(parsePriceInput('KES 1500.50')).toBe(1500.5);
    expect(parsePriceInput('ksh 200')).toBe(200);
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('12.345')).toBeNull();
    expect(parsePriceInput('-5')).toBeNull();
    expect(parsePriceInput('abc')).toBeNull();
  });
});

describe('slugs', () => {
  it('slugifies names like the database does', () => {
    expect(slugify('Kelvin Designs')).toBe('kelvin-designs');
    expect(slugify("Mama's Cakes & Bakes!")).toBe('mamas-cakes-bakes');
    expect(slugify('  Café Njoro  ')).toBe('cafe-njoro');
    expect(slugify('---')).toBe('');
  });

  it('validates slugs', () => {
    expect(validateSlug('kelvin-designs')).toBeNull();
    expect(validateSlug('ab')).toBe('too_short');
    expect(validateSlug('a'.repeat(49))).toBe('too_long');
    expect(validateSlug('Kelvin')).toBe('format');
    expect(validateSlug('double--dash')).toBe('format');
    expect(validateSlug('dashboard')).toBe('reserved');
    expect(slugSchema.safeParse('  My-Shop ').success).toBe(true);
  });
});

describe('social links', () => {
  it('accepts handles and URLs', () => {
    expect(normalizeSocial('instagram', '@kelvin.designs')).toEqual({ ok: true, url: 'https://instagram.com/kelvin.designs' });
    expect(normalizeSocial('instagram', 'https://www.instagram.com/kelvin_designs/?hl=en')).toEqual({
      ok: true,
      url: 'https://instagram.com/kelvin_designs',
    });
    expect(normalizeSocial('tiktok', 'kelvin.designs')).toEqual({ ok: true, url: 'https://www.tiktok.com/@kelvin.designs' });
    expect(normalizeSocial('tiktok', 'tiktok.com/@kelvin')).toEqual({ ok: true, url: 'https://www.tiktok.com/@kelvin' });
    expect(normalizeSocial('facebook', 'KelvinDesigns')).toEqual({ ok: true, url: 'https://www.facebook.com/KelvinDesigns' });
    expect(normalizeSocial('facebook', 'https://m.facebook.com/profile.php?id=123')).toEqual({
      ok: true,
      url: 'https://www.facebook.com/profile.php?id=123',
    });
  });

  it('rejects other hosts and junk', () => {
    expect(normalizeSocial('instagram', 'https://evil.com/kelvin')).toEqual({ ok: false });
    expect(normalizeSocial('instagram', 'has spaces')).toEqual({ ok: false });
    expect(normalizeSocial('facebook', 'https://facebook.evil.com/x')).toEqual({ ok: false });
    expect(normalizeSocial('tiktok', '')).toBeNull();
  });

  it('normalises websites', () => {
    expect(normalizeWebsite('kelvin.design')).toBe('https://kelvin.design');
    expect(normalizeWebsite('http://example.com/work')).toBe('http://example.com/work');
    expect(normalizeWebsite('javascript:alert(1)')).toBe(false);
    expect(normalizeWebsite('not a url')).toBe(false);
    expect(normalizeWebsite('')).toBeNull();
    expect(socialHandle('https://www.tiktok.com/@kelvin')).toBe('@kelvin');
  });
});

describe('image maths', () => {
  it('fits within a bound without upscaling', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('computes centred cover crops', () => {
    expect(coverCrop(2000, 2000, { width: 1200, height: 630 })).toEqual({ sx: 0, sy: 475, sw: 2000, sh: 1050 });
    expect(coverCrop(4000, 1000, { width: 1200, height: 630 })).toEqual({ sx: 1048, sy: 0, sw: 1905, sh: 1000 });
  });

  it('validates file type and size', () => {
    const file = (type: string, size: number) => new File([new Uint8Array(size)], 'x', { type });
    expect(validateImageFile(file('image/jpeg', 10))).toBeNull();
    expect(validateImageFile(file('image/webp', 10))).toBeNull();
    expect(validateImageFile(file('image/svg+xml', 10))).toBe('type');
    expect(validateImageFile(file('application/x-msdownload', 10))).toBe('type');
    expect(validateImageFile(file('image/gif', 10))).toBe('type');
    expect(validateImageFile(file('image/png', 0))).toBe('empty');
    expect(validateImageFile(file('image/png', 26 * 1024 * 1024))).toBe('size');
  });
});

describe('friendly errors', () => {
  it('maps Supabase auth errors', () => {
    expect(toUserMessage({ name: 'AuthApiError', code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'The email or password is incorrect.',
    );
    expect(toUserMessage({ code: 'weak_password', message: 'x' })).toMatch(/stronger password/);
    expect(toUserMessage({ code: 'otp_expired' })).toMatch(/expired/);
    expect(toUserMessage({ code: 'user_already_exists' })).toMatch(/already exists/);
  });

  it('maps database errors without leaking details', () => {
    expect(toUserMessage({ code: '23505', message: 'duplicate key value violates unique constraint "businesses_slug_key"' })).toMatch(
      /already taken/,
    );
    expect(toUserMessage({ code: 'P0001', message: 'PLAN_LIMIT_PUBLISHED' })).toMatch(/one published storefront/);
    expect(toUserMessage({ code: '42501', message: 'new row violates row-level security policy for table "businesses"' })).toMatch(
      /permission/,
    );
    const unknown = toUserMessage({ code: 'XX000', message: 'internal: relation "secret" does not exist' });
    expect(unknown).toBe('Something went wrong. Please try again.');
  });

  it('maps network failures and keeps AppError messages', () => {
    expect(toUserMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR);
    expect(toUserMessage({ name: 'AuthRetryableFetchError', message: '' })).toBe(NETWORK_ERROR);
    expect(toUserMessage(new AppError('Custom safe message'))).toBe('Custom safe message');
  });
});

describe('form schemas', () => {
  it('validates sign-up passwords', () => {
    expect(signUpSchema.safeParse({ fullName: 'Kelvin', email: 'k@example.com', password: 'password' }).success).toBe(false);
    expect(signUpSchema.safeParse({ fullName: 'Kelvin', email: 'k@example.com', password: 'passw0rd' }).success).toBe(true);
    expect(signUpSchema.safeParse({ fullName: 'Kelvin', email: 'not-an-email', password: 'passw0rd' }).success).toBe(false);
  });

  it('normalises contact details into columns', () => {
    const parsed = contactSchema.parse({
      whatsapp_number: '0712 345 678',
      phone_number: '',
      contact_email: 'hi@kelvin.design',
      instagram: '@kelvin',
      tiktok: '',
      facebook: '',
      website: 'kelvin.design',
    });
    expect(contactToColumns(parsed)).toEqual({
      whatsapp_number: '+254712345678',
      phone_number: null,
      contact_email: 'hi@kelvin.design',
      instagram_url: 'https://instagram.com/kelvin',
      tiktok_url: null,
      facebook_url: null,
      website_url: 'https://kelvin.design',
    });
    expect(contactSchema.safeParse({ ...parsed, whatsapp_number: '' }).success).toBe(false);
  });

  it('requires a price only for price modes that show one', () => {
    const base = {
      title: 'Logo design',
      description: '',
      item_type: 'service' as const,
      category_id: '',
      price: '',
      availability_status: 'available' as const,
      is_featured: false,
      is_published: true,
    };
    expect(itemSchema.safeParse({ ...base, price_mode: 'quote' }).success).toBe(true);
    expect(itemSchema.safeParse({ ...base, price_mode: 'starting_from' }).success).toBe(false);
    const ok = itemSchema.parse({ ...base, price_mode: 'starting_from', price: '1,500' });
    expect(itemValuesToColumns(ok)).toMatchObject({ price: 1500, price_mode: 'starting_from', category_id: null, description: null });
    expect(itemValuesToColumns({ ...ok, price_mode: 'quote' }).price).toBeNull();
  });
});

describe('public API headers', () => {
  it('sends legacy JWT anon keys as bearer tokens but publishable keys only as apikey', async () => {
    const { publicHeaders } = await import('@/lib/supabase/publicApi');
    expect(publicHeaders('eyJhbGciOiJIUzI1NiJ9.e30.x')).toMatchObject({ apikey: 'eyJhbGciOiJIUzI1NiJ9.e30.x', Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.x' });
    expect(publicHeaders('sb_publishable_abc')).not.toHaveProperty('Authorization');
  });
});

describe('image fit', () => {
  it('fills the frame when shapes are close and shows the whole image otherwise', async () => {
    const { resolveFit } = await import('./imageFit');
    expect(resolveFit('smart', '1 / 1', 1200, 1100)).toBe('cover');
    expect(resolveFit('smart', '1 / 1', 1600, 900)).toBe('contain'); // 16:9 in a square
    expect(resolveFit('smart', '1 / 1', 900, 1600)).toBe('contain'); // tall phone photo
    expect(resolveFit('smart', '4 / 5', 1200, 1600)).toBe('cover'); // 3:4 in a 4:5 frame
    expect(resolveFit('smart', '1 / 1', null, null)).toBe('cover');
    expect(resolveFit('contain', '1 / 1', 100, 100)).toBe('contain');
  });
});
