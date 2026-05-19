import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCard } from '../api/boardsApi';
import type { UpdateCardRequest } from '../types/api';
import type { Board, Card } from '../types/domain';

interface UpdateCardInput {
  cardId: string;
  data: UpdateCardRequest;
}

function applyCardUpdate(board: Board, cardId: string, data: UpdateCardRequest): Board {
  return {
    ...board,
    columns: board.columns.map((col) => ({
      ...col,
      cards: col.cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              ...(data.title !== undefined ? { title: data.title } : {}),
              ...(data.description !== undefined ? { description: data.description } : {}),
              ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
            }
          : card,
      ),
    })),
  };
}

interface UpdateContext {
  previous: Board | undefined;
}

export function useUpdateCard(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation<Card, Error, UpdateCardInput, UpdateContext>({
    mutationFn: ({ cardId, data }) => updateCard(cardId, data),
    onMutate: async ({ cardId, data }): Promise<UpdateContext> => {
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      const previous = queryClient.getQueryData<Board>(['board', boardId]);
      if (previous) {
        queryClient.setQueryData<Board>(['board', boardId], applyCardUpdate(previous, cardId, data));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<Board>(['board', boardId], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });
}

export { applyCardUpdate };
