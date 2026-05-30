import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAutomationRule, listAutomationRules } from '../api/automationsApi';

export function useDeleteAutomationRule(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => deleteAutomationRule(boardId, ruleId),
    onSuccess: async () => {
      await queryClient.fetchQuery({
        queryKey: ['automations', boardId],
        queryFn: () => listAutomationRules(boardId),
        staleTime: 0,
      });
    },
  });
}
