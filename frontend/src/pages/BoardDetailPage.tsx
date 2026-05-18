import { useParams } from 'react-router-dom';
import { BoardView } from '../components/board/BoardView';

type RouteParams = { boardId: string };

export function BoardDetailPage() {
  const { boardId } = useParams<RouteParams>();
  if (!boardId) return null;
  return <BoardView boardId={boardId} />;
}
