import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CircleCheck,
  Clock,
  CopyPlus,
  EllipsisVertical,
  Link2,
  Package,
  Pencil,
  Plus,
  Search,
  SearchX,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MediaImage } from '@/components/shared/MediaImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, Skeleton, Switch } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { AVAILABILITY_LABELS, BUSINESS_TYPE_COPY, ITEM_TYPE_LABELS, type AvailabilityStatus } from '@/config/catalog';
import { itemUrl } from '@/config/site';
import { useAuth } from '@/features/auth/auth-context';
import { useCurrentBusiness } from '@/features/businesses/hooks';
import { usePageMeta } from '@/hooks/usePageMeta';
import { cn } from '@/lib/utils/cn';
import { toUserMessage } from '@/lib/utils/errors';
import { formatPrice } from '@/lib/utils/price';
import { copyText } from '@/lib/utils/share';
import type { CatalogueItem } from '@/types/models';
import { PageHeader } from '../dashboard/PageHeader';
import { useCategories, useDeleteItem, useDuplicateItem, useItems, useReorderItems, useUpdateItem } from './hooks';

type StatusFilter = 'all' | 'published' | 'hidden';

export function Component() {
  usePageMeta({ title: 'Catalogue', noindex: true });
  const business = useCurrentBusiness();
  const { user } = useAuth();
  const navigate = useNavigate();
  const items = useItems(business.id);
  const categories = useCategories(business.id);
  const update = useUpdateItem(business.id);
  const remove = useDeleteItem(business.id);
  const duplicate = useDuplicateItem(business.id, user?.id ?? '');
  const reorder = useReorderItems(business.id);
  const copy = BUSINESS_TYPE_COPY[business.business_type];

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [availability, setAvailability] = useState<'all' | AvailabilityStatus>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [reordering, setReordering] = useState(false);
  const [toDelete, setToDelete] = useState<CatalogueItem | null>(null);

  const all = useMemo(() => items.data ?? [], [items.data]);
  const categoryNames = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name])), [categories.data]);
  const filtering = Boolean(search.trim()) || category !== 'all' || availability !== 'all' || status !== 'all';

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter(
      (i) =>
        (!term || i.title.toLowerCase().includes(term)) &&
        (category === 'all' || (category === 'none' ? !i.category_id : i.category_id === category)) &&
        (availability === 'all' || i.availability_status === availability) &&
        (status === 'all' || (status === 'published' ? i.is_published : !i.is_published)),
    );
  }, [all, search, category, availability, status]);

  function clearFilters() {
    setSearch('');
    setCategory('all');
    setAvailability('all');
    setStatus('all');
  }

  async function patch(item: CatalogueItem, changes: Parameters<typeof update.mutateAsync>[0]['patch'], success: string) {
    try {
      await update.mutateAsync({ id: item.id, patch: changes });
      toast.success(success);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...all];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorder.mutate(next, { onError: (error) => toast.error(toUserMessage(error)) });
  }

  async function copyItemLink(item: CatalogueItem) {
    const ok = await copyText(itemUrl(business.slug, item.slug));
    if (ok) toast.success('Item link copied.');
    else toast.error("Couldn't copy the link.");
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete);
      toast.success(`“${toDelete.title}” was deleted.`);
    } catch (error) {
      toast.error(toUserMessage(error));
      throw error;
    }
  }

  const header = (
    <PageHeader
      title={copy.catalogueLabel}
      description={all.length > 0 ? `${all.length} ${all.length === 1 ? copy.itemNoun : copy.itemNounPlural}` : undefined}
      actions={
        <>
          {all.length > 1 && (
            <Button variant={reordering ? 'primary' : 'secondary'} onClick={() => setReordering((v) => !v)} disabled={filtering} title={filtering ? 'Clear filters to reorder' : undefined}>
              <ArrowUpDown /> {reordering ? 'Done' : 'Reorder'}
            </Button>
          )}
          <Button asChild>
            <Link to="/dashboard/catalogue/new">
              <Plus /> Add {copy.itemNoun}
            </Link>
          </Button>
        </>
      }
    />
  );

  if (items.isPending) {
    return (
      <div>
        {header}
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (items.isError) {
    return (
      <div>
        {header}
        <EmptyState icon={Package} title="We couldn't load your catalogue" description={toUserMessage(items.error)} action={<Button onClick={() => void items.refetch()}>Try again</Button>} />
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <div>
        {header}
        <div className="rounded-lg border border-dashed border-border-strong bg-surface">
          <EmptyState
            icon={Package}
            title={`No ${copy.itemNounPlural} yet`}
            description={`Add your first ${copy.itemNoun} with a few photos. It takes about a minute.`}
            action={
              <Button asChild>
                <Link to="/dashboard/catalogue/new">
                  <Plus /> Add your first {copy.itemNoun}
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}

      {!reordering && (
        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${copy.itemNounPlural}`}
            aria-label={`Search ${copy.itemNounPlural}`}
            leading={<Search className="size-4" aria-hidden="true" />}
            className="pl-10"
          />
          <div className="grid grid-cols-3 gap-2 sm:contents">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" className="sm:w-44">
              <option value="all">All categories</option>
              <option value="none">Uncategorised</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={availability} onChange={(e) => setAvailability(e.target.value as typeof availability)} aria-label="Filter by availability" className="sm:w-40">
              <option value="all">Any availability</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="preorder">Pre-order</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by visibility" className="sm:w-36">
              <option value="all">All</option>
              <option value="published">Showing</option>
              <option value="hidden">Hidden</option>
            </Select>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={SearchX} title="No matches" description="Try a different search or clear the filters." action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
          {visible.map((item, index) => {
            const price = formatPrice(item.price_mode, item.price, item.currency);
            const availabilityText = AVAILABILITY_LABELS[item.item_type][item.availability_status];
            const cover = item.images[0];
            return (
              <li key={item.id} className={cn('flex items-center gap-3 p-3 sm:gap-4 sm:px-4', !item.is_published && 'bg-surface-muted/60')}>
                {reordering && (
                  <div className="flex flex-col">
                    <Button variant="ghost" size="icon-sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${item.title} up`}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => move(index, 1)} disabled={index === visible.length - 1} aria-label={`Move ${item.title} down`}>
                      <ArrowDown />
                    </Button>
                  </div>
                )}
                <Link to={`/dashboard/catalogue/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  <MediaImage path={cover?.thumb_path ?? cover?.storage_path} alt="" aspect="1 / 1" className={cn('w-14 shrink-0 rounded-md sm:w-16', !item.is_published && 'opacity-60')} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {item.is_featured && <Star className="size-3.5 shrink-0 fill-gold text-gold" aria-label="Featured" />}
                      <span className="truncate">{item.title}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
                      {[price ?? 'No price shown', item.category_id ? categoryNames.get(item.category_id) : null, business.business_type === 'mixed' ? ITEM_TYPE_LABELS[item.item_type].label : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {!item.is_published && <Badge tone="neutral">Hidden</Badge>}
                      {item.item_type !== 'portfolio' && item.availability_status !== 'available' && availabilityText && (
                        <Badge tone={item.availability_status === 'preorder' ? 'gold' : 'danger'}>{availabilityText}</Badge>
                      )}
                      {item.images.length === 0 && <Badge tone="warning">No photo</Badge>}
                    </div>
                  </div>
                </Link>
                {!reordering && (
                  <div className="flex shrink-0 items-center gap-1 sm:gap-3">
                    <div className="hidden items-center gap-2 sm:flex">
                      <span className="text-xs text-muted-foreground">{item.is_published ? 'Showing' : 'Hidden'}</span>
                      <Switch
                        checked={item.is_published}
                        label={`Show ${item.title} on storefront`}
                        onCheckedChange={(checked) => void patch(item, { is_published: checked }, checked ? 'Now showing on your storefront.' : 'Hidden from your storefront.')}
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${item.title}`}>
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem icon={Pencil} onSelect={() => navigate(`/dashboard/catalogue/${item.id}`)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          icon={item.is_published ? Ban : CircleCheck}
                          onSelect={() => void patch(item, { is_published: !item.is_published }, item.is_published ? 'Hidden from your storefront.' : 'Now showing on your storefront.')}
                        >
                          {item.is_published ? 'Hide from storefront' : 'Show on storefront'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          icon={item.is_featured ? StarOff : Star}
                          onSelect={() => void patch(item, { is_featured: !item.is_featured }, item.is_featured ? 'Removed from featured.' : 'Marked as featured.')}
                        >
                          {item.is_featured ? 'Remove from featured' : 'Mark as featured'}
                        </DropdownMenuItem>
                        {item.item_type !== 'portfolio' && (
                          <>
                            <DropdownMenuSeparator />
                            {(Object.entries(AVAILABILITY_LABELS[item.item_type]) as Array<[AvailabilityStatus, string]>)
                              .filter(([value]) => value !== item.availability_status)
                              .map(([value, label]) => (
                                <DropdownMenuItem
                                  key={value}
                                  icon={value === 'available' ? CircleCheck : value === 'preorder' ? Clock : Ban}
                                  onSelect={() => void patch(item, { availability_status: value }, `Marked as “${label}”.`)}
                                >
                                  Mark as {label.toLowerCase()}
                                </DropdownMenuItem>
                              ))}
                          </>
                        )}
                        <DropdownMenuSeparator />
                        {business.status === 'published' && item.is_published && (
                          <DropdownMenuItem icon={Link2} onSelect={() => void copyItemLink(item)}>
                            Copy item link
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          icon={CopyPlus}
                          disabled={duplicate.isPending}
                          onSelect={() =>
                            duplicate.mutate(item, {
                              onSuccess: () => toast.success('Duplicated. The copy is hidden until you show it.'),
                              onError: (error) => toast.error(toUserMessage(error)),
                            })
                          }
                        >
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem icon={Trash2} tone="danger" onSelect={() => setToDelete(item)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Are you sure you want to delete this item?"
        description={toDelete ? `“${toDelete.title}” and its photos will be permanently removed. This can't be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
