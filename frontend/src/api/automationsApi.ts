import { apiClient } from './apiClient';
import type { AutomationRule } from '../types/domain';

export interface CreateAutomationRuleRequest {
  triggerType: AutomationRule['triggerType'];
  triggerConfig: Record<string, string>;
  actionType: AutomationRule['actionType'];
  actionConfig: Record<string, string>;
}

export function listAutomationRules(boardId: string): Promise<AutomationRule[]> {
  return apiClient.get<AutomationRule[]>(`/api/boards/${boardId}/automations`);
}

export function createAutomationRule(boardId: string, data: CreateAutomationRuleRequest): Promise<AutomationRule> {
  return apiClient.post<AutomationRule>(`/api/boards/${boardId}/automations`, data);
}

export function deleteAutomationRule(boardId: string, ruleId: string): Promise<void> {
  return apiClient.deleteEmpty(`/api/boards/${boardId}/automations/${ruleId}`);
}
