import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

function QueryConsumer() {
  const client = useQueryClient();
  return <div data-testid="qc">{client ? 'has-client' : 'no-client'}</div>;
}

describe('QueryClientProvider', () => {
  it('QueryClient is accessible to components within the tree (AC-HAPPY-4)', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const router = createMemoryRouter(
      [{ path: '/', element: <QueryConsumer /> }],
      { initialEntries: ['/'] },
    );
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('qc')).toHaveTextContent('has-client');
  });
});
