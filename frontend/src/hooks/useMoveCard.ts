import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { moveCard } from '../api/boardsApi';
import type { Board, Card } from '../types/domain';

export interface MoveCardInput {
  cardId: string;
  fromColumnId: string;
  toColumnId: string;
  position: number;
}

export function applyMoveOptimistic(board: Board, input: MoveCardInput): Board {
  let movedCard: Card | undefined;

  const withCardRemoved = board.columns.map((col) => {
    if (col.id === input.fromColumnId) {
      movedCard = col.cards.find((c) => c.id === input.cardId);
      return { ...col, cards: col.cards.filter((c) => c.id !== input.cardId) };
    }
    return col;
  });

  if (!movedCard) return board;

  const updatedCard: Card = { ...movedCard, columnId: input.toColumnId, position: input.position };

  return {
    ...board,
    columns: withCardRemoved.map((col) => {
      if (col.id === input.toColumnId) {
        const newCards = [...col.cards, updatedCard].sort((a, b) => a.position - b.position);
        return { ...col, cards: newCards };
      }
      return col;
    }),
  };
}

export function useMoveCard(boardId: string) {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  return useMutation({
    mutationFn: async (input: MoveCardInput) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      return moveCard(
        input.cardId,
        { columnId: input.toColumnId, position: input.position },
        { signal: controller.signal },
      );
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      const previous = queryClient.getQueryData<Board>(['board', boardId]);
      if (previous) {
        queryClient.setQueryData<Board>(['board', boardId], applyMoveOptimistic(previous, input));
      }
      return { previous };
    },
    onError: (err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['board', boardId], context.previous);
      }
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        toast.error('Failed to move card. Please try again.', {
          duration: 4000,
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });
}
