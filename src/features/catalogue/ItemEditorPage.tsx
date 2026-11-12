import { PackageX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { BUSINESS_TYPE_COPY, ITEM_TYPE_LABELS } from '@/config/catalog';
import { useCurrentBusiness } from '@/features/businesses/hooks';
import { usePageMeta } from '@/hooks/usePageMeta';
import { PageHeader } from '../dashboard/PageHeader';
import { ItemForm } from './components/ItemForm';
import { useCategories, useItems } from './hooks';

export function Component() {
  const { itemId } = useParams();
  const business = useCurrentBusiness();
  const navigate = useNavigate();
  const items = useItems(business.id);
  const categories = useCategories(business.id);
  const [formKey, setFormKey] = useState(0);
  const copy = BUSINESS_TYPE_COPY[business.business_type];
  const item = itemId ? items.data?.find((i) => i.id === itemId) : undefined;
  const title = itemId ? (item ? `Edit ${ITEM_TYPE_LABELS[item.item_type].label.toLowerCase()}` : 'Edit') : `Add ${copy.itemNoun}`;
  usePageMeta({ title, noindex: true });

  const back = { to: '/dashboard/catalogue', label: copy.catalogueLabel };

  if (items.isPending || categories.isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (itemId && !item) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Item not found" back={back} />
        <EmptyState
          icon={PackageX}
          title="This item doesn't exist"
          description="It may have been deleted."
          action={
            <Button asChild>
              <Link to="/dashboard/catalogue">Back to catalogue</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={item ? `Edit “${item.title}”` : title} back={back} />
      <ItemForm
        key={`${itemId ?? 'new'}-${formKey}`}
        business={business}
        categories={categories.data ?? []}
        item={item}
        allowAddAnother={!item}
        onCancel={() => navigate('/dashboard/catalogue')}
        onSaved={(_saved, intent) => {
          if (intent === 'another') {
            setFormKey((k) => k + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            navigate('/dashboard/catalogue');
          }
        }}
      />
    </div>
  );
}
