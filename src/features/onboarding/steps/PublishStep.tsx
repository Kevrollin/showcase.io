import { ImagePlus, MessageCircle, Package, Pencil, Store, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/field';
import { BUSINESS_TYPE_COPY } from '@/config/catalog';
import { SlugField } from '@/features/businesses/components/SlugField';
import { useSlugCheck } from '@/features/businesses/useSlugCheck';
import { useCategories, useItems } from '@/features/catalogue/hooks';
import { previewItems, toPreviewBusiness } from '@/features/storefront/adapters';
import { PhonePreview } from '@/features/storefront/components/PhonePreview';
import { StorefrontView } from '@/features/storefront/components/StorefrontView';
import { toUserMessage } from '@/lib/utils/errors';
import type { Business } from '@/types/models';
import { StepFooter, StepHeader } from '../WizardLayout';

const NO_FILTERS = { search: '', categoryId: null, itemType: null };

function Row({ icon, title, detail, action, warn }: { icon: ReactNode; title: string; detail: string; action: ReactNode; warn?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={warn ? 'text-warning' : 'text-muted-foreground'}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className={warn ? 'text-[0.8125rem] text-warning' : 'truncate text-[0.8125rem] text-muted-foreground'}>{detail}</p>
      </div>
      {action}
    </li>
  );
}

export function PublishStep({
  business,
  onEdit,
  onBack,
  onPublish,
}: {
  business: Business;
  onEdit: (step: number) => void;
  onBack: () => void;
  onPublish: (slug: string) => Promise<void>;
}) {
  const items = useItems(business.id);
  const categories = useCategories(business.id);
  const [slug, setSlug] = useState(business.slug);
  const slugCheck = useSlugCheck(slug, business.id, business.slug);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = BUSINESS_TYPE_COPY[business.business_type];
  const published = (items.data ?? []).filter((i) => i.is_published);
  const preview = toPreviewBusiness(business, items.data ?? [], categories.data ?? []);
  const slugOk = slugCheck.status === 'unchanged' || slugCheck.status === 'available';

  async function publish() {
    setError(null);
    setPublishing(true);
    try {
      await onPublish(slug.trim().toLowerCase());
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setPublishing(false);
    }
  }

  const edit = (step: number, label: string) => (
    <Button variant="ghost" size="sm" onClick={() => onEdit(step)} aria-label={label}>
      <Pencil /> Edit
    </Button>
  );

  return (
    <div>
      <StepHeader eyebrow="Almost there" title="Preview and publish" description="This is what customers will see when they open your link." />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <FormError message={error} />
          <SlugField value={slug} onChange={setSlug} status={slugCheck.status} message={slugCheck.message} />
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
            <Row icon={<Store className="size-5" />} title={business.name} detail={business.description ?? 'No description yet'} action={edit(2, 'Edit business details')} />
            <Row
              icon={business.whatsapp_number ? <MessageCircle className="size-5" /> : <TriangleAlert className="size-5" />}
              title="Contact"
              detail={business.whatsapp_number ? `WhatsApp ${business.whatsapp_number}` : 'Add WhatsApp so customers can reach you'}
              warn={!business.whatsapp_number}
              action={edit(3, 'Edit contact details')}
            />
            <Row
              icon={<ImagePlus className="size-5" />}
              title="Appearance"
              detail={business.logo_path ? 'Logo added' : 'No logo yet (optional)'}
              action={edit(4, 'Edit appearance')}
            />
            <Row
              icon={<Package className="size-5" />}
              title={copy.itemNounPlural.charAt(0).toUpperCase() + copy.itemNounPlural.slice(1)}
              detail={published.length === 0 ? `No ${copy.itemNounPlural} yet — you can add them after publishing` : `${published.length} ready to show`}
              action={
                <Button variant="ghost" size="sm" onClick={() => onEdit(5)}>
                  Add more
                </Button>
              }
            />
          </ul>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <PhonePreview>
            <StorefrontView
              business={preview}
              items={previewItems(items.data ?? [], NO_FILTERS)}
              total={preview.item_count}
              status={items.isPending ? 'loading' : 'ready'}
              filters={NO_FILTERS}
              onFiltersChange={() => undefined}
              preview
            />
          </PhonePreview>
        </div>
      </div>
      <StepFooter
        onBack={onBack}
        onContinue={() => void publish()}
        continueLabel="Publish storefront"
        continueDisabled={!slugOk}
        loading={publishing}
      />
    </div>
  );
}
