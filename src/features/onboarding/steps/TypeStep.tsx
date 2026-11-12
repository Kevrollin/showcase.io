import { Briefcase, Check, Images, Layers, ShoppingBag, type LucideIcon } from 'lucide-react';
import { BUSINESS_TYPE_COPY, BUSINESS_TYPES, type BusinessType } from '@/config/catalog';
import { cn } from '@/lib/utils/cn';
import { StepFooter, StepHeader } from '../WizardLayout';

const ICONS: Record<BusinessType, LucideIcon> = {
  products: ShoppingBag,
  services: Briefcase,
  portfolio: Images,
  mixed: Layers,
};

export function TypeStep({
  value,
  onChange,
  onContinue,
  saving,
}: {
  value: BusinessType | null;
  onChange: (type: BusinessType) => void;
  onContinue: () => void;
  saving?: boolean;
}) {
  return (
    <div>
      <StepHeader eyebrow="Let's get started" title="What would you like to showcase?" description="This helps us use the right words and fields. You can change it later." />
      <div role="radiogroup" aria-label="What would you like to showcase?" className="grid gap-3 sm:grid-cols-2">
        {BUSINESS_TYPES.map((type) => {
          const Icon = ICONS[type];
          const copy = BUSINESS_TYPE_COPY[type];
          const active = value === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(type)}
              onDoubleClick={() => {
                onChange(type);
                onContinue();
              }}
              className={cn(
                'relative flex items-start gap-4 rounded-lg border bg-surface p-4 text-left shadow-xs transition-all sm:flex-col sm:gap-3 sm:p-5',
                active ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border-strong hover:shadow-sm',
              )}
            >
              <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary text-white' : 'bg-gold-soft text-gold-strong')}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 pr-6">
                <span className="block font-semibold">{copy.label}</span>
                <span className="mt-1 block text-sm leading-snug text-muted-foreground">{copy.description}</span>
              </span>
              {active && (
                <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <StepFooter onContinue={onContinue} continueDisabled={!value} loading={saving} />
    </div>
  );
}
