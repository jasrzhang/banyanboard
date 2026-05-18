import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { BoardListPage } from '../pages/BoardListPage';
import { BoardDetailPage } from '../pages/BoardDetailPage';

export const routes = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/boards" replace /> },
      { path: 'boards', element: <BoardListPage /> },
      { path: 'boards/:boardId', element: <BoardDetailPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
