import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { SLUG_PROBLEM_MESSAGES, validateSlug } from '@/lib/utils/slug';
import { isSlugAvailable } from '@/services/business.service';

export type SlugStatus = 'unchanged' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

export function useSlugCheck(slug: string, businessId: string, original: string): { status: SlugStatus; message: string | null } {
  const normalized = slug.trim().toLowerCase();
  const debounced = useDebouncedValue(normalized, 400);
  const problem = validateSlug(normalized);
  const changed = normalized !== original;
  const query = useQuery({
    queryKey: ['slug-available', debounced, businessId],
    queryFn: () => isSlugAvailable(debounced, businessId),
    enabled: changed && !problem && debounced === normalized,
    staleTime: 30_000,
    retry: false,
  });

  if (!changed) return { status: 'unchanged', message: null };
  if (problem) return { status: 'invalid', message: SLUG_PROBLEM_MESSAGES[problem] };
  if (debounced !== normalized || query.isPending) return { status: 'checking', message: 'Checking availability…' };
  if (query.isError) return { status: 'error', message: "We couldn't check this link. Try again in a moment." };
  return query.data ? { status: 'available', message: 'This link is available.' } : { status: 'taken', message: 'This link is already taken. Try another one.' };
}
