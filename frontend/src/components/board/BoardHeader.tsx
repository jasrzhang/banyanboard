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
          type="button"
          className="bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150"
        >
          New Card
        </button>
      </div>
    </div>
  );
}
