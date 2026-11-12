import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Segmented, Switch } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import {
  AVAILABILITY_LABELS,
  BUSINESS_TYPE_COPY,
  ITEM_TYPE_LABELS,
  PRICE_MODE_OPTIONS,
  PRICE_MODES_BY_ITEM_TYPE,
  type AvailabilityStatus,
  type ItemType,
} from '@/config/catalog';
import { useAuth } from '@/features/auth/auth-context';
import { usePlan } from '@/features/businesses/hooks';
import { CharacterCount } from '@/features/businesses/components/BusinessFields';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toUserMessage } from '@/lib/utils/errors';
import { formatMoney } from '@/lib/utils/price';
import { itemSchema, itemValuesToColumns, type ItemValues } from '@/lib/validation/schemas';
import { createItem, getItem, saveItemImages, updateItem, type ImageDraft } from '@/services/catalogue.service';
import type { Business, CatalogueImage, CatalogueItem, Category } from '@/types/models';
import { useCategoryMutations, useItemCache } from '../hooks';
import { revokeDraft } from '../imageDrafts';
import { ImageManager } from './ImageManager';

export type SaveIntent = 'close' | 'another';

interface ItemFormProps {
  business: Business;
  categories: Category[];
  item?: CatalogueItem;
  /** Called after the item and all its photos are saved. */
  onSaved: (item: CatalogueItem, intent: SaveIntent) => void;
  onCancel?: () => void;
  /** Onboarding: fewer options, no cards. */
  compact?: boolean;
  /** Offer "Save and add another". */
  allowAddAnother?: boolean;
  footerExtra?: ReactNode;
  submitLabel?: string;
}

function defaults(business: Business, item?: CatalogueItem): ItemValues {
  const type: ItemType = item?.item_type ?? BUSINESS_TYPE_COPY[business.business_type].defaultItemType;
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    item_type: type,
    category_id: item?.category_id ?? '',
    price_mode: item?.price_mode ?? PRICE_MODES_BY_ITEM_TYPE[type][0]!,
    price: item?.price != null ? String(item.price) : '',
    availability_status: item?.availability_status ?? 'available',
    is_featured: item?.is_featured ?? false,
    is_published: item?.is_published ?? true,
  };
}

const toExisting = (image: CatalogueImage): ImageDraft => ({ kind: 'existing', key: image.id, image });

