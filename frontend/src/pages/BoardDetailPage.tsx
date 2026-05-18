import { useParams } from 'react-router-dom';

type RouteParams = { boardId: string };

export function BoardDetailPage() {
  const { boardId } = useParams<RouteParams>();
  return (
    <div className="p-6">
      <p className="text-text-secondary text-sm">Board {boardId} — coming soon</p>
    </div>
  );
}
