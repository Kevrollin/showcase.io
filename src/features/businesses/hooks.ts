import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { queryKeys } from '@/app/queryClient';
import {
  getMyPlan,
  listMyBusinesses,
  setBusinessStatus,
  updateBusiness,
  type BusinessPatch,
} from '@/services/business.service';
import type { Business } from '@/types/models';

const SELECTED_KEY = 'showcase:selected-business';

export function useMyBusinesses() {
  return useQuery({ queryKey: queryKeys.myBusinesses, queryFn: listMyBusinesses });
}

export function usePlan() {
  return useQuery({ queryKey: queryKeys.plan, queryFn: getMyPlan, staleTime: 10 * 60_000 });
}

/** The data model supports several businesses; the UI works on one at a time. */
export function pickCurrentBusiness(businesses: Business[]): Business | null {
  if (businesses.length === 0) return null;
  let selected: string | null = null;
  try {
    selected = window.localStorage.getItem(SELECTED_KEY);
  } catch {
    // Storage can be unavailable (private mode); fall back to the first business.
  }
  return businesses.find((b) => b.id === selected) ?? businesses[0]!;
}

export function rememberCurrentBusiness(id: string): void {
  try {
    window.localStorage.setItem(SELECTED_KEY, id);
  } catch {
    // Non-essential convenience.
  }
}

/** Writes a fresh business row into the cached list. */
export function useSetBusinessInCache() {
  const queryClient = useQueryClient();
  return (business: Business) => {
    queryClient.setQueryData<Business[]>(queryKeys.myBusinesses, (current) => {
      if (!current) return [business];
      const exists = current.some((b) => b.id === business.id);
      return exists ? current.map((b) => (b.id === business.id ? business : b)) : [...current, business];
    });
  };
}

export function useUpdateBusiness() {
  const setInCache = useSetBusinessInCache();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BusinessPatch }) => updateBusiness(id, patch),
    onSuccess: setInCache,
  });
}

export function usePublishBusiness() {
  const setInCache = useSetBusinessInCache();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'published' | 'unpublished' }) => setBusinessStatus(id, status),
    onSuccess: (business) => {
      setInCache(business);
      void queryClient.invalidateQueries({ queryKey: ['storefront', business.slug] });
    },
  });
}

// ─── Current business context (provided by the dashboard layout) ─────────────

export const CurrentBusinessContext = createContext<Business | null>(null);

export function useCurrentBusiness(): Business {
  const business = useContext(CurrentBusinessContext);
  if (!business) throw new Error('useCurrentBusiness must be used inside the dashboard layout');
  return business;
}
