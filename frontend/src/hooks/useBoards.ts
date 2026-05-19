import { useQuery } from '@tanstack/react-query';
import { fetchBoards } from '../api/boardsApi';
import type { BoardListItem } from '../types/api';

export function useBoards() {
  return useQuery<BoardListItem[]>({
    queryKey: ['boards'],
    queryFn: fetchBoards,
  });
}
