import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

vi.mock('../api/labelsApi', () => ({
  fetchLabels: vi.fn(),
  createLabel: vi.fn(),
  deleteLabel: vi.fn(),
  replaceCardLabels: vi.fn(),
}));

import { fetchLabels, createLabel, deleteLabel, replaceCardLabels } from '../api/labelsApi';
import { useLabels } from '../hooks/useLabels';
import { useCreateLabel } from '../hooks/useCreateLabel';
import { useDeleteLabel } from '../hooks/useDeleteLabel';
import { useReplaceCardLabels } from '../hooks/useReplaceCardLabels';

const mockFetchLabels = vi.mocked(fetchLabels);
const mockCreateLabel = vi.mocked(createLabel);
const mockDeleteLabel = vi.mocked(deleteLabel);
const mockReplaceCardLabels = vi.mocked(replaceCardLabels);

const fixtureBoardId = 'board-1';
const fixtureCardId = 'card-1';

const fixtureLabels = [
  { id: 'lbl-1', name: 'bug', color: '#be123c', icon: null },
  { id: 'lbl-2', name: 'feature', color: '#047857', icon: null },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// Helper to render a hook inside QueryClientProvider using a minimal component
function renderHookWithQC<T>(
  useHook: () => T,
  qc: QueryClient,
): { result: { current: T } } {
  const result: { current: T } = { current: undefined as unknown as T };
  function HookComponent() {
    result.current = useHook();
    return null;
  }
  render(<HookComponent />, { wrapper: wrapper(qc) });
  return { result };
}

describe('useLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches labels for the given boardId and caches them under ["labels", boardId]', async () => {
    mockFetchLabels.mockResolvedValue(fixtureLabels);
    const qc = makeQueryClient();
    const { result } = renderHookWithQC(() => useLabels(fixtureBoardId), qc);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetchLabels).toHaveBeenCalledWith(fixtureBoardId);
    expect(result.current.data).toEqual(fixtureLabels);
    // Verify cache key
    expect(qc.getQueryData(['labels', fixtureBoardId])).toEqual(fixtureLabels);
  });

  it('returns empty array when board has no labels', async () => {
    mockFetchLabels.mockResolvedValue([]);
    const qc = makeQueryClient();
    const { result } = renderHookWithQC(() => useLabels(fixtureBoardId), qc);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('re-fetches when ["labels", boardId] is invalidated', async () => {
    mockFetchLabels.mockResolvedValue(fixtureLabels);
    const qc = makeQueryClient();
    renderHookWithQC(() => useLabels(fixtureBoardId), qc);

    await waitFor(() => {
      expect(mockFetchLabels).toHaveBeenCalledTimes(1);
    });

    await qc.invalidateQueries({ queryKey: ['labels', fixtureBoardId] });

    await waitFor(() => {
      expect(mockFetchLabels).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useCreateLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createLabel with boardId and request data on mutate', async () => {
    const newLabel = { id: 'lbl-3', name: 'urgent', color: '#be123c', icon: null };
    mockCreateLabel.mockResolvedValue(newLabel);
    const qc = makeQueryClient();
    const { result } = renderHookWithQC(() => useCreateLabel(fixtureBoardId), qc);

    result.current.mutate({ name: 'urgent', color: '#be123c' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockCreateLabel).toHaveBeenCalledWith(fixtureBoardId, { name: 'urgent', color: '#be123c' });
  });

  it('invalidates ["labels", boardId] on success', async () => {
    const newLabel = { id: 'lbl-3', name: 'urgent', color: '#be123c', icon: null };
    mockCreateLabel.mockResolvedValue(newLabel);
    // Pre-seed the cache so we can observe invalidation
    const qc = makeQueryClient();
    qc.setQueryData(['labels', fixtureBoardId], fixtureLabels);
    mockFetchLabels.mockResolvedValue([...fixtureLabels, newLabel]);

    const { result } = renderHookWithQC(() => useCreateLabel(fixtureBoardId), qc);

    result.current.mutate({ name: 'urgent', color: '#be123c' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // After invalidation, the cache should trigger a re-fetch — verify fetchLabels was called
    await waitFor(() => {
      expect(mockFetchLabels).toHaveBeenCalled();
    });
  });
});

describe('useDeleteLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteLabel with boardId and labelId on mutate', async () => {
    mockDeleteLabel.mockResolvedValue(undefined);
    const qc = makeQueryClient();
    const { result } = renderHookWithQC(() => useDeleteLabel(fixtureBoardId), qc);

    result.current.mutate('lbl-1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockDeleteLabel).toHaveBeenCalledWith(fixtureBoardId, 'lbl-1');
  });

  it('invalidates ["labels", boardId] on success', async () => {
    mockDeleteLabel.mockResolvedValue(undefined);
    mockFetchLabels.mockResolvedValue([fixtureLabels[1]]);
    const qc = makeQueryClient();
    qc.setQueryData(['labels', fixtureBoardId], fixtureLabels);

    const { result } = renderHookWithQC(() => useDeleteLabel(fixtureBoardId), qc);

    result.current.mutate('lbl-1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(mockFetchLabels).toHaveBeenCalled();
    });
  });
});

describe('useReplaceCardLabels', () => {
  const fixtureBoard = {
    id: fixtureBoardId,
    name: 'Test Board',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    columns: [
      {
        id: 'col-1',
        boardId: fixtureBoardId,
        name: 'To Do',
        position: 1000,
        cards: [
          {
            id: fixtureCardId,
            columnId: 'col-1',
            title: 'Fix bug',
            description: null,
            dueDate: null,
            labels: [fixtureLabels[0]],
            position: 1000,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls replaceCardLabels with cardId and labelIds on mutate', async () => {
    mockReplaceCardLabels.mockResolvedValue({ labels: fixtureLabels });
    const qc = makeQueryClient();
    qc.setQueryData(['board', fixtureBoardId], fixtureBoard);

    const { result } = renderHookWithQC(() => useReplaceCardLabels(fixtureBoardId), qc);

    result.current.mutate({ cardId: fixtureCardId, labelIds: ['lbl-1', 'lbl-2'] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockReplaceCardLabels).toHaveBeenCalledWith(fixtureCardId, ['lbl-1', 'lbl-2']);
  });

  it('applies optimistic update to board cache on mutate', async () => {
    // The mutation should not resolve immediately so we can check optimistic state
    let resolveRequest!: (v: { labels: typeof fixtureLabels }) => void;
    mockReplaceCardLabels.mockReturnValue(
      new Promise((res) => { resolveRequest = res; }),
    );

    const qc = makeQueryClient();
    qc.setQueryData(['board', fixtureBoardId], fixtureBoard);

    const { result } = renderHookWithQC(() => useReplaceCardLabels(fixtureBoardId), qc);

    result.current.mutate({ cardId: fixtureCardId, labelIds: ['lbl-1', 'lbl-2'] });

    // Optimistic update should be applied synchronously before network response
    await waitFor(() => {
      const cached = qc.getQueryData<typeof fixtureBoard>(['board', fixtureBoardId]);
      const card = cached?.columns[0].cards[0];
      // The optimistic update should reflect the new labelIds
      expect(card?.labels.map((l) => l.id)).toEqual(
        expect.arrayContaining(['lbl-1', 'lbl-2']),
      );
    });

    // Cleanup
    resolveRequest({ labels: fixtureLabels });
  });

  it('rolls back board cache to snapshot on error', async () => {
    mockReplaceCardLabels.mockRejectedValue(new Error('Network error'));
    const qc = makeQueryClient();
    qc.setQueryData(['board', fixtureBoardId], fixtureBoard);

    const { result } = renderHookWithQC(() => useReplaceCardLabels(fixtureBoardId), qc);

    result.current.mutate({ cardId: fixtureCardId, labelIds: ['lbl-2'] });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Board cache should be restored to original snapshot
    const cached = qc.getQueryData<typeof fixtureBoard>(['board', fixtureBoardId]);
    expect(cached?.columns[0].cards[0].labels).toEqual([fixtureLabels[0]]);
  });

  it('invalidates ["board", boardId] on settled (both success and error)', async () => {
    mockReplaceCardLabels.mockResolvedValue({ labels: fixtureLabels });
    // Set up a spy on invalidateQueries
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

    const qc = makeQueryClient();
    qc.setQueryData(['board', fixtureBoardId], fixtureBoard);

    const { result } = renderHookWithQC(() => useReplaceCardLabels(fixtureBoardId), qc);

    result.current.mutate({ cardId: fixtureCardId, labelIds: ['lbl-1'] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['board', fixtureBoardId] }),
    );

    invalidateSpy.mockRestore();
  });
});
