interface BoardErrorPanelProps {
  message?: string;
  onRetry: () => void;
}

export function BoardErrorPanel({ message, onRetry }: BoardErrorPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center h-full">
      <p className="text-text-primary font-medium">We couldn&apos;t load this board</p>
      {message && <p className="text-text-secondary text-sm">{message}</p>}
      <button
        onClick={onRetry}
        className="bg-primary hover:bg-primary-hover text-primary-foreground
                   text-sm font-medium px-4 py-2 rounded-md
                   focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                   transition-colors duration-150"
      >
        Retry
      </button>
    </div>
  );
}
