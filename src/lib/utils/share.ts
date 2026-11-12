/** Copies text, falling back to a hidden textarea for older Android WebViews. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy method.
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function canNativeShare(data?: ShareData): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (data && typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare(data);
    } catch {
      return false;
    }
  }
  return true;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Web Share API with a copy-to-clipboard fallback. */
export async function shareOrCopy(data: { title: string; text?: string; url: string }): Promise<ShareOutcome> {
  if (canNativeShare(data)) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Some browsers expose share() but refuse it (e.g. insecure context); fall back.
    }
  }
  return (await copyText(data.url)) ? 'copied' : 'failed';
}
