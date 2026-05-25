import type { ActivityEvent } from '../../types/domain';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

const CreatedIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const MovedIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const UpdatedIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeletedIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

function EventIcon({ eventType }: { eventType: ActivityEvent['eventType'] }) {
  switch (eventType) {
    case 'card_created': return <CreatedIcon />;
    case 'card_moved': return <MovedIcon />;
    case 'card_updated': return <UpdatedIcon />;
    case 'card_deleted': return <DeletedIcon />;
  }
}

function buildDetail(event: ActivityEvent): string {
  const { eventType, payload } = event;
  switch (eventType) {
    case 'card_created':
      return payload.columnName ? `added to ${payload.columnName}` : 'created';
    case 'card_moved':
      return payload.fromColumn && payload.toColumn
        ? `moved from ${payload.fromColumn} to ${payload.toColumn}`
        : 'moved';
    case 'card_updated':
      return 'updated';
    case 'card_deleted':
      return 'deleted';
  }
}

interface ActivityEntryProps {
  event: ActivityEvent;
}

export function ActivityEntry({ event }: ActivityEntryProps) {
  const cardTitle = event.payload.cardTitle ?? 'Unknown card';
  const detail = buildDetail(event);

  return (
    <li className="flex items-start gap-2 px-3 py-2 border-b border-border last:border-b-0 hover:bg-surface-sidebar">
      <span className="text-text-secondary mt-0.5 shrink-0">
        <EventIcon eventType={event.eventType} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-secondary">
          <span className="font-medium text-text-primary">{cardTitle}</span>
          {' '}{detail}
        </p>
        <time dateTime={event.createdAt} className="text-xs text-text-disabled">
          {formatRelativeTime(event.createdAt)}
        </time>
      </div>
    </li>
  );
}
