import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAutomationRule, listAutomationRules } from '../api/automationsApi';
import type { CreateAutomationRuleRequest } from '../api/automationsApi';

export function useCreateAutomationRule(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAutomationRuleRequest) => createAutomationRule(boardId, data),
    onSuccess: async () => {
      await queryClient.fetchQuery({
        queryKey: ['automations', boardId],
        queryFn: () => listAutomationRules(boardId),
        staleTime: 0,
      });
    },
  });
}
