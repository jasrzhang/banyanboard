import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from './index';

function renderRoute(path: string) {
  const testRouter = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={testRouter} />);
}

describe('Routes', () => {
  it('renders BoardListPage at /boards', () => {
    renderRoute('/boards');
    expect(screen.getByText(/boards — coming soon/i)).toBeInTheDocument();
  });

  it('renders BoardDetailPage at /boards/:boardId', () => {
    renderRoute('/boards/abc-123');
    expect(screen.getByText(/board abc-123 — coming soon/i)).toBeInTheDocument();
  });

  it('redirects root \/ to \/boards', () => {
    renderRoute('/');
    expect(screen.getByText(/boards — coming soon/i)).toBeInTheDocument();
  });
});
