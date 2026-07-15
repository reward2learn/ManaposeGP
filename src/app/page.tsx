'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { CircularProgress, Box } from '@mui/material';

/**
 * Role-based landing page redirect:
 * - public   → /health-education (public health library)
 * - google   → /health-dashboard (patient landing)
 * - google + isGp → /gp-dashboard (GP landing for verified GP using Google auth)
 * - pin      → /admin (platform admin dashboard)
 */
export default function HomePage() {
  const router = useRouter();
  const { tier, bootstrapped, isGp } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (!bootstrapped) return;

    if (tier === 'pin') {
      router.replace('/admin');
    } else if (tier === 'google' && isGp) {
      router.replace('/gp-dashboard');
    } else if (tier === 'google') {
      router.replace('/health-dashboard');
    } else {
      router.replace('/health-education');
    }
  }, [tier, bootstrapped, isGp, router]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60dvh' }}>
      <CircularProgress size={32} />
    </Box>
  );
}
