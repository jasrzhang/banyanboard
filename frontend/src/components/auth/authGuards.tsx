import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  if (user) return <Navigate to="/boards" replace />;
  return <>{children}</>;
}
