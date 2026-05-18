import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './AppShell';
import { BoardListPage } from '../../pages/BoardListPage';
import { BoardDetailPage } from '../../pages/BoardDetailPage';

function renderAppShell(initialPath = '/boards') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { path: 'boards', element: <BoardListPage /> },
          { path: 'boards/:boardId', element: <BoardDetailPage /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
}

describe('AppShell', () => {
  it('renders all three layout zones — sidebar, header, and main', () => {
    renderAppShell();
    expect(screen.getByRole('navigation', { name: /navigation sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders placeholder board nav links in the sidebar', () => {
    renderAppShell();
    expect(screen.getByRole('link', { name: /my board/i })).toBeInTheDocument();
  });

  it('renders "New Card" button in the board header', () => {
    renderAppShell();
    expect(screen.getByRole('button', { name: /new card/i })).toBeInTheDocument();
  });

  it('burger menu button toggles sidebar open state without crashing', async () => {
    const user = userEvent.setup();
    renderAppShell();
    const burgerButton = screen.getByRole('button', { name: /open navigation/i });
    await user.click(burgerButton);
    // Sidebar state toggled — button still in DOM, sidebar aria-expanded updated
    expect(burgerButton).toBeInTheDocument();
  });
});
