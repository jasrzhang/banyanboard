import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LoginPage } from '../pages/LoginPage';

vi.mock('../api/usersApi');

import { login } from '../api/usersApi';
const mockLogin = vi.mocked(login);

const STORAGE_KEY = 'currentUser';
const fixtureUser = { id: 'user-1', firstName: 'Alice' };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/boards" element={<div>Boards Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders firstName input with label and Log in button; no error visible', () => {
    renderPage();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows inline error and does not call API when firstName is empty', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows inline error and does not call API when firstName is all spaces', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows inline error and does not call API when firstName contains a digit', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Al1ce' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login API with name, writes localStorage, and navigates to /boards on success', async () => {
    mockLogin.mockResolvedValueOnce(fixtureUser);
    renderPage();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(screen.getByText('Boards Page')).toBeInTheDocument());
    expect(mockLogin).toHaveBeenCalledWith('Alice');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(fixtureUser));
  });

  it('shows form-level error, re-enables button, and does not write localStorage when API fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Server error'));
    renderPage();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    await screen.findByRole('alert');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
  });

  it('disables button and input while login request is pending', async () => {
    mockLogin.mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
      expect(screen.getByLabelText(/first name/i)).toBeDisabled();
    });
  });

  it('sets aria-invalid and aria-describedby on input when validation fails', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    await screen.findByRole('alert');
    const input = screen.getByLabelText(/first name/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const errorId = input.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toBeInTheDocument();
  });
});
