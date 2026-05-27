import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

// Mocks must be declared before importing the hooks
vi.mock('../hooks/useLabels');
vi.mock('../hooks/useCreateLabel');
vi.mock('../hooks/useDeleteLabel');
vi.mock('../hooks/useReplaceCardLabels');
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

import { useLabels } from '../hooks/useLabels';
import { useCreateLabel } from '../hooks/useCreateLabel';
import { useDeleteLabel } from '../hooks/useDeleteLabel';
import { useReplaceCardLabels } from '../hooks/useReplaceCardLabels';
import { LabelPickerSection } from '../components/card/LabelPickerSection';

const mockUseLabels = vi.mocked(useLabels);
const mockUseCreateLabel = vi.mocked(useCreateLabel);
const mockUseDeleteLabel = vi.mocked(useDeleteLabel);
const mockUseReplaceCardLabels = vi.mocked(useReplaceCardLabels);

const fixtureBoardId = 'board-1';
const fixtureCardId = 'card-1';

const fixtureLabels = [
  { id: 'lbl-1', name: 'bug', color: '#be123c', icon: null },
  { id: 'lbl-2', name: 'feature', color: '#047857', icon: null },
  { id: 'lbl-3', name: 'frontend', color: '#0369a1', icon: null },
];

function makeMutate() {
  return vi.fn();
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPicker(
  cardLabels: typeof fixtureLabels,
  boardLabels = fixtureLabels,
) {
  const replaceMutate = makeMutate();
  const createMutate = makeMutate();
  const deleteMutate = makeMutate();

  mockUseLabels.mockReturnValue({
    data: boardLabels,
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useLabels>);

  mockUseReplaceCardLabels.mockReturnValue({
    mutate: replaceMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useReplaceCardLabels>);

  mockUseCreateLabel.mockReturnValue({
    mutate: createMutate,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCreateLabel>);

  mockUseDeleteLabel.mockReturnValue({
    mutate: deleteMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteLabel>);

  const qc = makeQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <LabelPickerSection
        boardId={fixtureBoardId}
        cardId={fixtureCardId}
        cardLabels={cardLabels}
      />
    </QueryClientProvider>,
  );

  return { replaceMutate, createMutate, deleteMutate };
}

describe('LabelPickerSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trigger row', () => {
    it('renders "Add labels" trigger button when no labels are assigned to the card', () => {
      renderPicker([]);

      expect(screen.getByRole('button', { name: /add labels/i })).toBeInTheDocument();
    });

    it('shows assigned label badges in trigger row when labels are assigned', () => {
      renderPicker([fixtureLabels[0], fixtureLabels[2]]);

      expect(screen.getByText('bug')).toBeInTheDocument();
      expect(screen.getByText('frontend')).toBeInTheDocument();
      // Unassigned label should not be in the trigger row
      expect(screen.queryByText('feature')).not.toBeInTheDocument();
    });

    it('renders direct-remove "x" button on each assigned badge', () => {
      renderPicker([fixtureLabels[0]]);

      expect(
        screen.getByRole('button', { name: /remove bug label/i }),
      ).toBeInTheDocument();
    });

    it('"x" button on assigned badge calls replace mutation with label removed', async () => {
      const user = userEvent.setup();
      const { replaceMutate } = renderPicker([fixtureLabels[0], fixtureLabels[2]]);

      const removeBtn = screen.getByRole('button', { name: /remove bug label/i });
      await user.click(removeBtn);

      expect(replaceMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: fixtureCardId,
          labelIds: ['lbl-3'], // only 'frontend' remains
        }),
      );
    });
  });

  describe('popover panel', () => {
    it('clicking trigger opens the popover panel', async () => {
      const user = userEvent.setup();
      renderPicker([]);

      await user.click(screen.getByRole('button', { name: /add labels/i }));

      // Panel should now be visible — board labels appear as chips
      expect(screen.getByText('bug')).toBeInTheDocument();
      expect(screen.getByText('feature')).toBeInTheDocument();
      expect(screen.getByText('frontend')).toBeInTheDocument();
    });

    it('panel shows board labels as checkbox-chips', async () => {
      const user = userEvent.setup();
      renderPicker([fixtureLabels[0]]);

      await user.click(screen.getByRole('button', { name: /add labels/i }));

      // All 3 board labels should be visible as chips
      expect(screen.getAllByText('bug').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('feature')).toBeInTheDocument();
      expect(screen.getByText('frontend')).toBeInTheDocument();
    });

    it('clicking a label chip calls replace mutation with updated label set', async () => {
      const user = userEvent.setup();
      const { replaceMutate } = renderPicker([fixtureLabels[0]]);

      // Open panel
      await user.click(screen.getByRole('button', { name: /add labels/i }));

      // Click 'feature' chip to add it
      const featureChip = screen.getByRole('checkbox', { name: /feature/i });
      await user.click(featureChip);

      expect(replaceMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: fixtureCardId,
          labelIds: expect.arrayContaining(['lbl-1', 'lbl-2']),
        }),
      );
    });

    it('clicking an already-assigned chip removes it from the label set', async () => {
      const user = userEvent.setup();
      const { replaceMutate } = renderPicker([fixtureLabels[0], fixtureLabels[1]]);

      await user.click(screen.getByRole('button', { name: /add labels/i }));

      // Click 'bug' chip to uncheck/remove it
      const bugChip = screen.getByRole('checkbox', { name: /bug/i });
      await user.click(bugChip);

      expect(replaceMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: fixtureCardId,
          labelIds: ['lbl-2'], // only 'feature' remains
        }),
      );
    });

    it('pressing Escape closes the panel', async () => {
      const user = userEvent.setup();
      renderPicker([]);

      await user.click(screen.getByRole('button', { name: /add labels/i }));
      expect(screen.getByText('bug')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('bug')).not.toBeInTheDocument();
      });
    });

    it('shows empty state message when board has no labels', async () => {
      const user = userEvent.setup();
      renderPicker([], []);

      await user.click(screen.getByRole('button', { name: /add labels/i }));

      expect(screen.getByText(/no labels yet/i)).toBeInTheDocument();
    });
  });

  describe('new label creation form', () => {
    async function openPanelAndClickNewLabel() {
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /add labels/i }));
      await user.click(screen.getByRole('button', { name: /new label/i }));
      return user;
    }

    it('"New label" row is present in panel', async () => {
      const user = userEvent.setup();
      renderPicker([]);

      await user.click(screen.getByRole('button', { name: /add labels/i }));

      expect(screen.getByRole('button', { name: /new label/i })).toBeInTheDocument();
    });

    it('clicking "New label" shows the creation form', async () => {
      renderPicker([]);
      await openPanelAndClickNewLabel();

      expect(screen.getByRole('textbox', { name: /label name/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    });

    it('creation form has color swatches', async () => {
      renderPicker([]);
      await openPanelAndClickNewLabel();

      // 12 swatch buttons inside the creation form
      const swatchButtons = screen.getAllByRole('button', { name: /rose|emerald|sky|violet|pink|fuchsia|indigo|teal|amber|orange|brown|slate/i });
      expect(swatchButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('creation form has an emoji text input', async () => {
      renderPicker([]);
      await openPanelAndClickNewLabel();

      expect(screen.getByRole('textbox', { name: /emoji/i })).toBeInTheDocument();
    });

    it('submitting with empty name shows validation error', async () => {
      const user = userEvent.setup();
      renderPicker([]);
      await openPanelAndClickNewLabel();

      await user.click(screen.getByRole('button', { name: /create/i }));

      expect(screen.getByText(/label name is required/i)).toBeInTheDocument();
    });

    it('submitting with valid name calls createLabel mutation', async () => {
      const user = userEvent.setup();
      const { createMutate } = renderPicker([]);
      await openPanelAndClickNewLabel();

      await user.type(screen.getByRole('textbox', { name: /label name/i }), 'urgent');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(createMutate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'urgent' }),
        );
      });
    });

    it('shows "A label with this name already exists" error on 409 response', async () => {
      const user = userEvent.setup();
      // All mocks set manually so renderPicker does not override the 409 error state
      mockUseLabels.mockReturnValue({
        data: fixtureLabels,
        isLoading: false,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useLabels>);
      mockUseReplaceCardLabels.mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useReplaceCardLabels>);
      mockUseDeleteLabel.mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useDeleteLabel>);
      mockUseCreateLabel.mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('HTTP 409: Conflict'),
      } as unknown as ReturnType<typeof useCreateLabel>);

      const qc = makeQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <LabelPickerSection boardId={fixtureBoardId} cardId={fixtureCardId} cardLabels={[]} />
        </QueryClientProvider>,
      );

      await user.click(screen.getByRole('button', { name: /add labels/i }));
      await user.click(screen.getByRole('button', { name: /new label/i }));

      expect(
        screen.getByText(/a label with this name already exists/i),
      ).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('remove badge button has accessible aria-label "Remove {name} label"', () => {
      renderPicker([fixtureLabels[0]]);

      expect(
        screen.getByRole('button', { name: 'Remove bug label' }),
      ).toBeInTheDocument();
    });
  });
});
