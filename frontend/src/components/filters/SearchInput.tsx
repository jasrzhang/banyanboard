interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="relative">
      <label htmlFor="board-search" className="sr-only">
        Search cards
      </label>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-disabled">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
      </span>
      <input
        id="board-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search cards..."
        className="pl-8 text-sm rounded-md border border-border bg-surface-card text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 w-40 sm:w-56 py-1.5 pr-2"
      />
    </div>
  );
}
