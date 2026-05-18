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
