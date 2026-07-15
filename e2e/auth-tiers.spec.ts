import { expect, test } from '@playwright/test';
import { setSessionTier } from './helpers/auth';

test.describe('public tier', () => {
  test('dashboard loads without session', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Business Review/ })).toBeVisible();
    await expect(page.getByTestId('sign-in-panel')).toBeVisible();
  });

  test('ops-admin shows sign-in gate', async ({ page }) => {
    await page.goto('/ops-admin');
    await expect(page.getByTestId('sign-in-panel')).toBeVisible();
    await expect(page.getByText('Ops Sign-In')).toBeVisible();
  });

  test('me API returns public tier', async ({ request }) => {
    const response = await request.get('/api/auth?action=me');
    const json = await response.json() as { data: { tier: string } };
    expect(json.data.tier).toBe('public');
  });
});

test.describe('pin tier', () => {
  test.beforeEach(async ({ page }) => {
    await setSessionTier(page, 'pin');
  });

  test('ops-admin is accessible', async ({ page }) => {
    await page.goto('/ops-admin');
    await expect(page.getByText('Daily POS, Costs, and Missing Days')).toBeVisible();
    await expect(page.getByTestId('sign-in-panel')).toHaveCount(0);
  });

  test('google-only summary is gated', async ({ page }) => {
    await page.goto('/summary');
    await expect(page.getByTestId('sign-in-panel')).toBeVisible();
  });

  test('me API returns pin tier', async ({ page }) => {
    await page.goto('/dashboard');
    const json = await page.evaluate(async () => {
      const response = await fetch('/api/auth?action=me', { credentials: 'include' });
      return response.json() as Promise<{ data: { tier: string } }>;
    });
    expect(json.data.tier).toBe('pin');
  });

  test('landing page redirects pin to /gp-management', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/gp-management', { timeout: 10_000 });
    expect(page.url()).toContain('/gp-management');
  });

  test('navigation drawer shows GP pages for pin tier', async ({ page }) => {
    await page.goto('/gp-management');
    await page.waitForFunction(async () => {
      const response = await fetch('/api/auth?action=me', { credentials: 'include' });
      const json = await response.json() as { data: { tier: string } };
      return json.data.tier === 'pin';
    });
    await page.getByLabel('Open navigation').click();
    // GP pages should be visible
    await expect(page.getByRole('link', { name: 'Clinical' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'GP Management' })).toBeVisible();
    // Patient pages should NOT be visible
    await expect(page.getByRole('link', { name: 'Health' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Journal' })).toHaveCount(0);
  });
});

test.describe('google tier', () => {
  test.beforeEach(async ({ page }) => {
    await setSessionTier(page, 'google');
  });

  test('summary page is accessible', async ({ page }) => {
    await page.goto('/summary');
    await expect(page.getByTestId('sign-in-panel')).toHaveCount(0);
  });

  test('drawer shows sign out button (not link)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForFunction(async () => {
      const response = await fetch('/api/auth?action=me', { credentials: 'include' });
      const json = await response.json() as { data: { tier: string } };
      return json.data.tier === 'google';
    });
    await page.getByLabel('Open navigation').click();
    // Sign out is now a button (not a link) — role="button"
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('ops-tracking shows reports rollup', async ({ page }) => {
    await page.goto('/ops-tracking');
    await expect(page.getByText('Z-Report Rollup')).toBeVisible();
  });

  test('google-config API returns public OAuth fields', async ({ request }) => {
    const response = await request.get('/api/auth?action=google-config');
    if (response.status() === 503) {
      test.skip();
      return;
    }
    const json = await response.json() as { success: boolean; data: { clientId: string; projectId: string; authUri: string } };
    expect(json.success).toBe(true);
    expect(json.data.clientId).toBeTruthy();
    expect(json.data.authUri).toContain('accounts.google.com');
    expect(json.data).not.toHaveProperty('clientSecret');
  });

  test('landing page redirects google (patient) to /health-dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/health-dashboard', { timeout: 10_000 });
    expect(page.url()).toContain('/health-dashboard');
  });

  test('navigation drawer does NOT show GP pages for patient (google tier)', async ({ page }) => {
    await page.goto('/health-dashboard');
    await page.waitForFunction(async () => {
      const response = await fetch('/api/auth?action=me', { credentials: 'include' });
      const json = await response.json() as { data: { tier: string } };
      return json.data.tier === 'google';
    });
    await page.getByLabel('Open navigation').click();
    // Patient pages should be visible
    await expect(page.getByRole('link', { name: 'Health' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Journal' })).toBeVisible();
    // GP pages should NOT be visible
    await expect(page.getByRole('link', { name: 'Clinical' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'GP Management' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Reference' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Consult' })).toHaveCount(0);
  });
});
