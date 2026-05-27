import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Board } from '../types/domain';
import type { UseQueryResult } from '@tanstack/react-query';

vi.mock('../hooks/useBoard');
vi.mock('../hooks/useLabels');
vi.mock('../hooks/useCreateLabel');
vi.mock('../hooks/useDeleteLabel');
vi.mock('../hooks/useReplaceCardLabels');
vi.mock('../api/boardsApi', () => ({
  fetchBoard: vi.fn(),
  fetchBoards: vi.fn(),
  createCard: vi.fn(),
  moveCard: vi.fn(),
  updateCard: vi.fn(),
}));
vi.mock('../api/labelsApi', () => ({
  fetchLabels: vi.fn(),
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  replaceCardLabels: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

import { useBoard } from '../hooks/useBoard';
import { useLabels } from '../hooks/useLabels';
import { useCreateLabel } from '../hooks/useCreateLabel';
import { useDeleteLabel } from '../hooks/useDeleteLabel';
import { useReplaceCardLabels } from '../hooks/useReplaceCardLabels';
import { updateCard } from '../api/boardsApi';
import { CardDetailModal } from '../components/card/CardDetailModal';
import { toast } from 'sonner';

const mockUseBoard = vi.mocked(useBoard);
const mockUpdateCard = vi.mocked(updateCard);
const mockToastSuccess = (toast as unknown as { success: ReturnType<typeof vi.fn> }).success;
const mockUseLabels = vi.mocked(useLabels);
const mockUseCreateLabel = vi.mocked(useCreateLabel);
const mockUseDeleteLabel = vi.mocked(useDeleteLabel);
const mockUseReplaceCardLabels = vi.mocked(useReplaceCardLabels);

type UseBoardResult = ReturnType<typeof useBoard>;

function makeBoardResult(overrides: Partial<UseQueryResult<Board>>): UseBoardResult {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isPending: false,
    isSuccess: false,
    isFetching: false,
    isRefetching: false,
    isStale: false,
    isPlaceholderData: false,
    status: 'success',
    fetchStatus: 'idle',
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isFetched: true,
    isFetchedAfterMount: true,
    isInitialLoading: false,
    isLoadingError: false,
    isRefetchError: false,
    promise: Promise.resolve(undefined as unknown as Board),
    ...overrides,
  } as unknown as UseBoardResult;
}

const fixtureCard = {
  id: 'card-1',
  columnId: 'col-1',
  title: 'Fix login bug',
  description: 'The login form does not redirect after success.',
  dueDate: '2026-12-31T00:00:00.000Z',
  labels: [
    { id: 'lbl-1', name: 'bug', color: '#be123c' },
    { id: 'lbl-2', name: 'frontend', color: '#0369a1' },
  ],
  position: 1000,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const fixtureCardNullFields = {
  ...fixtureCard,
  id: 'card-2',
  title: 'API docs',
  description: null,
  dueDate: null,
  labels: [],
};

const fixtureBoard: Board = {
  id: 'board-1',
  name: 'Test Board',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  columns: [
    {
      id: 'col-1',
      boardId: 'board-1',
      name: 'To Do',
      position: 1000,
      cards: [fixtureCard, fixtureCardNullFields],
    },
  ],
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function BoardShell() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

function renderModalAtRoute(cardId = 'card-1') {
  const qc = makeQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/boards/board-1/cards/${cardId}`]}>
        <Routes>
          <Route path="/boards/:boardId" element={<BoardShell />}>
            <Route path="cards/:cardId" element={<CardDetailModal />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setupLabelHookMocks() {
  mockUseLabels.mockReturnValue({
    data: [
      { id: 'lbl-1', name: 'bug', color: '#be123c', icon: null },
      { id: 'lbl-2', name: 'frontend', color: '#0369a1', icon: null },
    ],
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useLabels>);

  mockUseReplaceCardLabels.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useReplaceCardLabels>);

  mockUseCreateLabel.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCreateLabel>);

  mockUseDeleteLabel.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteLabel>);
}

describe('CardDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBoard.mockReturnValue(makeBoardResult({ data: fixtureBoard, isSuccess: true }));
    setupLabelHookMocks();
  });

  it('renders title, description, due date, and label chips from card data', () => {
    renderModalAtRoute('card-1');

    expect(screen.getByDisplayValue('Fix login bug')).toBeInTheDocument();
    expect(screen.getByDisplayValue('The login form does not redirect after success.')).toBeInTheDocument();
    expect(screen.getByText('bug')).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
  });

  it('renders placeholder for null description, not blank UI', () => {
    renderModalAtRoute('card-2');

    const textarea = screen.getByPlaceholderText(/add a description/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('');
  });

  it('renders placeholder for null dueDate, not blank UI', () => {
    renderModalAtRoute('card-2');

    const dateInput = screen.getByLabelText(/due date/i);
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toHaveValue('');
  });

  it('Save button is disabled when form is unchanged (dirty check)', () => {
    renderModalAtRoute('card-1');

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('Save button becomes enabled when title is changed', () => {
    renderModalAtRoute('card-1');

    const titleInput = screen.getByDisplayValue('Fix login bug');
    fireEvent.change(titleInput, { target: { value: 'Fixed login bug' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('calls updateCard with correct payload and shows success toast on save', async () => {
    const updatedCard = { ...fixtureCard, title: 'Updated title' };
    mockUpdateCard.mockResolvedValue(updatedCard);

    renderModalAtRoute('card-1');

    const titleInput = screen.getByDisplayValue('Fix login bug');
    fireEvent.change(titleInput, { target: { value: 'Updated title' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateCard).toHaveBeenCalledWith(
        'card-1',
        expect.objectContaining({ title: 'Updated title' }),
      );
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Card saved');
    });
  });

  it('keeps modal open and shows inline error when save fails', async () => {
    mockUpdateCard.mockRejectedValue(new Error('Server error'));

    renderModalAtRoute('card-1');

    const titleInput = screen.getByDisplayValue('Fix login bug');
    fireEvent.change(titleInput, { target: { value: 'Changed title' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/failed to save/i);
    expect(screen.getByDisplayValue('Changed title')).toBeInTheDocument();
  });

  it('Save button is re-enabled after a failed save (retry path)', async () => {
    mockUpdateCard.mockRejectedValue(new Error('Network error'));

    renderModalAtRoute('card-1');

    const titleInput = screen.getByDisplayValue('Fix login bug');
    fireEvent.change(titleInput, { target: { value: 'New title' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('renders a close button', () => {
    renderModalAtRoute('card-1');

    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('renders dialog with correct ARIA attributes', () => {
    renderModalAtRoute('card-1');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('Labels section is always visible (even with no labels on card)', () => {
    renderModalAtRoute('card-2');

    // The trigger button should always render regardless of card.labels length
    expect(screen.getByRole('button', { name: /add labels/i })).toBeInTheDocument();
  });
});
