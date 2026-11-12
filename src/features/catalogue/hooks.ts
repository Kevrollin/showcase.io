import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/queryClient';
import {
  createItem,
  deleteItem,
  duplicateItem,
  listItems,
  reorderItems,
  updateItem,
  type ItemPatch,
} from '@/services/catalogue.service';
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
  reorderCategories,
} from '@/services/category.service';
import type { CatalogueItem, Category } from '@/types/models';

export function useItems(businessId: string) {
  return useQuery({ queryKey: queryKeys.items(businessId), queryFn: () => listItems(businessId) });
}

export function useCategories(businessId: string) {
  return useQuery({ queryKey: queryKeys.categories(businessId), queryFn: () => listCategories(businessId) });
}

export function useItemCache(businessId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.items(businessId);
  return {
    upsert(item: CatalogueItem) {
      queryClient.setQueryData<CatalogueItem[]>(key, (current) => {
        if (!current) return [item];
        return current.some((i) => i.id === item.id) ? current.map((i) => (i.id === item.id ? item : i)) : [item, ...current];
      });
    },
    remove(itemId: string) {
      queryClient.setQueryData<CatalogueItem[]>(key, (current) => current?.filter((i) => i.id !== itemId));
    },
    invalidate() {
      return queryClient.invalidateQueries({ queryKey: key });
    },
  };
}

export function useUpdateItem(businessId: string) {
  const cache = useItemCache(businessId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ItemPatch }) => updateItem(id, patch),
    // Optimistic toggles (publish, availability, featured) feel instant on slow networks.
    onMutate: async ({ id, patch }) => {
      const key = queryKeys.items(businessId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CatalogueItem[]>(key);
      queryClient.setQueryData<CatalogueItem[]>(key, (current) =>
        current?.map((i) => (i.id === id ? ({ ...i, ...patch } as CatalogueItem) : i)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.items(businessId), context.previous);
    },
    onSuccess: (item) => cache.upsert(item),
  });
}

export function useCreateItem(businessId: string) {
  const cache = useItemCache(businessId);
  return useMutation({ mutationFn: createItem, onSuccess: (item) => cache.upsert(item) });
}

export function useDeleteItem(businessId: string) {
  const cache = useItemCache(businessId);
  return useMutation({ mutationFn: (item: CatalogueItem) => deleteItem(item), onSuccess: (_r, item) => cache.remove(item.id) });
}

export function useDuplicateItem(businessId: string, userId: string) {
  const cache = useItemCache(businessId);
  return useMutation({ mutationFn: (item: CatalogueItem) => duplicateItem(item, userId), onSuccess: (item) => cache.upsert(item) });
}

export function useReorderItems(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ordered: CatalogueItem[]) => reorderItems(businessId, ordered.map((i) => i.id)),
    onMutate: (ordered) => {
      const key = queryKeys.items(businessId);
      const previous = queryClient.getQueryData<CatalogueItem[]>(key);
      queryClient.setQueryData<CatalogueItem[]>(key, ordered.map((item, index) => ({ ...item, sort_order: index })));
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.items(businessId), context.previous);
    },
  });
}

// ─── Categories ──────────────────────────────────────────────────────────────

export function useCategoryMutations(businessId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.categories(businessId);
  const set = (fn: (current: Category[]) => Category[]) =>
    queryClient.setQueryData<Category[]>(key, (current) => fn(current ?? []));

  const create = useMutation({
    mutationFn: (name: string) => {
      const current = queryClient.getQueryData<Category[]>(key) ?? [];
      const nextOrder = current.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1;
      return createCategory(businessId, name, nextOrder);
    },
    onSuccess: (category) => set((c) => [...c, category]),
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameCategory(id, name),
    onSuccess: (category) => set((c) => c.map((x) => (x.id === category.id ? category : x))),
  });

  const remove = useMutation({
    mutationFn: ({ category, moveTo }: { category: Category; moveTo: string | null }) => deleteCategory(category, moveTo),
    onSuccess: (_r, { category }) => {
      set((c) => c.filter((x) => x.id !== category.id));
      // Items changed category in the database.
      void queryClient.invalidateQueries({ queryKey: queryKeys.items(businessId) });
    },
  });

  const reorder = useMutation({
    mutationFn: (ordered: Category[]) => reorderCategories(businessId, ordered.map((c) => c.id)),
    onMutate: (ordered) => {
      const previous = queryClient.getQueryData<Category[]>(key);
      queryClient.setQueryData<Category[]>(key, ordered.map((c, i) => ({ ...c, sort_order: i })));
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
  });

  return { create, rename, remove, reorder };
}
