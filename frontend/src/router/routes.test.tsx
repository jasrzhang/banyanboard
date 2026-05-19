import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { routes } from './index';

vi.mock('../hooks/useBoards');
vi.mock('../hooks/useBoard');

import { useBoards } from '../hooks/useBoards';
import { useBoard } from '../hooks/useBoard';

const mockUseBoards = vi.mocked(useBoards);
const mockUseBoard = vi.mocked(useBoard);

function renderRoute(path: string) {
  mockUseBoards.mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useBoards>);
  mockUseBoard.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useBoard>);

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const testRouter = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={testRouter} />
    </QueryClientProvider>,
  );
}

describe('Routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders BoardListPage at /boards', () => {
    renderRoute('/boards');
    expect(screen.getByText(/boards — coming soon/i)).toBeInTheDocument();
  });

  it('renders BoardDetailPage at /boards/:boardId (shows loading skeleton, not old placeholder)', () => {
    renderRoute('/boards/abc-123');
    expect(screen.queryByText(/board abc-123 — coming soon/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/loading board/i)).toBeInTheDocument();
  });

  it('redirects root \/ to \/boards', () => {
    renderRoute('/');
    expect(screen.getByText(/boards — coming soon/i)).toBeInTheDocument();
  });
});
