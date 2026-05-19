import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Board } from '../types/domain';
import type { UseQueryResult } from '@tanstack/react-query';

vi.mock('../hooks/useBoard');
vi.mock('../hooks/useBoards');

import { useBoard } from '../hooks/useBoard';
import { BoardView } from '../components/board/BoardView';
import { BoardDetailPage } from '../pages/BoardDetailPage';

const mockUseBoard = vi.mocked(useBoard);

type UseBoardResult = ReturnType<typeof useBoard>;

function makeBoardResult(overrides: Partial<UseQueryResult<Board>>): UseBoardResult {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isPending: false,
    isSuccess: false,
    isFetching: false,
    isRefetching: false,
    isStale: false,
    isPlaceholderData: false,
    status: 'success',
    fetchStatus: 'idle',
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isFetched: true,
    isFetchedAfterMount: true,
    isInitialLoading: false,
    isLoadingError: false,
    isRefetchError: false,
    promise: Promise.resolve(undefined as unknown as Board),
    ...overrides,
  } as unknown as UseBoardResult;
}

const fixtureBoard: Board = {
  id: 'board-1',
  name: 'Test Board',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  columns: [
    {
      id: 'col-1',
      boardId: 'board-1',
      name: 'To Do',
      position: 1000,
      cards: [
        {
          id: 'card-1',
          columnId: 'col-1',
          title: 'Fix login bug',
          description: 'The login form does not redirect after success.',
          dueDate: '2026-05-22T00:00:00Z',
          labels: [
            { id: 'lbl-1', name: 'bug', color: '#be123c' },
          ],
          position: 1000,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'card-2',
          columnId: 'col-1',
          title: 'Write API docs',
          description: null,
          dueDate: null,
          labels: [],
          position: 2000,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    },
    {
      id: 'col-2',
      boardId: 'board-1',
      name: 'In Progress',
      position: 2000,
      cards: [
        {
          id: 'card-3',
          columnId: 'col-2',
          title: 'Implement Kanban UI',
          description: 'Build the full board view with columns and cards.',
          dueDate: null,
          labels: [
            { id: 'lbl-2', name: 'frontend', color: '#0369a1' },
          ],
          position: 1000,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    },
    {
      id: 'col-3',
      boardId: 'board-1',
      name: 'Done',
      position: 3000,
      cards: [],
    },
  ],
};

const altFixtureBoard: Board = {
  ...fixtureBoard,
  columns: [
    {
      id: 'col-1',
      boardId: 'board-1',
      name: 'To Do',
      position: 1000,
      cards: [
        {
          id: 'card-alt-1',
          columnId: 'col-1',
          title: 'Completely Different Title',
          description: 'Different description here.',
          dueDate: null,
          labels: [],
          position: 1000,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    },
    {
      id: 'col-2',
      boardId: 'board-1',
      name: 'In Progress',
      position: 2000,
      cards: fixtureBoard.columns[1]?.cards ?? [],
    },
    {
      id: 'col-3',
      boardId: 'board-1',
      name: 'Done',
      position: 3000,
      cards: [],
    },
  ],
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function BoardViewWrapper({ boardId = 'board-1' }: { boardId?: string } = {}) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/boards/${boardId}`]}>
        <Routes>
          <Route path="/boards/:boardId" element={<BoardView boardId={boardId} />} />
          <Route path="/boards/:boardId/cards/:cardId" element={<div>Card detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BoardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders column names and card-count badges from fixture data', () => {
    mockUseBoard.mockReturnValue(makeBoardResult({ data: fixtureBoard, isSuccess: true }));

    render(<BoardViewWrapper />);

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();

    // Card count badges: col-1 has 2, col-2 has 1, col-3 has 0
    const badges = screen.getAllByRole('status');
    const counts = badges.map((b) => b.textContent);
    expect(counts).toContain('2');
    expect(counts).toContain('1');
    expect(counts).toContain('0');
  });

  it('renders card tiles with title, description preview, due date, and label chips', () => {
    mockUseBoard.mockReturnValue(makeBoardResult({ data: fixtureBoard, isSuccess: true }));

    render(<BoardViewWrapper />);

    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Write API docs')).toBeInTheDocument();
    expect(screen.getByText('Implement Kanban UI')).toBeInTheDocument();

    // Description preview for card-1
    expect(screen.getByText(/The login form does not redirect/)).toBeInTheDocument();

    // Label chip for card-1
    expect(screen.getByText('bug')).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
  });

  it('stub detection: changing fixture data changes rendered card titles', () => {
    mockUseBoard.mockReturnValue(makeBoardResult({ data: altFixtureBoard, isSuccess: true }));

    render(<BoardViewWrapper />);

    expect(screen.getByText('Completely Different Title')).toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
  });

  it('renders skeleton loading state when isLoading is true', () => {
    mockUseBoard.mockReturnValue(
      makeBoardResult({ data: undefined, isLoading: true, isPending: true, status: 'pending' }),
    );

    render(<BoardViewWrapper />);

    expect(screen.getByLabelText('Loading board')).toBeInTheDocument();
  });

  it('renders error panel with message and Retry button when fetch fails', () => {
    mockUseBoard.mockReturnValue(
      makeBoardResult({
        data: undefined,
        isError: true,
        isLoadingError: true,
        error: new Error('Network failure'),
        status: 'error',
      }),
    );

    render(<BoardViewWrapper />);

    expect(screen.getByText("We couldn't load this board")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('Retry button calls refetch', () => {
    const mockRefetch = vi.fn();
    mockUseBoard.mockReturnValue(
      makeBoardResult({
        data: undefined,
        isError: true,
        error: new Error('Network failure'),
        status: 'error',
        refetch: mockRefetch,
      }),
    );

    render(<BoardViewWrapper />);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRefetch).toHaveBeenCalledOnce();
  });

  it('renders "No cards yet" empty state for a column with zero cards', () => {
    mockUseBoard.mockReturnValue(makeBoardResult({ data: fixtureBoard, isSuccess: true }));

    render(<BoardViewWrapper />);

    // "Done" column has 0 cards
    expect(screen.getByText('No cards yet')).toBeInTheDocument();
  });

  it('null due dates do not render an empty date element', () => {
    mockUseBoard.mockReturnValue(makeBoardResult({ data: fixtureBoard, isSuccess: true }));

    render(<BoardViewWrapper />);

    // card-2 has null dueDate — no empty span should render near it
    const dateParts = screen.queryAllByTestId('card-due-date');
    // Only card-1 has a due date
    expect(dateParts).toHaveLength(1);
  });
});

describe('BoardView search and filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBoard.mockReturnValue(makeBoardResult({ data: fixtureBoard, isSuccess: true }));
  });

  it('renders board name in the board header', () => {
    render(<BoardViewWrapper />);
    expect(screen.getByText('Test Board')).toBeInTheDocument();
  });

  it('renders search input in the board header', () => {
    render(<BoardViewWrapper />);
    expect(screen.getByPlaceholderText('Search cards...')).toBeInTheDocument();
  });

  it('renders New Card button in the board header', () => {
    render(<BoardViewWrapper />);
    expect(screen.getByRole('button', { name: /new card/i })).toBeInTheDocument();
  });

  it('typing in search input hides non-matching cards', () => {
    render(<BoardViewWrapper />);
    const searchInput = screen.getByPlaceholderText('Search cards...');
    fireEvent.change(searchInput, { target: { value: 'login' } });
    // 'Fix login bug' matches; 'Write API docs' and 'Implement Kanban UI' do not
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.queryByText('Write API docs')).not.toBeInTheDocument();
    expect(screen.queryByText('Implement Kanban UI')).not.toBeInTheDocument();
  });

  it('clearing search input restores all cards', () => {
    render(<BoardViewWrapper />);
    const searchInput = screen.getByPlaceholderText('Search cards...');
    fireEvent.change(searchInput, { target: { value: 'login' } });
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Write API docs')).toBeInTheDocument();
    expect(screen.getByText('Implement Kanban UI')).toBeInTheDocument();
  });

  it('clicking a label chip hides cards without that label', () => {
    render(<BoardViewWrapper />);
    // Open the Filters panel
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    // Scope to filter panel to avoid matching label chips on card tiles
    const filterPanel = screen.getByRole('group', { name: /filter options/i });
    fireEvent.click(within(filterPanel).getByRole('button', { name: /^bug$/i }));
    // card-1 has 'bug' label → visible; others are not
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.queryByText('Write API docs')).not.toBeInTheDocument();
    expect(screen.queryByText('Implement Kanban UI')).not.toBeInTheDocument();
  });

  it('clicking an active label chip removes the filter and restores cards', () => {
    render(<BoardViewWrapper />);
    // Open filters, activate bug chip
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    const filterPanel = screen.getByRole('group', { name: /filter options/i });
    fireEvent.click(within(filterPanel).getByRole('button', { name: /^bug$/i }));
    // Now deactivate it
    fireEvent.click(within(filterPanel).getByRole('button', { name: /^bug$/i }));
    // All cards should be visible
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Write API docs')).toBeInTheDocument();
    expect(screen.getByText('Implement Kanban UI')).toBeInTheDocument();
  });
});

describe('BoardDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders BoardView when useBoard returns data (AC-ENTRY-1: no "coming soon" text)', () => {
    mockUseBoard.mockReturnValue(makeBoardResult({ data: fixtureBoard, isSuccess: true }));

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter initialEntries={['/boards/board-1']}>
          <Routes>
            <Route path="/boards/:boardId" element={<BoardDetailPage />} />
            <Route path="/boards/:boardId/cards/:cardId" element={<div>Card detail</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });
});
