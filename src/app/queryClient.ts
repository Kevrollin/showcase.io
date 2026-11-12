import { QueryClient } from '@tanstack/react-query';
import { isNetworkError } from '@/lib/utils/errors';

function isClientError(error: unknown): boolean {
  const status = Number((error as { status?: unknown } | null)?.status);
  return Number.isFinite(status) && status >= 400 && status < 500;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data changes rarely and users are often on metered connections.
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => !isClientError(error) && failureCount < (isNetworkError(error) ? 3 : 1),
    },
    mutations: {
      retry: false,
    },
  },
});

export const queryKeys = {
  myBusinesses: ['businesses', 'mine'] as const,
  plan: ['plan'] as const,
  profile: ['profile'] as const,
  items: (businessId: string) => ['items', businessId] as const,
  item: (itemId: string) => ['item', itemId] as const,
  categories: (businessId: string) => ['categories', businessId] as const,
  storefront: (slug: string) => ['storefront', slug] as const,
  storefrontItems: (slug: string, filters: Record<string, unknown>) => ['storefront-items', slug, filters] as const,
  storefrontItem: (slug: string, itemSlug: string) => ['storefront-item', slug, itemSlug] as const,
};
