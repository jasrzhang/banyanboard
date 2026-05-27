import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLabel, fetchLabels } from '../api/labelsApi';
import type { CreateLabelRequest } from '../types/api';

export function useCreateLabel(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLabelRequest) => createLabel(boardId, data),
    onSuccess: async () => {
      await queryClient.fetchQuery({
        queryKey: ['labels', boardId],
        queryFn: () => fetchLabels(boardId),
        staleTime: 0,
      });
    },
  });
}