function Section({ title, children, compact }: { title: string; children: ReactNode; compact?: boolean }) {
  if (compact) return <div className="space-y-5">{children}</div>;
  return (
    <section className="rounded-lg border border-border bg-surface shadow-xs">
      <h2 className="border-b border-border px-4 py-3 text-[0.9375rem] font-semibold sm:px-5">{title}</h2>
      <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}

export function ItemForm({
  business,
  categories,
  item,
  onSaved,
  onCancel,
  compact = false,
  allowAddAnother = false,
  footerExtra,
  submitLabel,
}: ItemFormProps) {
  const { user } = useAuth();
  const plan = usePlan();
  const cache = useItemCache(business.id);
  const categoryMutations = useCategoryMutations(business.id);

  const [current, setCurrent] = useState<CatalogueItem | undefined>(item);
  const [drafts, setDrafts] = useState<ImageDraft[]>(() => (item?.images ?? []).map(toExisting));
  const [removed, setRemoved] = useState<CatalogueImage[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const form = useForm<ItemValues>({ resolver: zodResolver(itemSchema), defaultValues: defaults(business, item) });
  const clearDraft = useFormDraft(`showcase:item-draft:${business.id}:${item?.id ?? 'new'}`, form);
  const { register, control, setValue, getValues, formState } = form;
  const errors = formState.errors;

  const itemType = useWatch({ control, name: 'item_type' });
  const priceMode = useWatch({ control, name: 'price_mode' });
  const price = useWatch({ control, name: 'price' });
  const title = useWatch({ control, name: 'title' });
  const description = useWatch({ control, name: 'description' }) ?? '';
  const noun = ITEM_TYPE_LABELS[itemType].label.toLowerCase();
  const allowedModes = PRICE_MODES_BY_ITEM_TYPE[itemType];
  const needsPrice = PRICE_MODE_OPTIONS[priceMode].needsPrice;
  const availabilityOptions = Object.entries(AVAILABILITY_LABELS[itemType]) as Array<[AvailabilityStatus, string]>;

  function changeType(type: ItemType) {
    setValue('item_type', type, { shouldDirty: true });
    if (!PRICE_MODES_BY_ITEM_TYPE[type].includes(priceMode)) setValue('price_mode', PRICE_MODES_BY_ITEM_TYPE[type][0]!, { shouldDirty: true });
    if (type === 'service' && getValues('availability_status') === 'preorder') setValue('availability_status', 'available');
  }

  async function save(values: ItemValues, intent: SaveIntent) {
    if (!user) return;
    setFormError(null);
    setSaving(true);
    setFailed({});
    setProgress({});
    try {
      const columns = itemValuesToColumns(values);
      const saved = current ? await updateItem(current.id, columns) : await createItem({ business_id: business.id, ...columns });
      setCurrent(saved);

      const result = await saveItemImages({
        userId: user.id,
        businessId: business.id,
        itemId: saved.id,
        altText: values.title,
        drafts,
        removed,
        onProgress: (key, fraction) => setProgress((p) => ({ ...p, [key]: fraction })),
      });
      setRemoved([]);
      const fresh = (await getItem(saved.id)) ?? saved;
      setCurrent(fresh);
      cache.upsert(fresh);

      if (result.failed.length > 0) {
        const failedKeys = new Set(result.failed.map((f) => f.key));
        drafts.filter((d) => d.kind === 'new' && !failedKeys.has(d.key)).forEach(revokeDraft);
        setDrafts([...fresh.images.map(toExisting), ...drafts.filter((d) => d.kind === 'new' && failedKeys.has(d.key))]);
        setFailed(Object.fromEntries(result.failed.map((f) => [f.key, f.message])));
        toast.error(`Saved, but ${result.failed.length} photo${result.failed.length === 1 ? '' : 's'} didn't upload. Press save to retry.`);
        return;
      }

      drafts.forEach(revokeDraft);
      clearDraft();
      toast.success(item ? 'Changes saved.' : `${ITEM_TYPE_LABELS[values.item_type].label} added successfully.`);
      onSaved(fresh, intent);
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const category = await categoryMutations.create.mutateAsync(name);
      setValue('category_id', category.id, { shouldDirty: true });
      setNewCategoryName('');
      setNewCategoryOpen(false);
      toast.success(`Category “${category.name}” created.`);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const showTypePicker = business.business_type === 'mixed' || Boolean(item && item.item_type !== BUSINESS_TYPE_COPY[business.business_type].defaultItemType);
  const typeOptions = (['product', 'service', 'portfolio'] as ItemType[]).map((t) => ({ value: t, label: ITEM_TYPE_LABELS[t].label }));

  return (
    <form onSubmit={form.handleSubmit((v) => save(v, 'close'))} noValidate className="space-y-5">
      <FormError message={formError} />

      <Section title="Details" compact={compact}>
        {(showTypePicker || !compact) && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium" id="item-type-label">
              What is it?
            </p>
            <Segmented label="Item type" value={itemType} onChange={changeType} options={typeOptions} />
          </div>
        )}
        <Field label={`${ITEM_TYPE_LABELS[itemType].label} name`} error={errors.title?.message}>
          <Input
            placeholder={itemType === 'product' ? 'e.g. Nike Air Max 90' : itemType === 'service' ? 'e.g. Logo design' : 'e.g. Graduation shoot 2026'}
            maxLength={100}
            {...register('title')}
          />
        </Field>
        <Field
          label={
            <span className="flex w-full items-baseline justify-between">
              Description <CharacterCount value={description} max={2000} />
            </span>
          }
          optional
          hint={itemType === 'product' ? 'Sizes, colours, condition, what is included…' : itemType === 'service' ? 'What the customer gets, how long it takes…' : 'The brief, your role, the result…'}
          error={errors.description?.message}
        >
          <Textarea rows={compact ? 3 : 4} {...register('description')} />
        </Field>
      </Section>

      <Section title="Photos" compact={compact}>
        <ImageManager
          drafts={drafts}
          onChange={setDrafts}
          onRemoveExisting={(d) => setRemoved((r) => [...r, d.image])}
          maxImages={plan.data?.max_images_per_item ?? 8}
          progress={progress}
          failed={failed}
          saving={saving}
          itemTitle={title || 'Item'}
        />
      </Section>

      <Section title="Price and availability" compact={compact}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Price" error={errors.price_mode?.message}>
            <Select {...register('price_mode')}>
              {allowedModes.map((mode) => (
                <option key={mode} value={mode}>
                  {PRICE_MODE_OPTIONS[mode].label}
                </option>
              ))}
            </Select>
          </Field>
          {needsPrice && (
            <Field
              label={priceMode === 'starting_from' ? 'Starting price' : 'Amount'}
              hint={price && !errors.price ? `Shows as “${priceMode === 'starting_from' ? 'From ' : ''}${formatMoney(Number(price.replace(/[^\d.]/g, '')) || 0)}”` : undefined}
              error={errors.price?.message}
            >
              <Input leading="KES" inputMode="decimal" placeholder="1,500" autoComplete="off" {...register('price')} />
            </Field>
          )}
        </div>
        {!needsPrice && <p className="-mt-2 text-[0.8125rem] text-muted-foreground">{PRICE_MODE_OPTIONS[priceMode].hint}</p>}
        {itemType !== 'portfolio' && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Availability</p>
            <Controller
              control={control}
              name="availability_status"
              render={({ field }) => (
                <Segmented
                  label="Availability"
                  value={field.value}
                  onChange={field.onChange}
                  options={availabilityOptions.map(([value, label]) => ({ value, label }))}
                />
              )}
            />
          </div>
        )}
      </Section>

      <Section title="Organise" compact={compact}>
        <Field label="Category" optional hint={categories.length === 0 ? 'Group similar items, e.g. “Shoes” or “Logos”.' : undefined}>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select {...register('category_id')} aria-label="Category">
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="secondary" onClick={() => setNewCategoryOpen(true)} aria-label="Create a new category">
              <Plus /> <span className="hidden sm:inline">New</span>
            </Button>
          </div>
        </Field>
        {!compact && (
          <>
            <Controller
              control={control}
              name="is_featured"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium" id="featured-label">Feature this {noun}</p>
                    <p className="text-[0.8125rem] text-muted-foreground">Featured items appear first with a star.</p>
                  </div>
                  <Switch checked={field.value} onCheckedChange={field.onChange} label={`Feature this ${noun}`} />
                </div>
              )}
            />
            <Controller
              control={control}
              name="is_published"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Show on storefront</p>
                    <p className="text-[0.8125rem] text-muted-foreground">Turn off to keep it as a private draft.</p>
                  </div>
                  <Switch checked={field.value} onCheckedChange={field.onChange} label="Show on storefront" />
                </div>
              )}
            />
          </>
        )}
      </Section>

      {/* Sticks above the dashboard's bottom navigation on phones (see --sticky-bottom). */}
      <div className="sticky bottom-(--sticky-bottom) z-20 -mx-4 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        {footerExtra}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="hidden sm:inline-flex">
            Cancel
          </Button>
        )}
        <div className="ml-auto flex flex-1 gap-2 sm:flex-none">
          {allowAddAnother && (
            <Button type="button" variant="secondary" disabled={saving} className="flex-1 sm:flex-none" onClick={form.handleSubmit((v) => save(v, 'another'))}>
              Save &amp; add new
            </Button>
          )}
          <Button type="submit" loading={saving} className="flex-1 sm:flex-none">
            {saving ? 'Saving…' : (submitLabel ?? (item || current ? 'Save changes' : `Add ${noun}`))}
          </Button>
        </div>
      </div>

      <Dialog
        open={newCategoryOpen}
        onOpenChange={setNewCategoryOpen}
        title="New category"
        description="Categories help customers find what they want."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewCategoryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createCategory()} loading={categoryMutations.create.isPending} disabled={!newCategoryName.trim()}>
              Create category
            </Button>
          </>
        }
      >
        <Field label="Category name">
          <Input
            value={newCategoryName}
            maxLength={40}
            autoFocus
            placeholder="e.g. Shoes"
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void createCategory();
              }
            }}
          />
        </Field>
      </Dialog>
    </form>
  );
}
