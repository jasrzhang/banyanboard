import { describe, it, expect } from 'vitest';
import type { Card } from '../types/domain';
import { filterCards, type FilterState } from '../utils/filterCards';

const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const futureDateSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
const futureDateLater = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

const makeCard = (overrides: Partial<Card>): Card => ({
  id: 'card-1',
  columnId: 'col-1',
  title: 'Default Title',
  description: null,
  dueDate: null,
  labels: [],
  position: 1000,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const emptyFilters: FilterState = {
  searchQuery: '',
  activeLabelIds: [],
  activeDateFilter: 'none',
};

const cards: Card[] = [
  makeCard({ id: 'card-1', title: 'Fix login bug', labels: [{ id: 'lbl-1', name: 'bug', color: '#be123c' }] }),
  makeCard({ id: 'card-2', title: 'Write API docs', labels: [] }),
  makeCard({ id: 'card-3', title: 'Implement Kanban UI', labels: [{ id: 'lbl-2', name: 'frontend', color: '#0369a1' }] }),
];

describe('filterCards', () => {
  it('returns all cards when filters are empty', () => {
    const result = filterCards(cards, emptyFilters);
    expect(result).toHaveLength(3);
  });

  it('matches by title substring (case-insensitive)', () => {
    const result = filterCards(cards, { ...emptyFilters, searchQuery: 'LOGIN' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('card-1');
  });

  it('returns empty array when no title match', () => {
    const result = filterCards(cards, { ...emptyFilters, searchQuery: 'zzzzz' });
    expect(result).toHaveLength(0);
  });

  it('filters by label id — card must have at least one matching label (OR within labels)', () => {
    const result = filterCards(cards, { ...emptyFilters, activeLabelIds: ['lbl-1'] });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('card-1');
  });

  it('shows all cards when activeLabelIds is empty', () => {
    const result = filterCards(cards, { ...emptyFilters, activeLabelIds: [] });
    expect(result).toHaveLength(3);
  });

  it('filters overdue cards (dueDate in past, non-null)', () => {
    const overdueCards: Card[] = [
      makeCard({ id: 'c1', title: 'Overdue task', dueDate: pastDate }),
      makeCard({ id: 'c2', title: 'Future task', dueDate: futureDateSoon }),
    ];
    const result = filterCards(overdueCards, { ...emptyFilters, activeDateFilter: 'overdue' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('c1');
  });

  it('excludes cards with null dueDate from overdue filter', () => {
    const mixed: Card[] = [
      makeCard({ id: 'c1', title: 'No due date', dueDate: null }),
      makeCard({ id: 'c2', title: 'Overdue', dueDate: pastDate }),
    ];
    const result = filterCards(mixed, { ...emptyFilters, activeDateFilter: 'overdue' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('c2');
  });

  it('filters due-soon cards (non-null dueDate within 7 days, not in the past)', () => {
    const dueSoonCards: Card[] = [
      makeCard({ id: 'c1', title: 'Overdue', dueDate: pastDate }),
      makeCard({ id: 'c2', title: 'Due soon', dueDate: futureDateSoon }),
      makeCard({ id: 'c3', title: 'Due later', dueDate: futureDateLater }),
      makeCard({ id: 'c4', title: 'No due date', dueDate: null }),
    ];
    const result = filterCards(dueSoonCards, { ...emptyFilters, activeDateFilter: 'due-soon' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('c2');
  });

  it('AND semantics: text and label filters both apply', () => {
    const result = filterCards(cards, {
      ...emptyFilters,
      searchQuery: 'fix',
      activeLabelIds: ['lbl-2'],
    });
    // 'fix' matches card-1 (has lbl-1), but card-1 does not have lbl-2 → no match
    expect(result).toHaveLength(0);
  });
});
