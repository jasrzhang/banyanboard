import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks must be declared before importing the modules they replace
vi.mock('../hooks/useAutomationRules');
vi.mock('../hooks/useDeleteAutomationRule');
vi.mock('../hooks/useBoard');
vi.mock('../hooks/useLabels');
vi.mock('../hooks/useActivityFeed');
vi.mock('../hooks/useMoveCard');
vi.mock('../hooks/useCreateCard');
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

import { useAutomationRules } from '../hooks/useAutomationRules';
import { useDeleteAutomationRule } from '../hooks/useDeleteAutomationRule';
import { useBoard } from '../hooks/useBoard';
import { useLabels } from '../hooks/useLabels';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { useMoveCard } from '../hooks/useMoveCard';
import { useCreateCard } from '../hooks/useCreateCard';
import { AutomationsPanel } from '../components/automation/AutomationsPanel';
import { BoardHeader } from '../components/board/BoardHeader';
import { BoardView } from '../components/board/BoardView';
import { toast } from 'sonner';

const mockUseAutomationRules = vi.mocked(useAutomationRules);
const mockUseDeleteAutomationRule = vi.mocked(useDeleteAutomationRule);
const mockUseBoard = vi.mocked(useBoard);
const mockUseLabels = vi.mocked(useLabels);
const mockUseActivityFeed = vi.mocked(useActivityFeed);
const mockUseMoveCard = vi.mocked(useMoveCard);
const mockUseCreateCard = vi.mocked(useCreateCard);
const mockToast = vi.mocked(toast);

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface AutomationRule {
  id: string;
  boardId: string;
  triggerType: 'card_moved_to_column' | 'card_label_assigned' | 'card_due_date_set';
  triggerConfig: Record<string, string>;
  actionType: 'assign_label' | 'move_to_column' | 'notify';
  actionConfig: Record<string, string>;
  enabled: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fixtureColumns = [
  { id: 'col-1', name: 'To Do' },
  { id: 'col-2', name: 'Done' },
];

const fixtureLabels = [
  { id: 'lbl-1', name: 'Shipped', color: '#047857' },
  { id: 'lbl-2', name: 'Bug', color: '#be123c' },
];

const fixtureRules: AutomationRule[] = [
  {
    id: 'rule-1',
    boardId: 'board-1',
    triggerType: 'card_moved_to_column',
    triggerConfig: { columnId: 'col-2' },
    actionType: 'assign_label',
    actionConfig: { labelId: 'lbl-1' },
    enabled: true,
    createdAt: '2026-05-30T00:00:00Z',
  },
  {
    id: 'rule-2',
    boardId: 'board-1',
    triggerType: 'card_label_assigned',
    triggerConfig: { labelId: 'lbl-2' },
    actionType: 'move_to_column',
    actionConfig: { columnId: 'col-2' },
    enabled: true,
    createdAt: '2026-05-30T00:01:00Z',
  },
];

const fixtureBoard = {
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
      cards: [],
    },
    {
      id: 'col-2',
      boardId: 'board-1',
      name: 'Done',
      position: 2000,
      cards: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function makeDefaultDeleteMock() {
  return {
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useDeleteAutomationRule>;
}

function makeDefaultAutomationsMock(overrides: Partial<{ data: AutomationRule[]; isLoading: boolean; isError: boolean }> = {}) {
  return {
    data: [],
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAutomationRules>;
}

function renderPanel(
  overrides: {
    rules?: AutomationRule[];
    isLoading?: boolean;
    deleteMock?: ReturnType<typeof useDeleteAutomationRule>;
    onClose?: () => void;
    onAddRule?: () => void;
  } = {},
) {
  const onClose = overrides.onClose ?? vi.fn();
  const onAddRule = overrides.onAddRule ?? vi.fn();

  mockUseAutomationRules.mockReturnValue(
    makeDefaultAutomationsMock({
      data: overrides.rules ?? [],
      isLoading: overrides.isLoading ?? false,
    }),
  );

  mockUseDeleteAutomationRule.mockReturnValue(
    overrides.deleteMock ?? makeDefaultDeleteMock(),
  );

  render(
    <AutomationsPanel
      boardId="board-1"
      onClose={onClose}
      onAddRule={onAddRule}
      columns={fixtureColumns}
      labels={fixtureLabels}
    />,
  );

  return { onClose, onAddRule };
}

function renderBoardHeader(automationsOpen: boolean, onAutomationsToggle = vi.fn()) {
  render(
    <BoardHeader
      boardName="Test Board"
      labels={[]}
      searchQuery=""
      activeLabelIds={[]}
      activeDateFilter="none"
      onSearchChange={vi.fn()}
      onLabelToggle={vi.fn()}
      onDateFilterChange={vi.fn()}
      onClearFilters={vi.fn()}
      activityOpen={false}
      onActivityToggle={vi.fn()}
      automationsOpen={automationsOpen}
      onAutomationsToggle={onAutomationsToggle}
    />,
  );
}

function BoardViewWrapper({ boardId = 'board-1' }: { boardId?: string } = {}) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/boards/${boardId}`]}>
        <Routes>
          <Route path="/boards/:boardId" element={<BoardView boardId={boardId} />} />
          <Route path="/boards/:boardId/cards/:cardId" element={<div>Card detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutomationsPanel and BoardHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AutomationsPanel structure
  // -------------------------------------------------------------------------

  it('renders with aria-label="Automations"', () => {
    renderPanel();

    expect(screen.getByRole('complementary', { name: 'Automations' })).toBeInTheDocument();
  });

  it('shows empty state copy and "Add rule" button when query returns empty array', () => {
    renderPanel({ rules: [] });

    expect(screen.getByText('Automate repetitive transitions.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add rule/i }),
    ).toBeInTheDocument();
  });

  it('shows loading indicator when query is loading', () => {
    renderPanel({ isLoading: true });

    // The component renders a spinner with sr-only text while loading
    expect(screen.getByText('Loading rules…')).toBeInTheDocument();
  });

  it('renders rule rows with plain-English summaries when rules exist', () => {
    renderPanel({ rules: fixtureRules });

    // rule-1: card_moved_to_column col-2 (Done) → assign_label lbl-1 (Shipped)
    expect(
      screen.getByText('When card moves to Done → Assign label: Shipped'),
    ).toBeInTheDocument();

    // rule-2: card_label_assigned lbl-2 (Bug) → move_to_column col-2 (Done)
    expect(
      screen.getByText('When label Bug assigned → Move to: Done'),
    ).toBeInTheDocument();
  });

  it('shows spinner and keeps rule row visible during delete isPending', () => {
    const deleteMock = {
      mutate: vi.fn(),
      isPending: true,
      variables: 'rule-1',
    } as unknown as ReturnType<typeof useDeleteAutomationRule>;

    renderPanel({ rules: fixtureRules, deleteMock });

    // Rule row must still be in the document during the flight
    expect(
      screen.getByText('When card moves to Done → Assign label: Shipped'),
    ).toBeInTheDocument();

    // A sr-only "Deleting…" indicator must be present for the in-flight rule
    expect(screen.getByText('Deleting…')).toBeInTheDocument();
  });

  it('calls toast.error with "Failed to delete rule" when DELETE mutation fails', () => {
    // The mutate function immediately calls onError to simulate a failed request
    const mutate = vi.fn().mockImplementation(
      (_ruleId: string, opts?: { onError?: () => void }) => {
        opts?.onError?.();
      },
    );
    const deleteMock = {
      mutate,
      isPending: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useDeleteAutomationRule>;

    renderPanel({ rules: fixtureRules, deleteMock });

    // Click the delete button for the first rule row
    const deleteButtons = screen.getAllByRole('button', { name: /delete rule|remove rule|×/i });
    fireEvent.click(deleteButtons[0]!);

    expect(mockToast.error).toHaveBeenCalledWith('Failed to delete rule');
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // BoardHeader — automations toggle button
  // -------------------------------------------------------------------------

  it('renders Automations button with aria-pressed="false" when automationsOpen is false', () => {
    renderBoardHeader(false);

    const btn = screen.getByRole('button', { name: /toggle automations/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders Automations button with aria-pressed="true" when automationsOpen is true', () => {
    renderBoardHeader(true);

    const btn = screen.getByRole('button', { name: /toggle automations/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Automations button has bg-primary and text-primary-foreground classes when automationsOpen is true', () => {
    renderBoardHeader(true);

    const btn = screen.getByRole('button', { name: /toggle automations/i });
    expect(btn).toHaveClass('bg-primary');
    expect(btn).toHaveClass('text-primary-foreground');
  });

  // -------------------------------------------------------------------------
  // BoardView — panel mutual exclusion
  // -------------------------------------------------------------------------

  it('opening Automations panel closes Activity panel, and vice versa', () => {
    // Set up all hooks BoardView depends on
    mockUseBoard.mockReturnValue({
      data: fixtureBoard,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isPending: false,
      isSuccess: true,
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
      promise: Promise.resolve(fixtureBoard),
    } as unknown as ReturnType<typeof useBoard>);

    mockUseLabels.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useLabels>);

    mockUseAutomationRules.mockReturnValue(
      makeDefaultAutomationsMock({ data: [] }),
    );

    mockUseActivityFeed.mockReturnValue({
      events: [],
      status: 'connected',
      retry: vi.fn(),
    });

    mockUseMoveCard.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMoveCard>);

    mockUseCreateCard.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateCard>);

    mockUseDeleteAutomationRule.mockReturnValue(makeDefaultDeleteMock());

    render(<BoardViewWrapper />);

    // Open Automations panel
    const automationsBtn = screen.getByRole('button', { name: /toggle automations/i });
    fireEvent.click(automationsBtn);

    // Automations panel should be open
    expect(screen.getByRole('complementary', { name: 'Automations' })).toBeInTheDocument();
    // Activity panel should NOT be open
    expect(screen.queryByRole('complementary', { name: 'Activity' })).not.toBeInTheDocument();

    // Now open Activity panel
    const activityBtn = screen.getByRole('button', { name: /toggle activity feed/i });
    fireEvent.click(activityBtn);

    // Activity panel should be open
    expect(screen.getByRole('complementary', { name: 'Activity' })).toBeInTheDocument();
    // Automations panel should now be closed
    expect(screen.queryByRole('complementary', { name: 'Automations' })).not.toBeInTheDocument();
  });
});
