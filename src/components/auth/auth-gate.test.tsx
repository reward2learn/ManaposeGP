import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { AuthGate } from '@/components/auth/auth-gate';
import { authSlice } from '@/store/auth-slice';

afterEach(() => cleanup());

function renderWithAuth(
  tier: 'public' | 'pin' | 'google',
  bootstrapped = true,
  isGp = false,
  requiredTier: 'public' | 'pin' | 'google' = 'google',
) {
  const store = configureStore({
    reducer: { auth: authSlice.reducer },
    preloadedState: {
      auth: { tier, user: null, bootstrapped, isGp },
    },
  });

  return render(
    <Provider store={store}>
      <AuthGate requiredTier={requiredTier} fallback={<p>Access denied</p>}>
        <p>Protected content</p>
      </AuthGate>
    </Provider>,
  );
}

describe('AuthGate', () => {
  it('denies PIN tier on google-only routes', () => {
    renderWithAuth('pin', true, false, 'google');
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('allows google tier on google-only routes', () => {
    renderWithAuth('google');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('shows loading fallback until bootstrap completes', () => {
    renderWithAuth('google', false);
    expect(screen.getByText('Checking session…')).toBeInTheDocument();
  });

  it('denies google tier (patient) on pin-tier routes', () => {
    renderWithAuth('google', true, false, 'pin');
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });

  it('allows google tier with isGp on pin-tier routes', () => {
    renderWithAuth('google', true, true, 'pin');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('allows pin tier on pin-tier routes', () => {
    renderWithAuth('pin', true, false, 'pin');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
