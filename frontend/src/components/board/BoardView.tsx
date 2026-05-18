import { useQueryClient } from '@tanstack/react-query';
import { useBoard } from '../../hooks/useBoard';
import { createCard } from '../../api/boardsApi';
import { Column } from './Column';
import { BoardErrorPanel } from './BoardErrorPanel';
import { ColumnSkeleton } from '../card/CardSkeleton';

interface BoardViewProps {
  boardId: string;
}

export function BoardView({ boardId }: BoardViewProps) {
  const queryClient = useQueryClient();
  const { data: board, isLoading, isError, error, refetch } = useBoard(boardId);

  const handleAddCard = async (columnId: string, title: string) => {
    const newCard = await createCard(columnId, { title });
    queryClient.setQueryData(
      ['board', boardId],
      (old: typeof board) => {
        if (!old) return old;
        return {
          ...old,
          columns: old.columns.map((col) =>
            col.id === columnId
              ? { ...col, cards: [...col.cards, newCard] }
              : col,
          ),
        };
      },
    );
  };

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
    <div
      className="flex flex-row gap-3 h-full px-4 py-4 overflow-x-auto"
      aria-label="Kanban board columns"
      role="region"
    >
      {board.columns.map((column) => (
        <Column
          key={column.id}
          column={column}
          boardId={boardId}
          onAddCard={handleAddCard}
        />
      ))}
    </div>
  );
}
