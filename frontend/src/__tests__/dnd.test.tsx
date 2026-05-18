import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { useMoveCard, applyMoveOptimistic } from '../hooks/useMoveCard';
import type { Board, Card } from '../types/domain';

vi.mock('../api/boardsApi', () => ({
  moveCard: vi.fn(),
  fetchBoard: vi.fn(),
  fetchBoards: vi.fn(),
  createCard: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

import { moveCard, fetchBoard } from '../api/boardsApi';
import { toast } from 'sonner';

const mockMoveCard = vi.mocked(moveCard);
const mockFetchBoard = vi.mocked(fetchBoard);
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
          title: 'Fix login bug',
          description: null,
          dueDate: null,
          labels: [],
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
          description: null,
          dueDate: null,
          labels: [],
          position: 1000,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    },
  ],
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

describe('applyMoveOptimistic', () => {
  it('removes card from source column and inserts into target column', () => {
    const result = applyMoveOptimistic(fixtureBoard, {
      cardId: 'card-1',
      fromColumnId: 'col-1',
      toColumnId: 'col-2',
      position: 2000,
    });

    const col1Cards = result.columns.find((c) => c.id === 'col-1')!.cards;
    const col2Cards = result.columns.find((c) => c.id === 'col-2')!.cards;

    expect(col1Cards.map((c) => c.id)).not.toContain('card-1');
    expect(col2Cards.map((c) => c.id)).toContain('card-1');
    expect(col2Cards.find((c) => c.id === 'card-1')!.columnId).toBe('col-2');
    expect(col2Cards.find((c) => c.id === 'card-1')!.position).toBe(2000);
  });

  it('badge counts (cards.length) reflect the cross-column move', () => {
    const result = applyMoveOptimistic(fixtureBoard, {
      cardId: 'card-1',
      fromColumnId: 'col-1',
      toColumnId: 'col-2',
      position: 2000,
    });

    expect(result.columns.find((c) => c.id === 'col-1')!.cards).toHaveLength(1);
    expect(result.columns.find((c) => c.id === 'col-2')!.cards).toHaveLength(2);
  });

  it('returns unchanged board reference when card is not found', () => {
    const result = applyMoveOptimistic(fixtureBoard, {
      cardId: 'nonexistent-card',
      fromColumnId: 'col-1',
      toColumnId: 'col-2',
      position: 1000,
    });

    expect(result).toBe(fixtureBoard);
  });
});

describe('useMoveCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBoard.mockReturnValue(new Promise<Board>(() => {}));
  });

  it('applies optimistic update to cache before server response resolves', async () => {
    mockMoveCard.mockReturnValue(new Promise<Card>(() => {}));

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['board', 'board-1'], fixtureBoard);

    const { result } = renderHook(() => useMoveCard('board-1'), { wrapper });

    act(() => {
      result.current.mutate({
        cardId: 'card-1',
        fromColumnId: 'col-1',
        toColumnId: 'col-2',
        position: 2000,
      });
    });

    await waitFor(() => {
      const board = queryClient.getQueryData<Board>(['board', 'board-1']);
      const col1Cards = board?.columns.find((c) => c.id === 'col-1')?.cards ?? [];
      const col2Cards = board?.columns.find((c) => c.id === 'col-2')?.cards ?? [];
      expect(col1Cards.map((c) => c.id)).not.toContain('card-1');
      expect(col2Cards.map((c) => c.id)).toContain('card-1');
    });
  });

  it('rolls back cache to previous state when mutation errors', async () => {
    mockMoveCard.mockRejectedValue(new Error('Server error'));

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['board', 'board-1'], fixtureBoard);

    const { result } = renderHook(() => useMoveCard('board-1'), { wrapper });

    act(() => {
      result.current.mutate({
        cardId: 'card-1',
        fromColumnId: 'col-1',
        toColumnId: 'col-2',
        position: 2000,
      });
    });

    await waitFor(() => {
      const board = queryClient.getQueryData<Board>(['board', 'board-1']);
      const col1Cards = board?.columns.find((c) => c.id === 'col-1')?.cards ?? [];
      expect(col1Cards.map((c) => c.id)).toContain('card-1');
    });
  });

  it('shows error toast when mutation fails with a non-abort error', async () => {
    mockMoveCard.mockRejectedValue(new Error('Network timeout'));

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['board', 'board-1'], fixtureBoard);

    const { result } = renderHook(() => useMoveCard('board-1'), { wrapper });

    act(() => {
      result.current.mutate({
        cardId: 'card-1',
        fromColumnId: 'col-1',
        toColumnId: 'col-2',
        position: 2000,
      });
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to move card. Please try again.',
        expect.objectContaining({ description: 'Network timeout' }),
      );
    });
  });
});
