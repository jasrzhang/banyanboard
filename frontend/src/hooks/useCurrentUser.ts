import { useState } from 'react';
import type { User } from '../types/domain';

const STORAGE_KEY = 'currentUser';

function readFromStorage(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function useCurrentUser() {
  const [user, setUserState] = useState<User | null>(readFromStorage);

  function setUser(u: User): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUserState(u);
  }

  function clearUser(): void {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  }

  return { user, setUser, clearUser };
}
