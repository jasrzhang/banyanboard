import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { useCreateCard, applyCreateOptimistic, replaceCard } from '../hooks/useCreateCard';
import { AddCardForm } from '../components/card/AddCardForm';
import type { Board, Card } from '../types/domain';

vi.mock('../api/boardsApi', () => ({
  createCard: vi.fn(),
  moveCard: vi.fn(),
  fetchBoard: vi.fn(),
  fetchBoards: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

import { createCard } from '../api/boardsApi';
import { toast } from 'sonner';

const mockCreateCard = vi.mocked(createCard);
const mockToastError = (toast as unknown as { error: ReturnType<typeof vi.fn> }).error;

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
          title: 'Existing card',
          description: null,
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
      cards: [],
    },
  ],
};

const realCard: Card = {
  id: 'card-server-99',
  columnId: 'col-1',
  title: 'New card',
  description: null,
  dueDate: null,
  labels: [],
  position: 2000,
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

// ─── pure function tests ────────────────────────────────────────────────────

describe('applyCreateOptimistic', () => {
  it('appends temp card to the target column', () => {
    const result = applyCreateOptimistic(fixtureBoard, { columnId: 'col-1', title: 'New card' }, 'temp-1');

    const col1Cards = result.columns.find((c) => c.id === 'col-1')!.cards;
    expect(col1Cards).toHaveLength(2);
    expect(col1Cards[col1Cards.length - 1]!.id).toBe('temp-1');
    expect(col1Cards[col1Cards.length - 1]!.title).toBe('New card');
  });

  it('does not affect other columns', () => {
    const result = applyCreateOptimistic(fixtureBoard, { columnId: 'col-1', title: 'New card' }, 'temp-1');

    const col2Cards = result.columns.find((c) => c.id === 'col-2')!.cards;
    expect(col2Cards).toHaveLength(0);
  });

  it('badge count (cards.length) increments for target column', () => {
    const before = fixtureBoard.columns.find((c) => c.id === 'col-1')!.cards.length;
    const result = applyCreateOptimistic(fixtureBoard, { columnId: 'col-1', title: 'New card' }, 'temp-1');
    const after = result.columns.find((c) => c.id === 'col-1')!.cards.length;
    expect(after).toBe(before + 1);
  });
});

describe('replaceCard', () => {
  it('replaces temp card with real server card', () => {
    const boardWithTemp = applyCreateOptimistic(
      fixtureBoard,
      { columnId: 'col-1', title: 'New card' },
      'temp-1',
    );
    const result = replaceCard(boardWithTemp, 'temp-1', realCard);

    const col1Cards = result.columns.find((c) => c.id === 'col-1')!.cards;
    expect(col1Cards.find((c) => c.id === 'temp-1')).toBeUndefined();
    expect(col1Cards.find((c) => c.id === realCard.id)).toBeDefined();
    expect(col1Cards.find((c) => c.id === realCard.id)!.title).toBe(realCard.title);
  });

  it('leaves other cards unchanged', () => {
    const boardWithTemp = applyCreateOptimistic(
      fixtureBoard,
      { columnId: 'col-1', title: 'New card' },
      'temp-1',
    );
    const result = replaceCard(boardWithTemp, 'temp-1', realCard);

    const col1Cards = result.columns.find((c) => c.id === 'col-1')!.cards;
    expect(col1Cards.find((c) => c.id === 'card-1')).toBeDefined();
  });
});

// ─── hook tests ─────────────────────────────────────────────────────────────

describe('useCreateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends temp card to cache before server responds', async () => {
    mockCreateCard.mockReturnValue(new Promise<Card>(() => {}));

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['board', 'board-1'], fixtureBoard);

    const { result } = renderHook(() => useCreateCard('board-1'), { wrapper });

    act(() => {
      result.current.mutate({ columnId: 'col-1', title: 'New card' });
    });

    await waitFor(() => {
      const board = queryClient.getQueryData<Board>(['board', 'board-1']);
      const col1Cards = board?.columns.find((c) => c.id === 'col-1')?.cards ?? [];
      expect(col1Cards.some((c) => c.title === 'New card')).toBe(true);
    });
  });

  it('replaces temp card with real server card on success', async () => {
    mockCreateCard.mockResolvedValue(realCard);

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['board', 'board-1'], fixtureBoard);

    const { result } = renderHook(() => useCreateCard('board-1'), { wrapper });

    act(() => {
      result.current.mutate({ columnId: 'col-1', title: 'New card' });
    });

    await waitFor(() => result.current.isSuccess);

    const board = queryClient.getQueryData<Board>(['board', 'board-1']);
    const col1Cards = board?.columns.find((c) => c.id === 'col-1')?.cards ?? [];
    expect(col1Cards.find((c) => c.id === realCard.id)).toBeDefined();
    expect(col1Cards.find((c) => c.id?.startsWith('temp-'))).toBeUndefined();
  });

  it('fires mutation without optimistic write when board is not in cache', async () => {
    mockCreateCard.mockResolvedValue(realCard);
    const { queryClient, wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateCard('board-1'), { wrapper });

    act(() => {
      result.current.mutate({ columnId: 'col-1', title: 'New card' });
    });

    await waitFor(() => result.current.isSuccess);

    const board = queryClient.getQueryData<Board>(['board', 'board-1']);
    expect(board).toBeUndefined();
  });

  it('restores cache and shows error toast when mutation fails', async () => {
    mockCreateCard.mockRejectedValue(new Error('Server unavailable'));

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['board', 'board-1'], fixtureBoard);

    const { result } = renderHook(() => useCreateCard('board-1'), { wrapper });

    act(() => {
      result.current.mutate({ columnId: 'col-1', title: 'New card' });
    });

    await waitFor(() => result.current.isError);

    const board = queryClient.getQueryData<Board>(['board', 'board-1']);
    const col1Cards = board?.columns.find((c) => c.id === 'col-1')?.cards ?? [];
    expect(col1Cards.find((c) => c.id?.startsWith('temp-'))).toBeUndefined();
    expect(col1Cards).toHaveLength(fixtureBoard.columns[0]!.cards.length);

    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to create card. Please try again.',
      expect.objectContaining({ description: 'Server unavailable' }),
    );
  });
});

// ─── AddCardForm component tests ─────────────────────────────────────────────

describe('AddCardForm', () => {
  it('renders in closed state (trigger button visible, textarea hidden)', () => {
    render(<AddCardForm columnId="col-1" onAdd={vi.fn()} />);

    expect(screen.getByRole('button', { name: /add a card/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens form and focuses textarea when trigger button is clicked', () => {
    render(<AddCardForm columnId="col-1" onAdd={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /add a card/i }));

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onAdd with columnId and trimmed title, then closes form', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCardForm columnId="col-1" onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: /add a card/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Write API docs  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('col-1', 'Write API docs');
    });

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  it('keeps form open when onAdd rejects (error recovery)', async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<AddCardForm columnId="col-1" onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: /add a card/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New card' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
