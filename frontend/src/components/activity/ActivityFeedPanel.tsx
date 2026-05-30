import { useEffect } from 'react';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { ActivityEntry } from './ActivityEntry';

interface ActivityFeedPanelProps {
  boardId: string;
  onClose: () => void;
}

export function ActivityFeedPanel({ boardId, onClose }: ActivityFeedPanelProps) {
  const { events, status, retry } = useActivityFeed(boardId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <aside
      aria-label="Activity"
      className="flex-shrink-0 w-80 border-l border-border bg-surface-card flex flex-col h-full overflow-hidden"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">Activity</h2>
        <button
          type="button"
          aria-label="Close activity feed"
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
        >
          ×
        </button>
      </div>

      {/* Status indicator */}
      <div className="px-3 py-1.5 border-b border-border flex-shrink-0 min-h-[2rem] flex items-center">
        {status === 'connecting' && (
          <span className="flex items-center gap-1.5 text-xs text-text-disabled">
            <span className="inline-block h-2 w-2 rounded-full bg-text-disabled animate-pulse" aria-hidden="true" />
            Connecting…
          </span>
        )}
        {status === 'connected' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
            Live
          </span>
        )}
        {status === 'reconnecting' && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <svg
              className="h-3 w-3 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="M4 12a8 8 0 0 1 8-8" />
            </svg>
            Reconnecting…
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-rose-600 w-full justify-between">
            <span>Live updates unavailable</span>
            <button
              type="button"
              onClick={retry}
              className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
            >
              Retry
            </button>
          </span>
        )}
      </div>

      {/* Entries / empty state */}
      {events.length === 0 && status !== 'error' ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 px-4 py-8 text-center">
          <svg
            className="h-8 w-8 text-text-disabled"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p className="text-sm text-text-secondary">No activity yet</p>
          <p className="text-xs text-text-disabled">
            Actions on this board will appear here as they happen.
          </p>
        </div>
      ) : (
        <ol
          role="log"
          aria-live="polite"
          aria-label="Activity entries"
          className="flex-1 overflow-y-auto"
        >
          {events.map((event) => (
            <ActivityEntry key={event.id} event={event} />
          ))}
        </ol>
      )}
    </aside>
  );
}
