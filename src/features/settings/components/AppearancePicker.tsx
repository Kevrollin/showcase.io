import { Check } from 'lucide-react';
import { ACCENT_COLORS, STOREFRONT_THEMES, type AccentId, type StorefrontTheme, type ThemeId } from '@/config/catalog';
import { cn } from '@/lib/utils/cn';

function ThemeSketch({ theme, accent }: { theme: StorefrontTheme; accent: string }) {
  const block = 'rounded-[3px] bg-[#d9d3c7]';
  return (
    <div className="flex h-20 flex-col gap-1.5 overflow-hidden rounded-md bg-surface-muted p-2" aria-hidden="true">
      {theme.header === 'cover' ? (
        <div className="h-5 rounded-[3px] bg-[#cfc7b8]" />
      ) : (
        <div className={cn('flex items-center gap-1', theme.header === 'centered' && 'justify-center')}>
          <span className="size-3 rounded-[3px]" style={{ background: accent }} />
          <span className="h-1.5 w-10 rounded bg-[#bfb7a7]" />
        </div>
      )}
      {theme.layout === 'list' ? (
        <div className="space-y-1">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-1">
              <span className={cn(block, 'h-4 w-6')} />
              <span className="mt-0.5 h-1.5 flex-1 rounded bg-[#d9d3c7]" />
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('grid gap-1', theme.id === 'creative' ? 'grid-cols-3' : 'grid-cols-4')}>
          {Array.from({ length: theme.id === 'creative' ? 3 : 4 }, (_, i) => (
            <span key={i} className={block} style={{ aspectRatio: theme.imageAspect }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AppearancePicker({
  theme,
  accent,
  onThemeChange,
  onAccentChange,
}: {
  theme: ThemeId;
  accent: AccentId;
  onThemeChange: (theme: ThemeId) => void;
  onAccentChange: (accent: AccentId) => void;
}) {
  const accentValue = ACCENT_COLORS.find((a) => a.id === accent)?.value ?? ACCENT_COLORS[0]!.value;
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Storefront style</legend>
        <div role="radiogroup" aria-label="Storefront style" className="grid grid-cols-2 gap-3">
          {STOREFRONT_THEMES.map((t) => {
            const active = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onThemeChange(t.id)}
                className={cn(
                  'relative rounded-lg border bg-surface p-2.5 text-left transition-colors',
                  active ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border-strong',
                )}
              >
                <ThemeSketch theme={t} accent={accentValue} />
                <span className="mt-2 block text-sm font-semibold">{t.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t.description}</span>
                {active && (
                  <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Accent colour</legend>
        <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2.5">
          {ACCENT_COLORS.map((a) => {
            const active = a.id === accent;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={a.label}
                title={a.label}
                onClick={() => onAccentChange(a.id)}
                className={cn(
                  'flex size-11 items-center justify-center rounded-full border-2 transition-transform',
                  active ? 'scale-105 border-foreground' : 'border-transparent hover:scale-105',
                )}
              >
                <span className="flex size-8 items-center justify-center rounded-full" style={{ background: a.value }}>
                  {active && <Check className="size-4 text-white" aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
