interface BoardHeaderProps {
  onMenuClick: () => void;
}

export function BoardHeader({ onMenuClick }: BoardHeaderProps) {
  return (
    <header className="bg-surface-card border-b border-border h-14 flex items-center px-4 gap-4 shrink-0">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="lg:hidden p-2 rounded-md text-text-secondary hover:bg-nav-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <h1 className="flex-1 text-xl font-semibold text-text-primary truncate">My Board</h1>
      <button
        type="button"
        className="bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150"
      >
        New Card
      </button>
    </header>
  );
}
