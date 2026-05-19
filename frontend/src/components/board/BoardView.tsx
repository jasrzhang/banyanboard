import { useState, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
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
import type { Board, Card, Label } from '../../types/domain';
import { Column } from './Column';
import { CardTile } from '../card/CardTile';
import { BoardErrorPanel } from './BoardErrorPanel';
import { ColumnSkeleton } from '../card/CardSkeleton';
import { BoardHeader } from './BoardHeader';
import { filterCards } from '../../utils/filterCards';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLabelIds, setActiveLabelIds] = useState<string[]>([]);
  const [activeDateFilter, setActiveDateFilter] = useState<'none' | 'overdue' | 'due-soon'>('none');

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

  const handleAddCard = async (columnId: string, title: string): Promise<void> => {
    await createCardMutation({ columnId, title });
  };

  const toggleLabel = (id: string) => {
    setActiveLabelIds((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id],
    );
  };

  const toggleDateFilter = (filter: 'overdue' | 'due-soon') => {
    setActiveDateFilter((prev) => (prev === filter ? 'none' : filter));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveLabelIds([]);
    setActiveDateFilter('none');
  };

  const allLabels = useMemo<Label[]>(() => {
    if (!board) return [];
    const seen = new Map<string, Label>();
    for (const col of board.columns) {
      for (const card of col.cards) {
        for (const label of card.labels) {
          if (!seen.has(label.id)) {
            seen.set(label.id, label);
          }
        }
      }
    }
    return Array.from(seen.values());
  }, [board]);

  const hasActiveFilters =
    searchQuery.length > 0 || activeLabelIds.length > 0 || activeDateFilter !== 'none';

  const filteredColumns = useMemo(() => {
    if (!board) return [];
    if (!hasActiveFilters) return board.columns;
    return board.columns.map((col) => ({
      ...col,
      cards: filterCards(col.cards, { searchQuery, activeLabelIds, activeDateFilter }),
    }));
  }, [board, searchQuery, activeLabelIds, activeDateFilter, hasActiveFilters]);

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
    <div className="flex flex-col h-full">
      <BoardHeader
        boardName={board.name}
        labels={allLabels}
        searchQuery={searchQuery}
        activeLabelIds={activeLabelIds}
        activeDateFilter={activeDateFilter}
        onSearchChange={setSearchQuery}
        onLabelToggle={toggleLabel}
        onDateFilterChange={toggleDateFilter}
        onClearFilters={clearFilters}
      />
      <div className="flex-1 overflow-hidden relative">
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
            {filteredColumns.map((filteredColumn) => (
              <SortableContext
                key={filteredColumn.id}
                items={filteredColumn.cards.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <Column
                  column={filteredColumn}
                  boardId={boardId}
                  onAddCard={handleAddCard}
                  isFiltering={hasActiveFilters}
                />
              </SortableContext>
            ))}
            <DragOverlay>
              {activeCard ? <CardTile card={activeCard} boardId={boardId} isDragOverlay /> : null}
            </DragOverlay>
          </div>
        </DndContext>
        <Outlet />
      </div>
    </div>
  );
}
