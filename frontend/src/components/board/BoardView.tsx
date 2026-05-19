import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useBoard } from '../../hooks/useBoard';
import { useMoveCard } from '../../hooks/useMoveCard';
import { useCreateCard } from '../../hooks/useCreateCard';
import type { Board, Card } from '../../types/domain';
import { Column } from './Column';
import { CardTile } from '../card/CardTile';
import { BoardErrorPanel } from './BoardErrorPanel';
import { ColumnSkeleton } from '../card/CardSkeleton';

interface BoardViewProps {
  boardId: string;
}

function findCardById(board: Board, cardId: string): Card | undefined {
  for (const col of board.columns) {
    const card = col.cards.find((c) => c.id === cardId);
    if (card) return card;
  }
  return undefined;
}

function findColumnByCardId(board: Board, cardId: string): string | undefined {
  for (const col of board.columns) {
    if (col.cards.some((c) => c.id === cardId)) return col.id;
  }
  return undefined;
}

function findTargetColumnId(board: Board, overId: string): string | undefined {
  if (board.columns.some((col) => col.id === overId)) return overId;
  return findColumnByCardId(board, overId);
}

function computeNewPosition(board: Board, draggedCardId: string, overId: string, targetColumnId: string): number {
  const targetColumn = board.columns.find((col) => col.id === targetColumnId);
  if (!targetColumn) return 1000;

  const targetCards = targetColumn.cards.filter((c) => c.id !== draggedCardId);

  if (targetCards.length === 0) return 1000;

  const overCardIndex = targetCards.findIndex((c) => c.id === overId);

  if (overCardIndex === -1) {
    return Math.max(...targetCards.map((c) => c.position)) + 1000;
  }

  if (overCardIndex === 0) {
    return Math.max(1, Math.floor(targetCards[0]!.position / 2));
  }

  const prevCard = targetCards[overCardIndex - 1]!;
  const overCard = targetCards[overCardIndex]!;
  return Math.floor((prevCard.position + overCard.position) / 2);
}

export function BoardView({ boardId }: BoardViewProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const { data: board, isLoading, isError, error, refetch } = useBoard(boardId);
  const { mutate: moveCardMutation } = useMoveCard(boardId);
  const { mutateAsync: createCardMutation } = useCreateCard(boardId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over || !board) return;

    const draggedCardId = String(active.id);
    const overId = String(over.id);

    const fromColumnId = findColumnByCardId(board, draggedCardId);
    const toColumnId = findTargetColumnId(board, overId);

    if (!fromColumnId || !toColumnId) return;
    if (fromColumnId === toColumnId && draggedCardId === overId) return;

    const newPosition = computeNewPosition(board, draggedCardId, overId, toColumnId);

    moveCardMutation({ cardId: draggedCardId, fromColumnId, toColumnId, position: newPosition });
  };

  const handleAddCard = (columnId: string, title: string) =>
    createCardMutation({ columnId, title });

  const activeCard = board && activeCardId ? findCardById(board, activeCardId) : null;

  if (isLoading) {
    return (
      <div
        className="flex flex-row gap-3 h-full px-4 py-4 overflow-x-auto"
        aria-busy="true"
        aria-label="Loading board"
      >
        <ColumnSkeleton />
        <ColumnSkeleton />
        <ColumnSkeleton />
      </div>
    );
  }

  if (isError || !board) {
    return (
      <BoardErrorPanel
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  if (board.columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 p-8 text-center h-full">
        <p className="text-text-secondary text-sm">This board has no columns. Contact your administrator.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex flex-row gap-3 h-full px-4 py-4 overflow-x-auto"
        aria-label="Kanban board columns"
        role="region"
      >
        {board.columns.map((column) => (
          <SortableContext
            key={column.id}
            items={column.cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <Column column={column} boardId={boardId} onAddCard={handleAddCard} />
          </SortableContext>
        ))}
        <DragOverlay>
          {activeCard ? <CardTile card={activeCard} boardId={boardId} isDragOverlay /> : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
