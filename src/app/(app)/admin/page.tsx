'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  Box, Typography, Stack, Card, CardContent, Grid, Skeleton, Chip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EventIcon from '@mui/icons-material/Event';
import KeyIcon from '@mui/icons-material/Key';
import PsychologyIcon from '@mui/icons-material/Psychology';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryIcon from '@mui/icons-material/History';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface DashboardStats {
  totalGps: number;
  pendingGps: number;
  totalPatients: number;
  appointmentsToday: number;
  consultationsThisMonth: number;
  openAiKeyConfigured: boolean;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d.stats as DashboardStats); })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: 'Total GPs', value: stats?.totalGps ?? 0, icon: <PeopleIcon color="primary" sx={{ fontSize: 36 }} />,
      sub: stats?.pendingGps ? `${stats.pendingGps} pending approval` : 'All approved',
      color: stats?.pendingGps ? 'warning.main' : 'success.main',
    },
    {
      label: 'Patients', value: stats?.totalPatients ?? 0, icon: <DashboardIcon color="primary" sx={{ fontSize: 36 }} />,
      sub: 'Registered health profiles',
    },
    {
      label: 'Today\'s Appointments', value: stats?.appointmentsToday ?? 0,
      icon: <CalendarTodayIcon color="primary" sx={{ fontSize: 36 }} />,
      sub: 'Booked or confirmed',
    },
    {
      label: 'Consultations (Month)', value: stats?.consultationsThisMonth ?? 0,
      icon: <EventIcon color="primary" sx={{ fontSize: 36 }} />,
      sub: 'This calendar month',
    },
    {
      label: 'OpenAI Key', value: stats?.openAiKeyConfigured ? 'Configured' : 'Missing',
      icon: <KeyIcon color={stats?.openAiKeyConfigured ? 'success' : 'error'} sx={{ fontSize: 36 }} />,
      sub: stats?.openAiKeyConfigured ? 'AI features enabled' : 'Click to configure',
      color: stats?.openAiKeyConfigured ? 'success.main' : 'error.main',
    },
  ];

  const quickLinks = [
    { label: 'GP Verification', desc: 'Approve or reject GP registrations', icon: <VerifiedUserIcon />, href: '/admin/gp-verification' },
    { label: 'Practice Settings', desc: 'Hours, timezone, defaults, billing', icon: <SettingsIcon />, href: '/admin/practice-settings' },
    { label: 'Appointment Types', desc: 'Configure visit types and durations', icon: <CalendarTodayIcon />, href: '/admin/appointment-types' },
    { label: 'Fee Schedule', desc: 'MBS items and practice fees', icon: <SettingsIcon />, href: '/admin/fee-schedule' },
    { label: 'Provider Directory', desc: 'Pathology and radiology providers', icon: <SettingsIcon />, href: '/admin/providers' },
    { label: 'Feature Flags', desc: 'Toggle platform features', icon: <SettingsIcon />, href: '/admin/feature-flags' },
    { label: 'AI Configuration', desc: 'OpenAI API key and chat assistant settings', icon: <PsychologyIcon />, href: '/admin/ai-config' },
    { label: 'Notification Templates', desc: 'Email/SMS template management', icon: <SettingsIcon />, href: '/admin/notification-templates' },
    { label: 'User Management', desc: 'Manage users, roles, and access', icon: <PeopleIcon />, href: '/admin/users' },
    { label: 'Activity Log', desc: 'Audit trail of admin actions', icon: <HistoryIcon />, href: '/admin/activity-log' },
  ];

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 1000, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Administration</Typography>

        {/* ── Stats Cards ──────────────────────────────────────────── */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {cards.map((c) => (
            <Grid key={c.label} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                variant="outlined"
                sx={
                  c.label === 'OpenAI Key'
                    ? { cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }
                    : undefined
                }
                onClick={c.label === 'OpenAI Key' ? () => router.push('/admin/ai-config' as Route) : undefined}
              >
                <CardContent>
                  {loading ? (
                    <Skeleton variant="rounded" height={100} />
                  ) : (
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                      {c.icon}
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: c.color }}>
                          {typeof c.value === 'number' ? c.value.toLocaleString() : c.value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                        <Chip label={c.sub} size="small" variant="outlined" sx={{ mt: 0.5, fontWeight: 500, color: c.color }} />
                      </Box>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* ── Quick Links ──────────────────────────────────────────── */}
        <Typography variant="h6" sx={{ mb: 2 }}>Quick Actions</Typography>
        <Grid container spacing={2}>
          {quickLinks.map((link) => (
            <Grid key={link.href} size={{ xs: 12, sm: 6 }}>
              <Card
                variant="outlined"
                sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}
                onClick={() => router.push(link.href as Route)}
              >
                <CardContent>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    {link.icon}
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{link.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{link.desc}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </AuthGate>
  );
}
