import { Eye } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import type { AccentId, ThemeId } from '@/config/catalog';
import { CharacterCount } from '@/features/businesses/components/BusinessFields';
import { useCurrentBusiness, useUpdateBusiness } from '@/features/businesses/hooks';
import { useCategories, useItems } from '@/features/catalogue/hooks';
import { BrandImageField } from '@/features/media/BrandImageField';
import { previewItems, toPreviewBusiness } from '@/features/storefront/adapters';
import { PhonePreview } from '@/features/storefront/components/PhonePreview';
import { StorefrontView, type StorefrontFilters } from '@/features/storefront/components/StorefrontView';
import { usePageMeta } from '@/hooks/usePageMeta';
import { cn } from '@/lib/utils/cn';
import { toUserMessage } from '@/lib/utils/errors';
import { PageHeader } from '../dashboard/PageHeader';
import { AppearancePicker } from './components/AppearancePicker';

export function Component() {
  usePageMeta({ title: 'Storefront appearance', noindex: true });
  const business = useCurrentBusiness();
  const update = useUpdateBusiness();
  const items = useItems(business.id);
  const categories = useCategories(business.id);
  const [theme, setTheme] = useState<ThemeId>(business.theme_id);
  const [accent, setAccent] = useState<AccentId>(business.accent_color);
  const [tagline, setTagline] = useState(business.tagline ?? '');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [filters, setFilters] = useState<StorefrontFilters>({ search: '', categoryId: null, itemType: null });
  const [previewOpen, setPreviewOpen] = useState(false);

  const dirty = theme !== business.theme_id || accent !== business.accent_color || tagline.trim() !== (business.tagline ?? '');
  const preview = toPreviewBusiness({ ...business, theme_id: theme, accent_color: accent, tagline: tagline.trim() || null }, items.data ?? [], categories.data ?? []);
  const previewList = previewItems(items.data ?? [], filters);

  async function save() {
    if (tagline.trim().length > 80) {
      toast.error('Keep the tagline under 80 characters.');
      return;
    }
    try {
      await update.mutateAsync({ id: business.id, patch: { theme_id: theme, accent_color: accent, tagline: tagline.trim() || null } });
      toast.success('Storefront appearance saved.');
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const view = (
    <StorefrontView
      business={preview}
      items={previewList}
      total={previewList.length}
      status={items.isPending ? 'loading' : 'ready'}
      filters={filters}
      onFiltersChange={setFilters}
      preview
      logoSrc={logoPreview}
      coverSrc={coverPreview}
    />
  );

  return (
    <div>
      <PageHeader
        title="Storefront appearance"
        description="Choose how your storefront looks. Changes are previewed instantly."
        actions={
          <Button variant="secondary" className="lg:hidden" onClick={() => setPreviewOpen(true)}>
            <Eye /> Preview
          </Button>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Logo and cover" description="Uploaded images are saved straight away." />
            <CardBody className="space-y-8">
              <BrandImageField business={business} kind="logo" onPreviewChange={setLogoPreview} />
              <BrandImageField business={business} kind="cover" onPreviewChange={setCoverPreview} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Style" />
            <CardBody className="space-y-6">
              <Field
                label={
                  <span className="flex w-full items-baseline justify-between">
                    Tagline <CharacterCount value={tagline} max={80} />
                  </span>
                }
                optional
                hint="A short line under your name, e.g. “Fresh cakes for every occasion”."
              >
                <Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} />
              </Field>
              <AppearancePicker theme={theme} accent={accent} onThemeChange={setTheme} onAccentChange={setAccent} />
            </CardBody>
          </Card>
          {/* Floats above the content only while there are unsaved changes. */}
          <div className={cn('z-10 flex justify-end', dirty && 'sticky bottom-[calc(var(--sticky-bottom)+0.75rem)] lg:bottom-4')}>
            <Button size="lg" onClick={() => void save()} loading={update.isPending} disabled={!dirty} className={cn(dirty && 'shadow-md')}>
              Save appearance
            </Button>
          </div>
        </div>
        <div className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <p className="mb-3 text-center text-sm font-medium text-muted-foreground">Live preview</p>
          <PhonePreview>{view}</PhonePreview>
        </div>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen} title="Preview" description="This is how customers will see your storefront.">
        <div className="-mx-5 -my-5 max-h-[70dvh] overflow-y-auto">{view}</div>
      </Dialog>
    </div>
  );
}
