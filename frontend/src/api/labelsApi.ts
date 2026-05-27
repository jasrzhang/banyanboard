import { apiClient } from './apiClient';
import type { Label } from '../types/domain';
import type { CreateLabelRequest, UpdateLabelRequest, ReplaceCardLabelsResponse } from '../types/api';

export function fetchLabels(boardId: string): Promise<Label[]> {
  return apiClient.get<Label[]>(`/api/boards/${boardId}/labels`);
}

export function createLabel(boardId: string, data: CreateLabelRequest): Promise<Label> {
  return apiClient.post<Label>(`/api/boards/${boardId}/labels`, data);
}

export function updateLabel(boardId: string, labelId: string, data: UpdateLabelRequest): Promise<Label> {
  return apiClient.patch<Label>(`/api/boards/${boardId}/labels/${labelId}`, data);
}

export function deleteLabel(boardId: string, labelId: string): Promise<void> {
  return apiClient.delete<void>(`/api/boards/${boardId}/labels/${labelId}`);
}

export function replaceCardLabels(cardId: string, labelIds: string[]): Promise<ReplaceCardLabelsResponse> {
  return apiClient.put<ReplaceCardLabelsResponse>(`/api/cards/${cardId}/labels`, { labelIds });
}
