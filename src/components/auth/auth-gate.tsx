'use client';

import type { ReactNode } from 'react';
import type { AuthTier } from '@/lib/page-catalog';
import { tierAllowsAccess } from '@/lib/page-catalog';
import { useAppSelector } from '@/store/hooks';

export interface AuthGateProps {
  requiredTier: AuthTier;
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
}

export function AuthGate({
  requiredTier,
  children,
  fallback = <p>Sign in required to view this page.</p>,
  loadingFallback = <p>Checking session…</p>,
}: AuthGateProps) {
  const { tier, bootstrapped, isGp } = useAppSelector((state) => state.auth);

  if (!bootstrapped) {
    return loadingFallback;
  }

  // Google-signed-in verified GPs may access pin-tier pages
  const allowed = tierAllowsAccess(tier, requiredTier)
    || (isGp && tier === 'google' && requiredTier === 'pin');

  if (!allowed) {
    return fallback;
  }

  return children;
}
