import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { GenericTopBar } from '../components/layout/GenericTopBar';

const STORAGE_KEY = 'currentUser';
const fixtureUser = { id: 'user-1', firstName: 'Bob' };

function renderBar() {
  return render(
    <MemoryRouter initialEntries={['/boards']}>
      <Routes>
        <Route path="/boards" element={<GenericTopBar onMenuClick={() => {}} />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GenericTopBar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows greeting and Log out button when user is in localStorage (AC-HEADER-1)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtureUser));
    renderBar();
    expect(screen.getByText('Hi, Bob')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument();
  });

  it('shows Login link and no greeting when localStorage is empty (AC-HEADER-2)', () => {
    renderBar();
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
    expect(screen.queryByText(/hi,/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('shows Login link when localStorage contains corrupted JSON (AC-SESSION-2)', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json');
    renderBar();
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
    expect(screen.queryByText(/hi,/i)).not.toBeInTheDocument();
  });

  it('clears localStorage and navigates to /login when Log out is clicked (AC-HAPPY-2)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtureUser));
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
