'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuIcon from '@mui/icons-material/Menu';
import PsychologyIcon from '@mui/icons-material/Psychology';
import { useCallback, type ReactNode } from 'react';
import { SavedConversationsMenu } from '@/components/chat/saved-conversations-menu';
import { listNavPages, tierAllowsAccess } from '@/lib/page-catalog';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDrawerOpen } from '@/store/ui-slice';
import { resetAuth } from '@/store/auth-slice';

const DRAWER_WIDTH = 280;

const linkSx = { textDecoration: 'none', color: 'inherit', display: 'block' };

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const drawerOpen = useAppSelector((s) => s.ui.drawerOpen);
  const { tier, user, isGp } = useAppSelector((s) => s.auth);

  const navPages = listNavPages(tier, isGp);
  const showConfigLink = tierAllowsAccess(tier, 'pin') || (isGp && tier === 'google');
  const isOpsChat = pathname === '/ops-chat';

  const closeDrawer = () => dispatch(setDrawerOpen(false));
  const toggleDrawer = () => dispatch(setDrawerOpen(!drawerOpen));

  /**
   * Client-side sign-out: clears all localStorage, resets Redux auth state,
   * calls the server to clear the session cookie, then navigates to the
   * public landing page.
   */
  const handleSignOut = useCallback(async () => {
    try {
      globalThis.localStorage?.clear();
    } catch { /* ignore */ }
    closeDrawer();
    dispatch(resetAuth());
    try {
      await fetch('/api/auth?action=logout-client', { method: 'GET', credentials: 'include' });
    } catch { /* proceed even if network fails */ }
    router.push('/health-education');
  }, [dispatch, router]);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <AppBar position="sticky" elevation={0} color="transparent">
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: 52 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              aria-label="Open navigation"
              onClick={toggleDrawer}
              sx={{ color: 'text.secondary' }}
            >
              <MenuIcon />
            </IconButton>
            <Link href={tier === 'pin' ? '/gp-management' : tier === 'google' && isGp ? '/gp-dashboard' : '/health-dashboard'} style={linkSx}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  color: 'text.primary',
                }}
              >
                ManaposeGP
              </Typography>
            </Link>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {(tier === 'google' || tier === 'pin') && (
              <Link href={'/consultation-assist' as Route} style={linkSx}>
                <IconButton aria-label="Consultation assistant" sx={{ color: 'text.secondary' }}>
                  <PsychologyIcon />
                </IconButton>
              </Link>
            )}
            {isOpsChat ? <SavedConversationsMenu /> : null}
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={closeDrawer}
        slotProps={{ paper: { sx: { width: DRAWER_WIDTH, maxWidth: '80vw' } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2.5, pb: 2 }}>
          <Avatar
            src={user?.picture ?? undefined}
            sx={{ width: 36, height: 36, bgcolor: 'rgba(235, 61, 40, 0.15)', color: 'primary.main' }}
          >
            {user?.name?.[0] ?? 'R'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name ?? 'Guest'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email ?? `Tier: ${tier}`}
            </Typography>
          </Box>
        </Box>
        <Divider />
        <List sx={{ flex: 1, py: 1 }}>
          {navPages.map((page) => {
            const href = `/${page.slug}` as Route;
            return (
              <Link key={page.slug} href={href} style={linkSx} onClick={closeDrawer}>
                <ListItemButton
                  selected={isActive(href)}
                  sx={{
                    borderLeft: '3px solid transparent',
                    '&.Mui-selected': {
                      borderLeftColor: 'primary.main',
                      bgcolor: 'rgba(235, 61, 40, 0.06)',
                    },
                  }}
                >
                  <ListItemText primary={page.navLabel ?? page.title} />
                </ListItemButton>
              </Link>
            );
          })}
          {showConfigLink ? (
            <>
              <Link href="/admin" style={linkSx} onClick={closeDrawer}>
                <ListItemButton
                  selected={pathname.startsWith('/admin')}
                  sx={{
                    borderLeft: '3px solid transparent',
                    '&.Mui-selected': {
                      borderLeftColor: 'primary.main',
                      bgcolor: 'rgba(235, 61, 40, 0.06)',
                    },
                  }}
                >
                  <ListItemText primary="Administration" />
                </ListItemButton>
              </Link>
              <Link href="/config/automation" style={linkSx} onClick={closeDrawer}>
                <ListItemButton
                  selected={pathname === '/config/automation'}
                  sx={{
                    borderLeft: '3px solid transparent',
                    '&.Mui-selected': {
                      borderLeftColor: 'primary.main',
                      bgcolor: 'rgba(235, 61, 40, 0.06)',
                    },
                  }}
                >
                  <ListItemText primary="Automation" />
                </ListItemButton>
              </Link>
            </>
          ) : null}
        </List>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {tier === 'public' ? (
            <Button
              component="a"
              href={`/api/auth?action=google&redirect=${encodeURIComponent(pathname || '/dashboard')}`}
              variant="outlined"
              size="small"
              fullWidth
            >
              Sign in with Google
            </Button>
          ) : (
            <Button
              onClick={handleSignOut}
              variant="outlined"
              size="small"
              color="inherit"
              fullWidth
            >
              Sign out
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 2 }}>
          <Link href="/terms-of-service" style={linkSx} onClick={closeDrawer}>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Terms
            </Typography>
          </Link>
          <Link href="/privacy-policy" style={linkSx} onClick={closeDrawer}>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Privacy
            </Typography>
          </Link>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', opacity: 0.6 }}>
            Health data retained 7 years from last consultation per Australian clinical record guidelines. AI outputs are decision-support only. Not medical advice.
          </Typography>
        </Box>
      </Drawer>

      <Box component="div" sx={{ flex: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
