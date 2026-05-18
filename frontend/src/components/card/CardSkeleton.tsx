export function CardSkeleton() {
  return (
    <div className="h-20 bg-border rounded-lg animate-pulse mb-2" aria-hidden="true" />
  );
}

export function ColumnSkeleton() {
  return (
    <div className="flex-shrink-0 w-[300px] rounded-xl bg-surface-sidebar border border-border p-3">
      <div className="h-5 w-24 bg-border rounded animate-pulse mb-3" />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
