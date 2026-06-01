import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCurrentUser } from '../hooks/useCurrentUser';

const STORAGE_KEY = 'currentUser';
const fixtureUser = { id: 'user-1', firstName: 'Alice' };

describe('useCurrentUser', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when localStorage is empty', () => {
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.user).toBeNull();
  });

  it('returns the stored user when valid currentUser exists in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtureUser));
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.user).toEqual(fixtureUser);
  });

  it('setUser writes to localStorage and updates state', () => {
    const { result } = renderHook(() => useCurrentUser());
    act(() => {
      result.current.setUser(fixtureUser);
    });
    expect(result.current.user).toEqual(fixtureUser);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(fixtureUser));
  });

  it('clearUser removes key from localStorage and sets user to null', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtureUser));
    const { result } = renderHook(() => useCurrentUser());
    act(() => {
      result.current.clearUser();
    });
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null without throwing when localStorage contains invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    expect(() => {
      const { result } = renderHook(() => useCurrentUser());
      expect(result.current.user).toBeNull();
    }).not.toThrow();
  });
});
