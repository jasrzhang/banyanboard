interface FilterChipProps {
  label: string;
  isActive: boolean;
  onToggle: () => void;
  color?: string;
}

export function FilterChip({ label, isActive, onToggle, color }: FilterChipProps) {
  const baseClasses =
    'px-2.5 py-1 rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-colors duration-150';

  const activeClasses = 'bg-primary text-primary-foreground';
  const inactiveClasses = 'bg-nav-hover text-text-secondary hover:bg-border';

  const colorStyle =
    !isActive && color
      ? { backgroundColor: color + '33', color }
      : undefined;

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onToggle}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
      style={colorStyle}
    >
      {label}
    </button>
  );
}
