/**
 * Converts any error (Supabase Auth, PostgREST, Storage, network, our own) into
 * a short, human message. Raw database errors are never shown to users.
 *
 * Deliberately shape-based (no supabase-js imports) so public pages can use it
 * without pulling the SDK into their bundle.
 */

export const GENERIC_ERROR = 'Something went wrong. Please try again.';
export const NETWORK_ERROR = "We couldn't reach the server. Check your internet connection and try again.";

/** An error whose message is already safe to show. */
export class AppError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'The email or password is incorrect.',
  invalid_grant: 'The email or password is incorrect.',
  email_not_confirmed: 'Please confirm your email address first. Check your inbox for the confirmation link.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  email_exists: 'An account with this email already exists. Try signing in instead.',
  weak_password: 'Choose a stronger password: at least 8 characters, mixing letters and numbers.',
  over_email_send_rate_limit: 'Too many emails sent. Please wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  over_sms_send_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  otp_expired: 'This link has expired or has already been used. Please request a new one.',
  flow_state_expired: 'This link has expired. Please request a new one.',
  flow_state_not_found: 'This link is no longer valid. Please request a new one.',
  bad_code_verifier: 'Please open the link on the same device and browser you used to request it.',
  same_password: 'Your new password must be different from your current password.',
  email_address_invalid: 'Enter a valid email address.',
  email_address_not_authorized: 'Emails cannot be sent to this address yet. Please contact support.',
  signup_disabled: 'New sign-ups are currently closed.',
  session_not_found: 'Your session has expired. Please sign in again.',
  session_expired: 'Your session has expired. Please sign in again.',
  refresh_token_not_found: 'Your session has expired. Please sign in again.',
  refresh_token_already_used: 'Your session has expired. Please sign in again.',
  user_not_found: 'We could not find that account.',
  reauthentication_needed: 'Please sign in again to continue.',
};

const DB_MESSAGES: Record<string, string> = {
  PLAN_LIMIT_BUSINESSES: 'Your current plan includes one business. Manage it from your dashboard.',
  PLAN_LIMIT_PUBLISHED: 'Your current plan allows one published storefront. Unpublish your other storefront first.',
  PLAN_LIMIT_ITEMS: 'You have reached the maximum number of items for your plan.',
  PLAN_LIMIT_IMAGES: 'You have reached the maximum number of images for this item.',
  INVALID_MEDIA_PATH: 'That image could not be saved. Please upload it again.',
  NOT_AUTHENTICATED: 'Please sign in to continue.',
  REAUTHENTICATION_REQUIRED: 'For your security, please confirm it’s you again before deleting your account.',
};

const UNIQUE_MESSAGES: Array<[RegExp, string]> = [
  [/businesses_slug_key/, 'That storefront link is already taken. Try a different one.'],
  [/categories_business_name_key/, 'You already have a category with this name.'],
  [/catalogue_items_business_slug_key/, 'An item with a similar name already exists. Try again.'],
];

const CHECK_MESSAGES: Array<[RegExp, string]> = [
  [/businesses_slug_(format|not_reserved)/, 'That storefront link is not allowed. Use letters, numbers and hyphens.'],
  [/whatsapp_number|phone_number/, 'Please enter a valid phone number.'],
  [/instagram_url|tiktok_url|facebook_url|website_url/, 'Please check your social media links.'],
  [/contact_email/, 'Please enter a valid email address.'],
  [/price_matches_mode/, 'Please enter a price, or choose a different price option.'],
];

interface ErrorShape {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  details?: unknown;
  error?: unknown;
}

function asShape(error: unknown): ErrorShape | null {
  return typeof error === 'object' && error !== null ? (error as ErrorShape) : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

export function isNetworkError(error: unknown): boolean {
  const e = asShape(error);
  const name = str(e?.name);
  const message = str(e?.message);
  if (name === 'AuthRetryableFetchError') return true;
  if (error instanceof TypeError && /fetch|network|load failed/i.test(message)) return true;
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) return true;
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function errorCode(error: unknown): string {
  const e = asShape(error);
  return str(e?.code);
}

export function toUserMessage(error: unknown, fallback: string = GENERIC_ERROR): string {
  if (error instanceof AppError) return error.message;
  if (isNetworkError(error)) return NETWORK_ERROR;

  const e = asShape(error);
  if (!e) return fallback;
  const code = str(e.code);
  const message = str(e.message);
  const details = str(e.details);
  const status = str(e.status) || str(e.statusCode);

  // Supabase Auth
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (/invalid login credentials/i.test(message)) return AUTH_MESSAGES.invalid_credentials!;
  if (/email not confirmed/i.test(message)) return AUTH_MESSAGES.email_not_confirmed!;
  if (/user already registered/i.test(message)) return AUTH_MESSAGES.user_already_exists!;
  if (/password should (be|contain)/i.test(message)) return AUTH_MESSAGES.weak_password!;
  if (/jwt expired|invalid jwt/i.test(message) || code === 'PGRST301' || code === 'PGRST303') {
    return AUTH_MESSAGES.session_expired!;
  }

  // Our own database exceptions (RAISE … USING MESSAGE = 'PLAN_LIMIT_…').
  if (DB_MESSAGES[message]) return DB_MESSAGES[message];

  // PostgreSQL error codes via PostgREST.
  if (code === '23505') {
    const haystack = `${message} ${details}`;
    return UNIQUE_MESSAGES.find(([re]) => re.test(haystack))?.[1] ?? 'This already exists.';
  }
  if (code === '23514' || code === '22001' || code === '22P02' || code === '23502') {
    return CHECK_MESSAGES.find(([re]) => re.test(message))?.[1] ?? 'Some details are not valid. Please review the form.';
  }
  if (code === '23503') return 'This item is linked to something that no longer exists. Refresh and try again.';
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return "You don't have permission to do that. Try signing in again.";
  }
  if (code === 'PGRST116') return 'We could not find what you were looking for.';

  // Supabase Storage
  if (status === '413' || /exceeded the maximum allowed size|payload too large/i.test(message)) {
    return 'This image is too large. Please choose a smaller one.';
  }
  if (/mime type|invalid_mime_type/i.test(message) || status === '415') {
    return 'Only JPEG, PNG or WebP images can be uploaded.';
  }
  if (status === '429') return 'Too many attempts. Please wait a minute and try again.';

  return fallback;
}
