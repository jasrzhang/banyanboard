import { apiClient } from './apiClient';
import type { Board } from '../types/domain';
import type { BoardListItem, CreateCardRequest, UpdateCardRequest } from '../types/api';
import type { Card } from '../types/domain';

export function fetchBoards(): Promise<BoardListItem[]> {
  return apiClient.get<BoardListItem[]>('/api/boards');
}

export function fetchBoard(id: string): Promise<Board> {
  return apiClient.get<Board>(`/api/boards/${id}`);
}

export function createCard(columnId: string, data: CreateCardRequest): Promise<Card> {
  return apiClient.post<Card>(`/api/columns/${columnId}/cards`, data);
}

export function moveCard(cardId: string, data: UpdateCardRequest): Promise<Card> {
  return apiClient.patch<Card>(`/api/cards/${cardId}`, data);
}
