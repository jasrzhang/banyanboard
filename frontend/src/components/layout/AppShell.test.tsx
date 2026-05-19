import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { AppShell } from './AppShell';
import { BoardListPage } from '../../pages/BoardListPage';
import { BoardDetailPage } from '../../pages/BoardDetailPage';

vi.mock('../../hooks/useBoards');
vi.mock('../../hooks/useBoard');

import { useBoards } from '../../hooks/useBoards';
import { useBoard } from '../../hooks/useBoard';

const mockUseBoards = vi.mocked(useBoards);
const mockUseBoard = vi.mocked(useBoard);

const mockBoards = [
  { id: 'board-1', name: 'My Board', updatedAt: '2026-01-01T00:00:00Z' },
];

function renderAppShell(initialPath = '/boards') {
  mockUseBoards.mockReturnValue({ data: mockBoards, isLoading: false } as unknown as ReturnType<typeof useBoards>);
  mockUseBoard.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useBoard>);

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('AppShell', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all three layout zones — sidebar, header, and main', () => {
    renderAppShell();
    expect(screen.getByRole('navigation', { name: /navigation sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders board nav links from the API in the sidebar', () => {
    renderAppShell();
    expect(screen.getByRole('link', { name: /my board/i })).toBeInTheDocument();
  });

  it('renders BanyanBoard wordmark in the generic top bar', () => {
    renderAppShell();
    const header = screen.getByRole('banner');
    expect(header).toHaveTextContent('BanyanBoard');
  });

  it('burger menu button toggles sidebar open state without crashing', async () => {
    const user = userEvent.setup();
    renderAppShell();
    const burgerButton = screen.getByRole('button', { name: /open navigation/i });
    await user.click(burgerButton);
    expect(burgerButton).toBeInTheDocument();
  });
});
