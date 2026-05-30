import type { Ref } from 'react';
import type { Label } from '../../types/domain';
import { SearchInput } from '../filters/SearchInput';
import { FiltersDropdown } from '../filters/FiltersDropdown';

interface BoardHeaderProps {
  boardName: string;
  labels: Label[];
  searchQuery: string;
  activeLabelIds: string[];
  activeDateFilter: 'none' | 'overdue' | 'due-soon';
  onSearchChange: (query: string) => void;
  onLabelToggle: (id: string) => void;
  onDateFilterChange: (filter: 'overdue' | 'due-soon') => void;
  onClearFilters: () => void;
  activityOpen: boolean;
  onActivityToggle: () => void;
  activityToggleRef?: Ref<HTMLButtonElement>;
  automationsOpen: boolean;
  onAutomationsToggle: () => void;
  automationsToggleRef?: Ref<HTMLButtonElement>;
}

export function BoardHeader({
  boardName,
  labels,
  searchQuery,
  activeLabelIds,
  activeDateFilter,
  onSearchChange,
  onLabelToggle,
  onDateFilterChange,
  onClearFilters,
  activityOpen,
  onActivityToggle,
  activityToggleRef,
  automationsOpen,
  onAutomationsToggle,
  automationsToggleRef,
}: BoardHeaderProps) {
  return (
    <div className="bg-surface-card border-b border-border h-14 flex items-center px-4 gap-3 shrink-0">
      <h1 className="text-xl font-semibold text-text-primary truncate min-w-0 flex-shrink">
        {boardName}
      </h1>
      <div className="flex-1 flex items-center gap-2 justify-end">
        <SearchInput value={searchQuery} onChange={onSearchChange} />
        <FiltersDropdown
          labels={labels}
          activeLabelIds={activeLabelIds}
          activeDateFilter={activeDateFilter}
          onLabelToggle={onLabelToggle}
          onDateFilterChange={onDateFilterChange}
          onClearAll={onClearFilters}
        />
        <button
          ref={activityToggleRef}
          type="button"
          aria-pressed={activityOpen}
          aria-label="Toggle activity feed"
          onClick={onActivityToggle}
          className={`px-2.5 py-1 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-colors duration-150 flex items-center gap-1 ${
            activityOpen
              ? 'bg-primary text-primary-foreground'
              : 'bg-nav-hover text-text-secondary hover:bg-border'
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Activity
        </button>
        <button
          ref={automationsToggleRef}
          type="button"
          aria-pressed={automationsOpen}
          aria-label="Toggle automations"
          onClick={onAutomationsToggle}
          className={`px-2.5 py-1 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-colors duration-150 flex items-center gap-1 ${
            automationsOpen
              ? 'bg-primary text-primary-foreground'
              : 'bg-nav-hover text-text-secondary hover:bg-border'
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Automations
        </button>
        <button
          type="button"
          className="bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150"
        >
          New Card
        </button>
      </div>
    </div>
  );
}
