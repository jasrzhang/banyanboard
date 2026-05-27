import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useBoard } from '../../hooks/useBoard';
import { useUpdateCard } from '../../hooks/useUpdateCard';
import type { Card } from '../../types/domain';
import { LabelPickerSection } from './LabelPickerSection';

type RouteParams = { boardId: string; cardId: string };

interface FormValues {
  title: string;
  description: string;
  dueDate: string;
}

function toDateInputValue(isoDate: string | null): string {
  if (!isoDate) return '';
  return isoDate.slice(0, 10);
}

function toIsoOrNull(dateInputValue: string): string | null {
  if (!dateInputValue) return null;
  return new Date(dateInputValue + 'T00:00:00.000Z').toISOString();
}

function getInitialValues(card: Card): FormValues {
  return {
    title: card.title,
    description: card.description ?? '',
    dueDate: toDateInputValue(card.dueDate),
  };
}

function isDirty(current: FormValues, initial: FormValues): boolean {
  return JSON.stringify(current) !== JSON.stringify(initial);
}

function CardModalContent({ card, boardId }: { card: Card; boardId: string }) {
  const navigate = useNavigate();
  const { mutateAsync: saveCard } = useUpdateCard(boardId);
  const titleRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const initial = useRef<FormValues>(getInitialValues(card));
  const [form, setForm] = useState<FormValues>(initial.current);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty = isDirty(form, initial.current);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, input, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  function handleClose() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    navigate(-1);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) handleClose();
  }

  async function handleSave() {
    if (!dirty || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await saveCard({
        cardId: card.id,
        data: {
          title: form.title.trim() || card.title,
          description: form.description || null,
          dueDate: toIsoOrNull(form.dueDate),
        },
      });
      toast.success('Card saved');
      navigate(-1);
    } catch {
      setErrorMessage('Failed to save card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={handleBackdropClick}
      aria-hidden="false"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="bg-surface-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">Card Detail</span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close card detail"
            className="p-1.5 rounded-md text-text-secondary hover:bg-nav-hover
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                       transition-colors duration-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <div className="flex flex-col gap-4 px-5 pb-4 flex-1">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <label htmlFor="modal-title" className="text-xs font-medium text-text-secondary">
              Title
            </label>
            <input
              ref={titleRef}
              id="modal-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-text-primary
                         bg-surface-card placeholder:text-text-disabled
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              placeholder="Card title"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label htmlFor="modal-description" className="text-xs font-medium text-text-secondary">
              Description
            </label>
            <textarea
              id="modal-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="Add a description..."
              className="w-full resize-none rounded-md border border-border px-3 py-2 text-sm text-text-primary
                         bg-surface-card placeholder:text-text-disabled
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
          </div>

          {/* Due date */}
          <div className="flex flex-col gap-1">
            <label htmlFor="modal-due-date" className="text-xs font-medium text-text-secondary">
              Due Date
            </label>
            <input
              id="modal-due-date"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-primary
                         bg-surface-card
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
          </div>

          {/* Labels (interactive picker) */}
          <LabelPickerSection cardId={card.id} boardId={boardId} cardLabels={card.labels} />

          {/* Inline error */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-text-secondary hover:text-text-primary px-4 py-2 rounded-md
                       hover:bg-nav-hover
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                       transition-colors duration-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || isSubmitting}
            aria-busy={isSubmitting}
            className="bg-primary hover:bg-primary-hover text-primary-foreground
                       text-sm font-medium px-4 py-2 rounded-md
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                       transition-colors duration-150"
          >
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CardDetailModal() {
  const { boardId, cardId } = useParams<RouteParams>();
  const { data: board, isLoading } = useBoard(boardId ?? '');

  const card = board?.columns.flatMap((c) => c.cards).find((c) => c.id === cardId);

  if (isLoading) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-surface-card rounded-xl shadow-2xl p-6 text-sm text-text-secondary">
          Loading...
        </div>
      </div>,
      document.body,
    );
  }

  if (!card || !boardId) {
    return null;
  }

  return createPortal(<CardModalContent card={card} boardId={boardId} />, document.body);
}
