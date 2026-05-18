import { useNavigate } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '../../types/domain';

interface CardTileProps {
  card: Card;
  boardId: string;
  isDragOverlay?: boolean;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(isoDate: string): boolean {
  return new Date(isoDate) < new Date();
}

function GripIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export function CardTile({ card, boardId, isDragOverlay = false }: CardTileProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: isDragOverlay,
  });

  const style = isDragOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const wrapperClasses = isDragOverlay
    ? 'bg-surface-card rounded-lg border border-border shadow-xl rotate-1 scale-105 p-3'
    : [
        'group relative bg-surface-card rounded-lg border border-border',
        'transition-shadow duration-150 p-3 cursor-default',
        isDragging ? 'opacity-30 border-dashed shadow-none' : 'shadow-sm hover:shadow-md',
      ].join(' ');

  return (
    <div ref={isDragOverlay ? undefined : setNodeRef} style={style} className={wrapperClasses}>
      <div className="flex items-start gap-2">
        {/* Drag handle — activates DnD drag */}
        <button
          {...(!isDragOverlay ? listeners : {})}
          {...(!isDragOverlay ? attributes : {})}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-100
                     text-text-disabled hover:text-text-secondary
                     cursor-grab active:cursor-grabbing
                     flex-shrink-0 mt-0.5 p-0.5 -ml-1 rounded"
          aria-label="Drag to reorder card"
          tabIndex={isDragOverlay ? -1 : 0}
        >
          <GripIcon />
        </button>

        {/* Card body — clickable, navigates to card detail */}
        <button
          onClick={() => {
            if (!isDragging && !isDragOverlay) {
              navigate(`/boards/${boardId}/cards/${card.id}`);
            }
          }}
          className="flex-1 text-left min-w-0 focus:outline-none focus:ring-2
                     focus:ring-primary focus:ring-offset-1 rounded"
          tabIndex={isDragOverlay ? -1 : 0}
        >
          <p className="text-sm font-medium text-text-primary leading-snug mb-1">{card.title}</p>

          {card.description && (
            <p className="text-xs text-text-secondary line-clamp-2 mb-2">{card.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {card.dueDate && (
              <span
                data-testid="card-due-date"
                className={`text-xs ${isOverdue(card.dueDate) ? 'text-red-600' : 'text-text-secondary'}`}
              >
                {formatDate(card.dueDate)}
              </span>
            )}
            {card.labels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: label.color + '33', color: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        </button>
      </div>
    </div>
  );
}
