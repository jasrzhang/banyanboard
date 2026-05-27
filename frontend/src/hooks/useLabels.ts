import { useQuery } from '@tanstack/react-query';
import { fetchLabels } from '../api/labelsApi';

export function useLabels(boardId: string) {
  return useQuery({
    queryKey: ['labels', boardId],
    queryFn: () => fetchLabels(boardId),
    staleTime: 30_000,
  });
}
