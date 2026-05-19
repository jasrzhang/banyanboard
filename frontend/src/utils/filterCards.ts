import type { Card } from '../types/domain';

export interface FilterState {
  searchQuery: string;
  activeLabelIds: string[];
  activeDateFilter: 'none' | 'overdue' | 'due-soon';
}

export function filterCards(cards: Card[], filters: FilterState): Card[] {
  const { searchQuery, activeLabelIds, activeDateFilter } = filters;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return cards.filter((card) => {
    // Text search: case-insensitive substring match on card.title
    if (searchQuery.length > 0) {
      if (!card.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    // Label filter: card must have at least one label with id in activeLabelIds (OR within labels)
    if (activeLabelIds.length > 0) {
      const hasMatchingLabel = card.labels.some((label) =>
        activeLabelIds.includes(label.id),
      );
      if (!hasMatchingLabel) {
        return false;
      }
    }

    // Date filter
    if (activeDateFilter === 'overdue') {
      if (card.dueDate === null) return false;
      const dueDate = new Date(card.dueDate);
      if (dueDate >= now) return false;
    } else if (activeDateFilter === 'due-soon') {
      if (card.dueDate === null) return false;
      const dueDate = new Date(card.dueDate);
      if (dueDate < now || dueDate > sevenDaysFromNow) return false;
    }

    return true;
  });
}
