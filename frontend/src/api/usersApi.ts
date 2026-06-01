import { apiClient } from './apiClient';
import type { User } from '../types/domain';

export function login(firstName: string): Promise<User> {
  return apiClient.post<User>('/api/users/login', { firstName });
}
