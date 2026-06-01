import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { BoardListPage } from '../pages/BoardListPage';
import { BoardDetailPage } from '../pages/BoardDetailPage';
import { CardDetailModal } from '../components/card/CardDetailModal';
import { LoginPage } from '../pages/LoginPage';
import { RequireAuth, RedirectIfAuthed } from '../components/auth/authGuards';

export const routes = [
  {
    path: '/login',
    element: (
      <RedirectIfAuthed>
        <LoginPage />
      </RedirectIfAuthed>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/boards" replace /> },
      { path: 'boards', element: <BoardListPage /> },
      {
        path: 'boards/:boardId',
        element: <BoardDetailPage />,
        children: [{ path: 'cards/:cardId', element: <CardDetailModal /> }],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
