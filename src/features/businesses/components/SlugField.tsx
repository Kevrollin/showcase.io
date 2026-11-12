import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { useId } from 'react';
import { BRAND } from '@/config/brand';
import { displayUrl, siteOrigin } from '@/config/site';
import { cn } from '@/lib/utils/cn';
import { slugify } from '@/lib/utils/slug';
import type { SlugStatus } from '../useSlugCheck';

export function SlugField({
  value,
  onChange,
  status,
  message,
}: {
  value: string;
  onChange: (value: string) => void;
  status: SlugStatus;
  message: string | null;
}) {
  const id = useId();
  const prefix = `${displayUrl(siteOrigin())}${BRAND.storefrontPrefix}/`;
  const tone = status === 'available' ? 'text-success' : status === 'invalid' || status === 'taken' || status === 'error' ? 'text-danger' : 'text-muted-foreground';
  const Icon = status === 'available' ? CircleCheck : status === 'checking' ? LoaderCircle : status === 'unchanged' ? null : CircleX;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Your storefront link
      </label>
      <div className="flex h-11 items-center overflow-hidden rounded-md border border-border-strong bg-surface shadow-xs focus-within:border-gold-strong">
        <span className="hidden h-full shrink-0 items-center border-r border-border bg-surface-muted px-3 text-sm text-muted-foreground sm:flex">{prefix}</span>
        <span className="flex h-full shrink-0 items-center pl-3 text-sm text-muted-foreground sm:hidden">{BRAND.storefrontPrefix}/</span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(slugify(e.target.value.replace(/\s/g, '-')) + (e.target.value.endsWith('-') ? '-' : ''))}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={48}
          aria-invalid={status === 'invalid' || status === 'taken' ? true : undefined}
          aria-describedby={`${id}-status`}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-[0.9375rem] outline-none"
        />
      </div>
      <p id={`${id}-status`} className={cn('flex items-center gap-1.5 text-[0.8125rem]', tone)} aria-live="polite">
        {Icon && <Icon className={cn('size-3.5', status === 'checking' && 'animate-spin')} aria-hidden="true" />}
        {message ?? 'Lowercase letters, numbers and hyphens.'}
      </p>
    </div>
  );
}
