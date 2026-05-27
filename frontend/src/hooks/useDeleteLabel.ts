import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteLabel, fetchLabels } from '../api/labelsApi';

export function useDeleteLabel(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (labelId: string) => deleteLabel(boardId, labelId),
    onSuccess: async () => {
      await queryClient.fetchQuery({
        queryKey: ['labels', boardId],
        queryFn: () => fetchLabels(boardId),
        staleTime: 0,
      });
    },
  });
}
