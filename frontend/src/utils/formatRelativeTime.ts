export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 30) return 'just now';
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM} min ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH} hr ago`;
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
}
