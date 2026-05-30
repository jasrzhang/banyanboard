import { useQuery } from '@tanstack/react-query';
import { listAutomationRules } from '../api/automationsApi';

export function useAutomationRules(boardId: string) {
  return useQuery({
    queryKey: ['automations', boardId],
    queryFn: () => listAutomationRules(boardId),
    staleTime: 30_000,
  });
}
