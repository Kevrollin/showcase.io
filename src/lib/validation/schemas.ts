import { z } from 'zod';
import { AVAILABILITY_STATUSES, BUSINESS_TYPES, ITEM_TYPES, PRICE_MODE_OPTIONS, PRICE_MODES } from '@/config/catalog';
import { normalizePhone } from '@/lib/utils/phone';
import { parsePriceInput } from '@/lib/utils/price';
import { SLUG_PROBLEM_MESSAGES, validateSlug } from '@/lib/utils/slug';
import { normalizeSocial, normalizeWebsite } from '@/lib/utils/social';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const email = z.string().trim().min(1, 'Enter your email address.').max(254, 'This email address is too long.').regex(EMAIL_RE, 'Enter a valid email address.');

export const passwordRules = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

// ─── Auth ────────────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name.').max(80, 'Use at most 80 characters.'),
  email,
  password: passwordRules,
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordRules, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'The passwords do not match.', path: ['confirm'] });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

// ─── Business ────────────────────────────────────────────────────────────────

export const businessTypeSchema = z.enum(BUSINESS_TYPES);

export const identitySchema = z.object({
  name: z.string().trim().min(2, 'Enter your business name (at least 2 characters).').max(80, 'Use at most 80 characters.'),
  description: z.string().trim().max(500, 'Keep it under 500 characters.'),
  category: z.string().trim().max(60),
  location_label: z.string().trim().max(80, 'Use at most 80 characters.'),
});
export type IdentityValues = z.infer<typeof identitySchema>;

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || normalizePhone(v).ok, 'Enter a valid phone number, e.g. 0712 345 678.');

export const contactSchema = z.object({
  whatsapp_number: z
    .string()
    .trim()
    .min(1, 'Add your WhatsApp number so customers can reach you.')
    .refine((v) => normalizePhone(v).ok, 'Enter a valid WhatsApp number, e.g. 0712 345 678 or +254 712 345 678.'),
  phone_number: optionalPhone,
  contact_email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === '' || EMAIL_RE.test(v), 'Enter a valid email address.'),
  instagram: z.string().trim().refine((v) => normalizeSocial('instagram', v)?.ok !== false, 'Enter an Instagram username or profile link.'),
  tiktok: z.string().trim().refine((v) => normalizeSocial('tiktok', v)?.ok !== false, 'Enter a TikTok username or profile link.'),
  facebook: z.string().trim().refine((v) => normalizeSocial('facebook', v)?.ok !== false, 'Enter a Facebook page name or link.'),
  website: z.string().trim().refine((v) => normalizeWebsite(v) !== false, 'Enter a valid website address.'),
});
export type ContactValues = z.infer<typeof contactSchema>;

/** Converts validated contact form values into database columns. */
export function contactToColumns(values: ContactValues) {
  const phone = normalizePhone(values.phone_number);
  const whatsapp = normalizePhone(values.whatsapp_number);
  const pick = (r: ReturnType<typeof normalizeSocial>) => (r && r.ok ? r.url : null);
  const website = normalizeWebsite(values.website);
  return {
    whatsapp_number: whatsapp.ok ? whatsapp.e164 : null,
    phone_number: phone.ok ? phone.e164 : null,
    contact_email: values.contact_email || null,
    instagram_url: pick(normalizeSocial('instagram', values.instagram)),
    tiktok_url: pick(normalizeSocial('tiktok', values.tiktok)),
    facebook_url: pick(normalizeSocial('facebook', values.facebook)),
    website_url: website || null,
  };
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    const problem = validateSlug(value);
    if (problem) ctx.addIssue({ code: 'custom', message: SLUG_PROBLEM_MESSAGES[problem] });
  });

// ─── Catalogue items ─────────────────────────────────────────────────────────

export const itemSchema = z
  .object({
    title: z.string().trim().min(1, 'Give it a name.').max(100, 'Use at most 100 characters.'),
    description: z.string().trim().max(2000, 'Keep it under 2,000 characters.'),
    item_type: z.enum(ITEM_TYPES),
    category_id: z.string(),
    price_mode: z.enum(PRICE_MODES),
    price: z.string().trim(),
    availability_status: z.enum(AVAILABILITY_STATUSES),
    is_featured: z.boolean(),
    is_published: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!PRICE_MODE_OPTIONS[value.price_mode].needsPrice) return;
    if (!value.price) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Enter a price, or choose “Contact for price”.' });
      return;
    }
    const parsed = parsePriceInput(value.price);
    if (parsed === null) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Enter a number, e.g. 1500 or 1,500.' });
    else if (parsed >= 10_000_000_000) ctx.addIssue({ code: 'custom', path: ['price'], message: 'That price is too large.' });
  });
export type ItemValues = z.infer<typeof itemSchema>;

export function itemValuesToColumns(values: ItemValues) {
  const needsPrice = PRICE_MODE_OPTIONS[values.price_mode].needsPrice;
  return {
    title: values.title,
    description: values.description || null,
    item_type: values.item_type,
    category_id: values.category_id || null,
    price_mode: values.price_mode,
    price: needsPrice ? parsePriceInput(values.price) : null,
    availability_status: values.item_type === 'portfolio' ? 'available' : values.availability_status,
    is_featured: values.is_featured,
    is_published: values.is_published,
  } as const;
}

export const categoryNameSchema = z.object({
  name: z.string().trim().min(1, 'Enter a category name.').max(40, 'Use at most 40 characters.'),
});
export type CategoryNameValues = z.infer<typeof categoryNameSchema>;
