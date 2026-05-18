import { Outlet } from 'react-router-dom';
import { useSidebar } from '../../hooks/useSidebar';
import { Sidebar } from './Sidebar';
import { BoardHeader } from './BoardHeader';

export function AppShell() {
  const { isOpen, close, toggle } = useSidebar();

  return (
    <div className="flex flex-row h-screen overflow-hidden bg-surface-page">
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <Sidebar id="sidebar" isOpen={isOpen} onClose={close} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <BoardHeader onMenuClick={toggle} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
