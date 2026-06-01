import { Link, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface GenericTopBarProps {
  onMenuClick: () => void;
}

export function GenericTopBar({ onMenuClick }: GenericTopBarProps) {
  const { user, clearUser } = useCurrentUser();
  const navigate = useNavigate();

  function handleLogout() {
    clearUser();
    navigate('/login');
  }

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
      <span className="text-xl font-semibold text-text-primary">BanyanBoard</span>
      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            <span className="text-sm text-text-secondary">Hi, {user.firstName}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md px-2 py-1"
            >
              Log out
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
