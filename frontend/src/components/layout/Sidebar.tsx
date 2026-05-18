import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useBoards } from '../../hooks/useBoards';

interface SidebarProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ id, isOpen, onClose }: SidebarProps) {
  const { data: boards, isLoading } = useBoards();

  const sidebarClasses = clsx(
    'bg-surface-sidebar border-r border-border flex flex-col h-full z-50 w-64',
    'fixed inset-y-0 left-0',
    'transform transition-transform duration-200',
    isOpen ? 'translate-x-0' : '-translate-x-full',
    'lg:static lg:translate-x-0 lg:z-auto',
  );

  return (
    <nav id={id} className={sidebarClasses} aria-label="Navigation sidebar">
      <div className="px-4 py-4 border-b border-border shrink-0">
        <span className="text-lg font-semibold text-text-primary">BanyanBoard</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Boards
        </p>
        <ul>
          {isLoading && (
            <li className="px-3 py-2">
              <span className="text-sm text-text-disabled">Loading boards…</span>
            </li>
          )}
          {boards?.map((board) => (
            <li key={board.id}>
              <NavLink
                to={`/boards/${board.id}`}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium w-full',
                    isActive
                      ? 'bg-nav-activeBg text-nav-active font-semibold'
                      : 'text-text-primary hover:bg-nav-hover',
                  )
                }
              >
                {board.name}
              </NavLink>
            </li>
          ))}
          {!isLoading && (!boards || boards.length === 0) && (
            <li className="px-3 py-2">
              <span className="text-sm text-text-disabled">No boards yet</span>
            </li>
          )}
        </ul>
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0">
        <span className="text-sm text-text-secondary">Workspace</span>
      </div>
    </nav>
  );
}
