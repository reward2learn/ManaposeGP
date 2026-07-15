'use client';

import { useAppSelector } from '@/store/hooks';

/**
 * Convenience hook that returns the current auth session from Redux.
 *
 * The session cookie (`rosalita.session`) is automatically included in
 * RTK Query requests via base-query's `credentials: 'include'`.
 */
export function useSession() {
  const { tier, user, bootstrapped, isGp } = useAppSelector((s) => s.auth);
  const isAuthenticated = bootstrapped && tier !== 'public';

  return { tier, user, bootstrapped, isAuthenticated, isGp } as const;
}
