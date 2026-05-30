export interface Label {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
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

export interface AutomationRule {
  id: string;
  boardId: string;
  triggerType: 'card_moved_to_column' | 'card_label_assigned' | 'card_due_date_set';
  triggerConfig: Record<string, string>;
  actionType: 'assign_label' | 'move_to_column' | 'notify';
  actionConfig: Record<string, string>;
  enabled: boolean;
  createdAt: string;
}

export type ActivityEventType = 'card_created' | 'card_moved' | 'card_updated' | 'card_deleted' | 'automation_triggered';

export interface ActivityEventPayload {
  cardTitle: string;
  columnName?: string;
  fromColumn?: string;
  toColumn?: string;
  changedFields?: string[];
  actionType?: string;
  appliedLabelName?: string;
  targetColumnName?: string;
}

export interface ActivityEvent {
  id: string;
  boardId: string;
  cardId: string | null;
  eventType: ActivityEventType;
  payload: ActivityEventPayload;
  createdAt: string;
}
