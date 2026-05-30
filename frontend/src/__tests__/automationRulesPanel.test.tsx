import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks must be declared before importing the modules they replace
vi.mock('../hooks/useAutomationRules');
vi.mock('../hooks/useDeleteAutomationRule');
vi.mock('../hooks/useCreateAutomationRule');
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
import { useCreateAutomationRule } from '../hooks/useCreateAutomationRule';
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
const mockUseCreateAutomationRule = vi.mocked(useCreateAutomationRule);
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

function makeDefaultCreateMock(overrides: Partial<{ mutate: ReturnType<typeof vi.fn>; isPending: boolean }> = {}) {
  return {
    mutate: overrides.mutate ?? vi.fn(),
    isPending: overrides.isPending ?? false,
  } as unknown as ReturnType<typeof useCreateAutomationRule>;
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
    createMock?: ReturnType<typeof useCreateAutomationRule>;
    onClose?: () => void;
  } = {},
) {
  const onClose = overrides.onClose ?? vi.fn();

  mockUseAutomationRules.mockReturnValue(
    makeDefaultAutomationsMock({
      data: overrides.rules ?? [],
      isLoading: overrides.isLoading ?? false,
    }),
  );

  mockUseDeleteAutomationRule.mockReturnValue(
    overrides.deleteMock ?? makeDefaultDeleteMock(),
  );

  mockUseCreateAutomationRule.mockReturnValue(
    overrides.createMock ?? makeDefaultCreateMock(),
  );

  render(
    <AutomationsPanel
      boardId="board-1"
      onClose={onClose}
      columns={fixtureColumns}
      labels={fixtureLabels}
    />,
  );

  return { onClose };
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
  // Phase 2: clicking "Add rule" opens the form
  // -------------------------------------------------------------------------

  it('clicking "Add rule" in empty state reveals the rule creation form', () => {
    mockUseCreateAutomationRule.mockReturnValue(makeDefaultCreateMock());
    renderPanel({ rules: [] });

    fireEvent.click(screen.getByRole('button', { name: /add rule/i }));

    // Form should be visible (contains Save rule button)
    expect(screen.getByRole('button', { name: /save rule/i })).toBeInTheDocument();
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

// ---------------------------------------------------------------------------
// Phase 3: Rule Creation Form
// ---------------------------------------------------------------------------

describe('AutomationRuleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: open the form by rendering the panel and clicking "Add rule"
  function renderPanelWithForm(createMockOverrides: Partial<{ mutate: ReturnType<typeof vi.fn>; isPending: boolean }> = {}) {
    const createMock = makeDefaultCreateMock(createMockOverrides);
    mockUseCreateAutomationRule.mockReturnValue(createMock);
    renderPanel({ rules: [], createMock });
    fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
    return { createMock };
  }

  it('Save rule button is disabled and shows spinner while mutation isPending', () => {
    const createMock = makeDefaultCreateMock({ isPending: true });
    mockUseCreateAutomationRule.mockReturnValue(createMock);
    renderPanel({ rules: [], createMock });
    fireEvent.click(screen.getByRole('button', { name: /add rule/i }));

    const saveBtn = screen.getByRole('button', { name: /saving/i });
    expect(saveBtn).toBeDisabled();
    expect(saveBtn).toHaveAttribute('aria-busy', 'true');
  });

  it('shows "Select a trigger type" error when Save clicked with no trigger type', () => {
    renderPanelWithForm();

    fireEvent.click(screen.getByRole('button', { name: /save rule/i }));

    expect(screen.getByText('Select a trigger type')).toBeInTheDocument();
  });

  it('shows "Select a column to watch" when card_moved_to_column selected but no column chosen', () => {
    renderPanelWithForm();

    fireEvent.change(screen.getByLabelText(/when…/i), { target: { value: 'card_moved_to_column' } });
    fireEvent.click(screen.getByRole('button', { name: /save rule/i }));

    // Matches the error <span>, not the option placeholder with same text
    expect(screen.getByText('Select a column to watch', { selector: 'span' })).toBeInTheDocument();
  });

  it('shows "Select a label to apply" when assign_label action selected but no label chosen', () => {
    renderPanelWithForm();

    fireEvent.change(screen.getByLabelText(/when…/i), { target: { value: 'card_moved_to_column' } });
    fireEvent.change(screen.getByLabelText(/column/i), { target: { value: 'col-1' } });
    fireEvent.change(screen.getByLabelText(/then…/i), { target: { value: 'assign_label' } });
    fireEvent.click(screen.getByRole('button', { name: /save rule/i }));

    // Matches the error <span>, not the option placeholder with same text
    expect(screen.getByText('Select a label to apply', { selector: 'span' })).toBeInTheDocument();
  });

  it('calls mutation with correct data and shows toast.success on successful submit', () => {
    const mutate = vi.fn().mockImplementation((_data, opts?: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    renderPanelWithForm({ mutate });

    fireEvent.change(screen.getByLabelText(/when…/i), { target: { value: 'card_moved_to_column' } });
    fireEvent.change(screen.getByDisplayValue('Select a column to watch'), { target: { value: 'col-1' } });
    fireEvent.change(screen.getByLabelText(/then…/i), { target: { value: 'assign_label' } });
    fireEvent.change(screen.getByDisplayValue('Select a label to apply'), { target: { value: 'lbl-1' } });
    fireEvent.click(screen.getByRole('button', { name: /save rule/i }));

    expect(mutate).toHaveBeenCalledWith(
      {
        triggerType: 'card_moved_to_column',
        triggerConfig: { columnId: 'col-1' },
        actionType: 'assign_label',
        actionConfig: { labelId: 'lbl-1' },
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(mockToast.success).toHaveBeenCalledWith('Automation rule saved');
    // Form should close (Save rule button gone)
    expect(screen.queryByRole('button', { name: /save rule/i })).not.toBeInTheDocument();
  });

  it('displays "This rule would create a circular automation loop" on 422 response', () => {
    const mutate = vi.fn().mockImplementation((_data, opts?: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new Error('HTTP 422: Unprocessable Entity'));
    });
    renderPanelWithForm({ mutate });

    fireEvent.change(screen.getByLabelText(/when…/i), { target: { value: 'card_moved_to_column' } });
    // Trigger column select appears — select it by its specific id
    fireEvent.change(screen.getByDisplayValue('Select a column to watch'), { target: { value: 'col-1' } });
    fireEvent.change(screen.getByLabelText(/then…/i), { target: { value: 'move_to_column' } });
    // Action column select appears — distinct from trigger column (which now shows "To Do")
    fireEvent.change(screen.getByDisplayValue('Select a column to move to'), { target: { value: 'col-2' } });
    fireEvent.click(screen.getByRole('button', { name: /save rule/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This rule would create a circular automation loop',
    );
    // Form stays open
    expect(screen.getByRole('button', { name: /save rule/i })).toBeInTheDocument();
  });

  it('shows toast.error and keeps form open on 5xx failure', () => {
    const mutate = vi.fn().mockImplementation((_data, opts?: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new Error('HTTP 500: Internal Server Error'));
    });
    renderPanelWithForm({ mutate });

    fireEvent.change(screen.getByLabelText(/when…/i), { target: { value: 'card_moved_to_column' } });
    fireEvent.change(screen.getByDisplayValue('Select a column to watch'), { target: { value: 'col-1' } });
    fireEvent.change(screen.getByLabelText(/then…/i), { target: { value: 'assign_label' } });
    fireEvent.change(screen.getByDisplayValue('Select a label to apply'), { target: { value: 'lbl-1' } });
    fireEvent.click(screen.getByRole('button', { name: /save rule/i }));

    expect(mockToast.error).toHaveBeenCalledWith('Failed to save rule. Please try again.');
    // Form stays open with inputs preserved
    expect(screen.getByRole('button', { name: /save rule/i })).toBeInTheDocument();
  });

  it('shows column dropdown when card_moved_to_column selected; label dropdown for card_label_assigned', () => {
    renderPanelWithForm();

    // Select card_moved_to_column — column dropdown appears
    fireEvent.change(screen.getByLabelText(/when…/i), { target: { value: 'card_moved_to_column' } });
    expect(screen.getByLabelText(/^column$/i)).toBeInTheDocument();

    // Change to card_label_assigned — label dropdown appears, column gone
    fireEvent.change(screen.getByLabelText(/when…/i), { target: { value: 'card_label_assigned' } });
    expect(screen.getByLabelText(/^label$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^column$/i)).not.toBeInTheDocument();
  });

  it('shows label dropdown when assign_label action; column dropdown for move_to_column action', () => {
    renderPanelWithForm();

    // Select assign_label action
    fireEvent.change(screen.getByLabelText(/then…/i), { target: { value: 'assign_label' } });
    // label dropdown for action appears
    const labelDropdowns = screen.getAllByLabelText(/^label$/i);
    expect(labelDropdowns.length).toBeGreaterThan(0);

    // Change to move_to_column — column dropdown appears instead
    fireEvent.change(screen.getByLabelText(/then…/i), { target: { value: 'move_to_column' } });
    expect(screen.getByLabelText(/^column$/i)).toBeInTheDocument();
  });
});
