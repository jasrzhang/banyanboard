import { apiClient } from './apiClient';
import type { ActivityEvent } from '../types/domain';

export function fetchActivity(boardId: string): Promise<ActivityEvent[]> {
  return apiClient.get<ActivityEvent[]>(`/api/boards/${boardId}/activity`);
}
