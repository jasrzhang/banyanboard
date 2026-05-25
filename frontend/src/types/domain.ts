export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Card {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  labels: Label[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  cards: Card[];
}

export interface Board {
  id: string;
  name: string;
  columns: Column[];
  createdAt: string;
  updatedAt: string;
}

export type ActivityEventType = 'card_created' | 'card_moved' | 'card_updated' | 'card_deleted';

export interface ActivityEventPayload {
  cardTitle: string;
  columnName?: string;
  fromColumn?: string;
  toColumn?: string;
  changedFields?: string[];
}

export interface ActivityEvent {
  id: string;
  boardId: string;
  cardId: string | null;
  eventType: ActivityEventType;
  payload: ActivityEventPayload;
  createdAt: string;
}
