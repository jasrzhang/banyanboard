import { useState, useEffect, useRef } from 'react';
import type { Label } from '../../types/domain';
import { FilterChip } from './FilterChip';

interface FiltersDropdownProps {
  labels: Label[];
  activeLabelIds: string[];
  activeDateFilter: 'none' | 'overdue' | 'due-soon';
  onLabelToggle: (id: string) => void;
  onDateFilterChange: (filter: 'overdue' | 'due-soon') => void;
  onClearAll: () => void;
}

export function FiltersDropdown({
  labels,
  activeLabelIds,
  activeDateFilter,
  onLabelToggle,
  onDateFilterChange,
  onClearAll,
}: FiltersDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeCount =
    activeLabelIds.length + (activeDateFilter !== 'none' ? 1 : 0);

  const triggerLabel =
    activeCount > 0 ? `Filters (${activeCount})` : 'Filters';

  const triggerClasses =
    'px-2.5 py-1 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-colors duration-150 flex items-center gap-1';

  const triggerActiveClasses = 'bg-primary text-primary-foreground';
  const triggerInactiveClasses = 'bg-nav-hover text-text-secondary hover:bg-border';

  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="filter-panel"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`${triggerClasses} ${isOpen || activeCount > 0 ? triggerActiveClasses : triggerInactiveClasses}`}
      >
        {triggerLabel}
        <svg
          className="h-3.5 w-3.5 ml-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id="filter-panel"
          role="group"
          aria-label="Filter options"
          className="absolute right-0 top-full mt-1 z-50 min-w-[220px] bg-surface-card border border-border rounded-lg shadow-lg p-3"
        >
          {labels.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-text-disabled font-medium mb-1.5 uppercase tracking-wide">
                Labels
              </p>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => (
                  <FilterChip
                    key={label.id}
                    label={label.name}
                    isActive={activeLabelIds.includes(label.id)}
                    onToggle={() => onLabelToggle(label.id)}
                    color={label.color}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-2">
            <p className="text-xs text-text-disabled font-medium mb-1.5 uppercase tracking-wide">
              Due Date
            </p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="Overdue"
                isActive={activeDateFilter === 'overdue'}
                onToggle={() => onDateFilterChange('overdue')}
              />
              <FilterChip
                label="Due Soon"
                isActive={activeDateFilter === 'due-soon'}
                onToggle={() => onDateFilterChange('due-soon')}
              />
            </div>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="mt-1 text-xs text-text-secondary hover:text-text-primary focus:outline-none focus:underline"
            >
              Clear all ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
