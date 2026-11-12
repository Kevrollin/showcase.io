import { useEffect, useState } from 'react';
import { FormError } from '@/components/ui/field';
import type { AccentId, ThemeId } from '@/config/catalog';
import { useCategories, useItems } from '@/features/catalogue/hooks';
import { BrandImageField } from '@/features/media/BrandImageField';
import { AppearancePicker } from '@/features/settings/components/AppearancePicker';
import { previewItems, toPreviewBusiness } from '@/features/storefront/adapters';
import { PhonePreview } from '@/features/storefront/components/PhonePreview';
import { StorefrontView } from '@/features/storefront/components/StorefrontView';
import { clearDraft, readDraft, writeDraft } from '@/hooks/useFormDraft';
import { toUserMessage } from '@/lib/utils/errors';
import type { Business } from '@/types/models';
import { StepFooter, StepHeader } from '../WizardLayout';

const NO_FILTERS = { search: '', categoryId: null, itemType: null };

export function AppearanceStep({
  business,
  onBack,
  onSubmit,
}: {
  business: Business;
  onBack: () => void;
  onSubmit: (values: { theme_id: ThemeId; accent_color: AccentId }) => Promise<void>;
}) {
  const draftKey = `showcase:draft:appearance:${business.id}`;
  const [theme, setTheme] = useState<ThemeId>(() => readDraft<{ theme: ThemeId }>(draftKey)?.theme ?? business.theme_id);
  const [accent, setAccent] = useState<AccentId>(() => readDraft<{ accent: AccentId }>(draftKey)?.accent ?? business.accent_color);

  useEffect(() => {
    if (theme !== business.theme_id || accent !== business.accent_color) writeDraft(draftKey, { theme, accent });
  }, [theme, accent, business.theme_id, business.accent_color, draftKey]);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = useItems(business.id);
  const categories = useCategories(business.id);

  const previewBusiness = toPreviewBusiness({ ...business, theme_id: theme, accent_color: accent }, items.data ?? [], categories.data ?? []);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ theme_id: theme, accent_color: accent });
      clearDraft(draftKey);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHeader title="Make it look like you" description="Add your logo and pick a style. Everything here is optional and can be changed any time." />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <FormError message={error} />
          <BrandImageField business={business} kind="logo" onPreviewChange={setLogoPreview} />
          <BrandImageField business={business} kind="cover" onPreviewChange={setCoverPreview} />
          <AppearancePicker theme={theme} accent={accent} onThemeChange={setTheme} onAccentChange={setAccent} />
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-center text-sm font-medium text-muted-foreground">Live preview</p>
          <PhonePreview>
            <StorefrontView
              business={previewBusiness}
              items={previewItems(items.data ?? [], NO_FILTERS)}
              total={previewBusiness.item_count}
              status="ready"
              filters={NO_FILTERS}
              onFiltersChange={() => undefined}
              preview
              logoSrc={logoPreview}
              coverSrc={coverPreview}
            />
          </PhonePreview>
        </div>
      </div>
      <StepFooter onBack={onBack} onContinue={() => void submit()} loading={saving} />
    </div>
  );
}
