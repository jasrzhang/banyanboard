import { useDroppable } from '@dnd-kit/core';
import type { Column as ColumnType } from '../../types/domain';
import { CardTile } from '../card/CardTile';
import { AddCardForm } from '../card/AddCardForm';

interface ColumnProps {
  column: ColumnType;
  boardId: string;
  onAddCard: (columnId: string, title: string) => Promise<void>;
}

export function Column({ column, boardId, onAddCard }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className="flex-shrink-0 w-[300px] flex flex-col rounded-xl bg-surface-sidebar border border-border max-h-full overflow-y-auto">
      {/* Sticky column header */}
      <div className="sticky top-0 z-10 bg-surface-sidebar px-3 pt-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary truncate">{column.name}</h2>
          <span
            className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5
                       rounded-full text-xs font-medium bg-border text-text-secondary
                       shrink-0 tabular-nums"
            role="status"
            aria-label={`${column.cards.length} cards`}
          >
            {column.cards.length}
          </span>
        </div>
      </div>

      {/* Card list — droppable zone */}
      <div ref={setNodeRef} className="flex flex-col gap-2 p-2 flex-1">
        {column.cards.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center
                       min-h-[100px] p-4 rounded-lg
                       border-2 border-dashed border-border
                       text-text-disabled text-sm text-center
                       mx-2 my-1"
          >
            No cards yet
          </div>
        ) : (
          column.cards.map((card) => (
            <CardTile key={card.id} card={card} boardId={boardId} />
          ))
        )}
      </div>

      {/* Add card affordance */}
      <div className="px-2 pb-2">
        <AddCardForm columnId={column.id} onAdd={onAddCard} />
      </div>
    </div>
  );
}
