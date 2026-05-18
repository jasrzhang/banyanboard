import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { BoardListPage } from '../pages/BoardListPage';
import { BoardDetailPage } from '../pages/BoardDetailPage';
import { CardDetailPlaceholderPage } from '../pages/CardDetailPlaceholderPage';

export const routes = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/boards" replace /> },
      { path: 'boards', element: <BoardListPage /> },
      { path: 'boards/:boardId', element: <BoardDetailPage /> },
      { path: 'boards/:boardId/cards/:cardId', element: <CardDetailPlaceholderPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
