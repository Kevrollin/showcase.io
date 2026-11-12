import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Check, FolderTree, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { BUSINESS_TYPE_COPY, type BusinessType } from '@/config/catalog';
import { useCurrentBusiness } from '@/features/businesses/hooks';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toUserMessage } from '@/lib/utils/errors';
import { categoryNameSchema, type CategoryNameValues } from '@/lib/validation/schemas';
import type { Category } from '@/types/models';
import { useCategories, useCategoryMutations, useItems } from '../catalogue/hooks';
import { PageHeader } from '../dashboard/PageHeader';

const EXAMPLES: Record<BusinessType, string> = {
  products: 'Men’s wear, Women’s wear, Shoes, Accessories',
  services: 'Logos, Flyers, Posters, Branding',
  portfolio: 'Events, Portraits, Graduation, Product photography',
  mixed: 'Printing, Merchandise, Design services',
};

function CategoryRow({
  category,
  count,
  index,
  total,
  onMove,
  onDelete,
  rename,
}: {
  category: Category;
  count: number;
  index: number;
  total: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (category: Category) => void;
  rename: (id: string, name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(category.name);
  const [saving, setSaving] = useState(false);

  async function save() {
    const name = value.trim();
    if (!name || name === category.name) {
      setEditing(false);
      setValue(category.name);
      return;
    }
    setSaving(true);
    try {
      await rename(category.id, name);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
      <div className="flex flex-col">
        <Button variant="ghost" size="icon-sm" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move ${category.name} up`}>
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onMove(index, 1)} disabled={index === total - 1} aria-label={`Move ${category.name} down`}>
          <ArrowDown />
        </Button>
      </div>
      {editing ? (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} autoFocus aria-label="Category name" className="h-10" />
          <Button type="submit" size="icon" variant="primary" loading={saving} aria-label="Save name">
            {!saving && <Check />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cancel renaming"
            onClick={() => {
              setEditing(false);
              setValue(category.name);
            }}
          >
            <X />
          </Button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{category.name}</p>
            <p className="text-[0.8125rem] text-muted-foreground">
              {count} {count === 1 ? 'item' : 'items'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label={`Rename ${category.name}`}>
            <Pencil />
          </Button>
          <Button variant="danger-ghost" size="icon" onClick={() => onDelete(category)} aria-label={`Delete ${category.name}`}>
            <Trash2 />
          </Button>
        </>
      )}
    </li>
  );
}

export function Component() {
  usePageMeta({ title: 'Categories', noindex: true });
  const business = useCurrentBusiness();
  const categories = useCategories(business.id);
  const items = useItems(business.id);
  const { create, rename, remove, reorder } = useCategoryMutations(business.id);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const form = useForm<CategoryNameValues>({ resolver: zodResolver(categoryNameSchema), defaultValues: { name: '' } });

  const list = categories.data ?? [];
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items.data ?? []) if (item.category_id) map.set(item.category_id, (map.get(item.category_id) ?? 0) + 1);
    return map;
  }, [items.data]);
  const uncategorised = (items.data ?? []).filter((i) => !i.category_id).length;

  async function add(values: CategoryNameValues) {
    try {
      const category = await create.mutateAsync(values.name);
      form.reset({ name: '' });
      toast.success(`Category “${category.name}” created.`);
    } catch (error) {
      form.setError('name', { message: toUserMessage(error) });
    }
  }

  async function doRename(id: string, name: string) {
    try {
      await rename.mutateAsync({ id, name });
      toast.success('Category renamed.');
    } catch (error) {
      toast.error(toUserMessage(error));
      throw error;
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...list];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorder.mutate(next, { onError: (error) => toast.error(toUserMessage(error)) });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync({ category: toDelete, moveTo: moveTo || null });
      toast.success(`Category “${toDelete.name}” deleted. Its items were kept.`);
      setMoveTo('');
    } catch (error) {
      toast.error(toUserMessage(error));
      throw error;
    }
  }

  const deleteCount = toDelete ? (counts.get(toDelete.id) ?? 0) : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Categories" description="Group your catalogue so customers can find things faster. Categories are optional." />

      <Card className="mb-6 p-4 sm:p-5">
        <form onSubmit={form.handleSubmit(add)} noValidate className="flex items-start gap-2">
          <div className="flex-1">
            <Field label="New category" hideLabel error={form.formState.errors.name?.message}>
              <Input placeholder={`e.g. ${EXAMPLES[business.business_type].split(', ')[0]}`} maxLength={40} {...form.register('name')} />
            </Field>
          </div>
          <Button type="submit" loading={create.isPending}>
            <Plus /> Add
          </Button>
        </form>
      </Card>

      {categories.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface">
          <EmptyState icon={FolderTree} title="No categories yet" description={`For example: ${EXAMPLES[business.business_type]}.`} />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
            {list.map((category, index) => (
              <CategoryRow
                key={category.id}
                category={category}
                count={counts.get(category.id) ?? 0}
                index={index}
                total={list.length}
                onMove={move}
                onDelete={(c) => {
                  setMoveTo('');
                  setToDelete(c);
                }}
                rename={doRename}
              />
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            {uncategorised} {uncategorised === 1 ? 'item is' : 'items are'} uncategorised. Customers see categories in this order.
          </p>
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete “${toDelete?.name ?? ''}”?`}
        description={
          deleteCount > 0
            ? `Your ${deleteCount} ${deleteCount === 1 ? 'item' : 'items'} in this category will not be deleted. Choose where to move ${deleteCount === 1 ? 'it' : 'them'}.`
            : 'This category has no items. Deleting it cannot be undone.'
        }
        confirmLabel="Delete category"
        onConfirm={confirmDelete}
      >
        {deleteCount > 0 && (
          <Field label={`Move ${BUSINESS_TYPE_COPY[business.business_type].itemNounPlural} to`}>
            <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Uncategorised</option>
              {list
                .filter((c) => c.id !== toDelete?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
      </ConfirmDialog>
    </div>
  );
}
