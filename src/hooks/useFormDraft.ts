import { useCallback, useEffect, useRef } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/**
 * Keeps unsaved form input in localStorage so a refresh or a dropped
 * connection never loses what the user typed. This is only a convenience
 * cache — the database is the source of truth once the user saves.
 */
export function useFormDraft<T extends FieldValues>(key: string | null, form: UseFormReturn<T>) {
  const restored = useRef<string | null>(null);

  useEffect(() => {
    if (!key || restored.current === key) return;
    restored.current = key;
    const draft = read(key);
    if (draft && typeof draft === 'object') {
      form.reset({ ...form.getValues(), ...(draft as Partial<T>) }, { keepDefaultValues: true });
    }
  }, [key, form]);

  useEffect(() => {
    if (!key) return;
    let timer: number | undefined;
    const subscription = form.watch((values) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          window.localStorage.setItem(key, JSON.stringify(values));
        } catch {
          // Quota or private mode: drafts are best-effort.
        }
      }, 400);
    });
    return () => {
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [key, form]);

  return useCallback(() => {
    if (!key) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore.
    }
  }, [key]);
}

export function readDraft<T>(key: string): Partial<T> | null {
  const value = read(key);
  return value && typeof value === 'object' ? (value as Partial<T>) : null;
}

export function writeDraft(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore.
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}
