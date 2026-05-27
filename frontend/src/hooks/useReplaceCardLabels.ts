import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaceCardLabels } from '../api/labelsApi';
import type { Board, Label } from '../types/domain';

interface ReplaceInput {
  cardId: string;
  labelIds: string[];
  labels?: Label[]; // full Label objects for optimistic update
}

interface ReplaceContext {
  previous: Board | undefined;
}

function applyCardLabels(board: Board, cardId: string, labels: Label[]): Board {
  return {
    ...board,
    columns: board.columns.map((col) => ({
      ...col,
      cards: col.cards.map((card) =>
        card.id === cardId ? { ...card, labels } : card,
      ),
    })),
  };
}

export function useReplaceCardLabels(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ labels: Label[] }, Error, ReplaceInput, ReplaceContext>({
    mutationFn: ({ cardId, labelIds }) => replaceCardLabels(cardId, labelIds),
    onMutate: async ({ cardId, labelIds, labels }): Promise<ReplaceContext> => {
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      const previous = queryClient.getQueryData<Board>(['board', boardId]);
      if (previous) {
        let optimisticLabels: Label[];
        if (labels) {
          // Use explicitly provided labels (full objects from component)
          optimisticLabels = labels;
        } else {
          // Build from all known labels in the board cache plus the ['labels', boardId] cache
          const allCardLabels = previous.columns.flatMap((col) =>
            col.cards.flatMap((card) => card.labels),
          );
          const boardLabelCache = queryClient.getQueryData<Label[]>(['labels', boardId]) ?? [];
          const labelMap = new Map<string, Label>(
            [...allCardLabels, ...boardLabelCache].map((l) => [l.id, l]),
          );
          optimisticLabels = labelIds.map((id) => {
            const found = labelMap.get(id);
            // Fall back to a placeholder so IDs are always present in the optimistic state
            return found ?? { id, name: id, color: '#cccccc' };
          });
        }
        queryClient.setQueryData<Board>(['board', boardId], applyCardLabels(previous, cardId, optimisticLabels));
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

export { applyCardLabels };
