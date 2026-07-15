'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

export default function ConfigPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/ai-config' as Route);
  }, [router]);

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 920, mx: 'auto', px: 3, py: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Redirecting to Administration…
        </Typography>
      </Box>
    </AuthGate>
  );
}
