import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createCard } from '../api/boardsApi';
import type { Board, Card } from '../types/domain';

export interface CreateCardInput {
  columnId: string;
  title: string;
}

export function applyCreateOptimistic(board: Board, input: CreateCardInput, tempId: string): Board {
  const tempCard: Card = {
    id: tempId,
    columnId: input.columnId,
    title: input.title,
    description: null,
    dueDate: null,
    labels: [],
    position: Number.MAX_SAFE_INTEGER,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return {
    ...board,
    columns: board.columns.map((col) =>
      col.id === input.columnId ? { ...col, cards: [...col.cards, tempCard] } : col,
    ),
  };
}

export function replaceCard(board: Board, tempId: string, realCard: Card): Board {
  return {
    ...board,
    columns: board.columns.map((col) => ({
      ...col,
      cards: col.cards.map((c) => (c.id === tempId ? realCard : c)),
    })),
  };
}

export function useCreateCard(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCardInput) => createCard(input.columnId, { title: input.title }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      const previous = queryClient.getQueryData<Board>(['board', boardId]);
      const tempId = `temp-${crypto.randomUUID()}`;
      // If the board is not yet in cache (cold load / eviction), skip the optimistic write.
      // onSettled will invalidate the query and show the real card after the request completes.
      if (previous) {
        queryClient.setQueryData<Board>(['board', boardId], applyCreateOptimistic(previous, input, tempId));
      }
      return { previous, tempId };
    },
    onSuccess: (newCard, _input, context) => {
      if (!context?.tempId) return;
      const current = queryClient.getQueryData<Board>(['board', boardId]);
      if (current) {
        queryClient.setQueryData<Board>(['board', boardId], replaceCard(current, context.tempId, newCard));
      }
    },
    onError: (err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData<Board>(['board', boardId], context.previous);
      }
      toast.error('Failed to create card. Please try again.', {
        duration: 4000,
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });
}
