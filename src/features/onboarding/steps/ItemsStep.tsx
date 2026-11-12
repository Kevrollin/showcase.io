import { ArrowLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { MediaImage } from '@/components/shared/MediaImage';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { BUSINESS_TYPE_COPY } from '@/config/catalog';
import { ItemForm } from '@/features/catalogue/components/ItemForm';
import { useCategories, useItems } from '@/features/catalogue/hooks';
import { formatPrice } from '@/lib/utils/price';
import type { Business } from '@/types/models';
import { StepFooter, StepHeader } from '../WizardLayout';

export function ItemsStep({ business, onBack, onContinue }: { business: Business; onBack: () => void; onContinue: () => Promise<void> }) {
  const items = useItems(business.id);
  const categories = useCategories(business.id);
  const [formKey, setFormKey] = useState(0);
  const [adding, setAdding] = useState<boolean | null>(null);
  const [continuing, setContinuing] = useState(false);
  const copy = BUSINESS_TYPE_COPY[business.business_type];
  const list = items.data ?? [];
  const showForm = adding ?? list.length === 0;

  async function next() {
    setContinuing(true);
    try {
      await onContinue();
    } finally {
      setContinuing(false);
    }
  }

  if (items.isPending || categories.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div>
      <StepHeader
        title={list.length === 0 ? `Add your first ${copy.itemNoun}` : `Your ${copy.itemNounPlural}`}
        description={
          list.length === 0
            ? `Add one or two ${copy.itemNounPlural} now. You can add the rest later from your dashboard.`
            : `You've added ${list.length} ${list.length === 1 ? copy.itemNoun : copy.itemNounPlural}. Add more or continue.`
        }
      />

      {list.length > 0 && (
        <ul className="mb-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {list.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3">
              <MediaImage
                path={item.images[0]?.thumb_path ?? item.images[0]?.storage_path}
                alt=""
                aspect="1 / 1"
                className="w-12 shrink-0 rounded-md"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-[0.8125rem] text-muted-foreground">{formatPrice(item.price_mode, item.price, item.currency) ?? 'No price shown'}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5">
          <ItemForm
            key={formKey}
            business={business}
            categories={categories.data ?? []}
            compact
            submitLabel={`Save ${copy.itemNoun}`}
            onSaved={() => {
              // Show what was added, with "Add another" and "Continue".
              setFormKey((k) => k + 1);
              setAdding(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            footerExtra={
              list.length > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              ) : (
                <>
                  <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="sm:hidden">
                    <ArrowLeft />
                  </Button>
                  <Button type="button" variant="ghost" onClick={onBack} className="hidden sm:inline-flex">
                    <ArrowLeft /> Back
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void next()}>
                    Skip for now
                  </Button>
                </>
              )
            }
          />
        </div>
      ) : (
        <>
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus /> Add another {copy.itemNoun}
          </Button>
          <StepFooter onBack={onBack} onContinue={() => void next()} loading={continuing} />
        </>
      )}
    </div>
  );
}
