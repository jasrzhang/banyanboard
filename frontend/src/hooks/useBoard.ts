import { useQuery } from '@tanstack/react-query';
import { fetchBoard } from '../api/boardsApi';
import type { Board } from '../types/domain';

export function useBoard(boardId: string) {
  return useQuery<Board>({
    queryKey: ['board', boardId],
    queryFn: () => fetchBoard(boardId),
    enabled: !!boardId,
  });
}
