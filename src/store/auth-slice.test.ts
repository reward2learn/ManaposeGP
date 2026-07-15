import { describe, expect, it } from 'vitest';
import { authSlice, resetAuth, setSession, setTier } from '@/store/auth-slice';

describe('authSlice', () => {
  it('starts unbootstrapped at public tier', () => {
    const state = authSlice.reducer(undefined, { type: 'init' });
    expect(state.tier).toBe('public');
    expect(state.user).toBeNull();
    expect(state.bootstrapped).toBe(false);
    expect(state.isGp).toBe(false);
  });

  it('setSession stores tier, user, and isGp', () => {
    const state = authSlice.reducer(
      undefined,
      setSession({
        tier: 'google',
        user: { id: 'u1', email: 'owner@manaposegp.id', authMethod: 'google' },
        isGp: true,
      }),
    );
    expect(state.tier).toBe('google');
    expect(state.user?.email).toBe('owner@manaposegp.id');
    expect(state.isGp).toBe(true);
    expect(state.bootstrapped).toBe(true);
  });

  it('setSession defaults isGp to false', () => {
    const state = authSlice.reducer(
      undefined,
      setSession({
        tier: 'google',
        user: { id: 'u2', email: 'patient@example.com', authMethod: 'google' },
      }),
    );
    expect(state.isGp).toBe(false);
  });

  it('setTier updates tier without user', () => {
    const state = authSlice.reducer(undefined, setTier('pin'));
    expect(state.tier).toBe('pin');
    expect(state.bootstrapped).toBe(true);
  });

  it('resetAuth clears user, isGp, and sets public tier', () => {
    const prior = authSlice.reducer(
      undefined,
      setSession({ tier: 'pin', user: { id: 'admin' } }),
    );
    const state = authSlice.reducer(prior, resetAuth());
    expect(state.tier).toBe('public');
    expect(state.user).toBeNull();
    expect(state.isGp).toBe(false);
    expect(state.bootstrapped).toBe(true);
  });

  it('pin tier cannot satisfy google-only via slice alone (AuthGate enforces)', () => {
    const state = authSlice.reducer(
      undefined,
      setSession({ tier: 'pin', user: { id: 'admin', authMethod: 'pin' } }),
    );
    expect(state.tier).toBe('pin');
    expect(state.tier).not.toBe('google');
  });
});
