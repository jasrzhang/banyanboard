import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ActivityEvent } from '../types/domain';
import type { UseActivityFeedResult } from '../hooks/useActivityFeed';

vi.mock('../hooks/useActivityFeed');

import { useActivityFeed } from '../hooks/useActivityFeed';
import { ActivityFeedPanel } from '../components/activity/ActivityFeedPanel';

const mockUseActivityFeed = vi.mocked(useActivityFeed);

function makeResult(overrides: Partial<UseActivityFeedResult>): UseActivityFeedResult {
  return {
    events: [],
    status: 'connected',
    retry: vi.fn(),
    ...overrides,
  };
}

const event1: ActivityEvent = {
  id: 'evt-1',
  boardId: 'board-1',
  cardId: 'card-1',
  eventType: 'card_created',
  payload: { cardTitle: 'Alpha task', columnName: 'To Do' },
  createdAt: '2026-05-25T10:00:00Z',
};

const event2: ActivityEvent = {
  id: 'evt-2',
  boardId: 'board-1',
  cardId: 'card-2',
  eventType: 'card_moved',
  payload: { cardTitle: 'Beta task', fromColumn: 'To Do', toColumn: 'In Progress' },
  createdAt: '2026-05-25T10:05:00Z',
};

function renderPanel(onClose = vi.fn()) {
  return render(<ActivityFeedPanel boardId="board-1" onClose={onClose} />);
}

describe('ActivityFeedPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders events in the order provided by the hook', () => {
    // Hook provides newest-first; panel renders in that order
    mockUseActivityFeed.mockReturnValue(
      makeResult({ events: [event2, event1], status: 'connected' }),
    );

    renderPanel();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Beta task');
    expect(items[1]).toHaveTextContent('Alpha task');
  });

  it('shows empty state when no events and status is not error', () => {
    mockUseActivityFeed.mockReturnValue(makeResult({ events: [], status: 'connected' }));

    renderPanel();

    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(
      screen.getByText('Actions on this board will appear here as they happen.'),
    ).toBeInTheDocument();
  });

  it('shows Reconnecting indicator when status is reconnecting', () => {
    mockUseActivityFeed.mockReturnValue(makeResult({ events: [], status: 'reconnecting' }));

    renderPanel();

    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  });

  it('shows Live updates unavailable and Retry button when status is error', () => {
    mockUseActivityFeed.mockReturnValue(makeResult({ events: [], status: 'error' }));

    renderPanel();

    expect(screen.getByText('Live updates unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry calls the retry function', () => {
    const mockRetry = vi.fn();
    mockUseActivityFeed.mockReturnValue(
      makeResult({ events: [], status: 'error', retry: mockRetry }),
    );

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRetry).toHaveBeenCalledOnce();
  });

  it('clicking the close button calls onClose', () => {
    mockUseActivityFeed.mockReturnValue(makeResult({ events: [event1], status: 'connected' }));
    const onClose = vi.fn();

    renderPanel(onClose);

    fireEvent.click(screen.getByRole('button', { name: /close activity feed/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('pressing Escape calls onClose', () => {
    mockUseActivityFeed.mockReturnValue(makeResult({ events: [], status: 'connected' }));
    const onClose = vi.fn();

    renderPanel(onClose);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
