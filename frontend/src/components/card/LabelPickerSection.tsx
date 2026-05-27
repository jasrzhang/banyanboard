import { useEffect, useRef, useState } from 'react';
import type { Label } from '../../types/domain';
import { useLabels } from '../../hooks/useLabels';
import { useCreateLabel } from '../../hooks/useCreateLabel';
import { useReplaceCardLabels } from '../../hooks/useReplaceCardLabels';
import { ColorSwatchGrid } from '../ui/ColorSwatchGrid';

interface LabelPickerSectionProps {
  cardId: string;
  boardId: string;
  cardLabels: Label[];
}

const DEFAULT_COLOR = '#be123c'; // rose (first palette entry)

export function LabelPickerSection({ cardId, boardId, cardLabels }: LabelPickerSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Optimistic local copy of assigned label IDs
  const [pendingLabelIds, setPendingLabelIds] = useState<string[]>(() =>
    cardLabels.map((l) => l.id),
  );

  // Keep pending in sync when cardLabels prop changes (after server invalidation)
  useEffect(() => {
    setPendingLabelIds(cardLabels.map((l) => l.id));
  }, [cardLabels]);

  // Creation form state
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState(DEFAULT_COLOR);
  const [labelIcon, setLabelIcon] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const firstChipRef = useRef<HTMLButtonElement>(null);

  const { data: boardLabels = [] } = useLabels(boardId);
  const { mutate: replaceLabelsMutate } = useReplaceCardLabels(boardId);
  const {
    mutate: createLabelMutate,
    isPending: isCreating,
    isError: isCreateError,
    error: createApiError,
  } = useCreateLabel(boardId);

  // Derive a displayable error from hook error state (e.g. 409 conflict surfaced by parent)
  const derivedCreateError =
    isCreateError && createApiError
      ? createApiError.message.includes('409') ||
        createApiError.message.toLowerCase().includes('conflict') ||
        createApiError.message.toLowerCase().includes('already exists')
        ? 'A label with this name already exists'
        : 'Failed to create label. Please try again.'
      : null;

  // Panel open/close with focus management
  useEffect(() => {
    if (isOpen && !showCreate) {
      firstChipRef.current?.focus();
    }
  }, [isOpen, showCreate]);

  useEffect(() => {
    if (showCreate) {
      nameInputRef.current?.focus();
    }
  }, [showCreate]);

  // Outside-click + Escape close
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        closePanel();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePanel();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function closePanel() {
    setIsOpen(false);
    setShowCreate(false);
    resetCreateForm();
    triggerRef.current?.focus();
  }

  function resetCreateForm() {
    setLabelName('');
    setLabelColor(DEFAULT_COLOR);
    setLabelIcon('');
    setNameError(null);
  }

  function handleToggle(label: Label) {
    const isAssigned = pendingLabelIds.includes(label.id);
    const newIds = isAssigned
      ? pendingLabelIds.filter((id) => id !== label.id)
      : [...pendingLabelIds, label.id];
    const newLabels = boardLabels.filter((l) => newIds.includes(l.id));

    setPendingLabelIds(newIds);
    replaceLabelsMutate({ cardId, labelIds: newIds, labels: newLabels });
  }

  function handleDirectRemove(label: Label) {
    const newIds = pendingLabelIds.filter((id) => id !== label.id);
    const newLabels = boardLabels.filter((l) => newIds.includes(l.id));
    setPendingLabelIds(newIds);
    replaceLabelsMutate({ cardId, labelIds: newIds, labels: newLabels });
  }

  function handleEmojiChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chars = [...e.target.value];
    setLabelIcon(chars[0] ?? '');
  }

  function handleCreate() {
    const trimmed = labelName.trim();
    if (!trimmed) {
      setNameError('Label name is required');
      return;
    }
    setNameError(null);

    createLabelMutate({ name: trimmed, color: labelColor, icon: labelIcon || null });
  }

  // Assigned label objects (from boardLabels resolved by pending IDs for current display)
  const assignedLabelObjects = boardLabels.filter((l) => pendingLabelIds.includes(l.id));
  // Fall back to prop labels if board labels not yet loaded
  const displayAssigned =
    assignedLabelObjects.length > 0 || pendingLabelIds.length === 0
      ? assignedLabelObjects
      : cardLabels;

  const previewLabel: Label = {
    id: '__preview__',
    name: labelName || 'Label name',
    color: labelColor,
    icon: labelIcon || null,
  };

  return (
    <div className="flex flex-col gap-1 relative">
      <span className="text-xs font-medium text-text-secondary">Labels</span>

      {/* Trigger row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {displayAssigned.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: label.color + '33', color: label.color }}
          >
            {label.icon && <span aria-hidden="true">{label.icon}</span>}
            {label.name}
            <button
              type="button"
              aria-label={`Remove ${label.name} label`}
              onClick={() => handleDirectRemove(label)}
              className="ml-0.5 text-current opacity-70 hover:opacity-100 focus:outline-none focus:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls="label-picker-panel"
          aria-label="Add labels"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-text-secondary
                     border border-border hover:bg-nav-hover
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                     transition-colors duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          {displayAssigned.length === 0 ? 'Add labels' : 'Edit'}
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Popover panel */}
      {isOpen && (
        <div
          ref={panelRef}
          id="label-picker-panel"
          role="group"
          aria-label="Board labels"
          className="absolute left-0 top-full mt-1 z-[60]
                     min-w-[240px] max-w-[300px] max-h-64 overflow-y-auto
                     bg-surface-card border border-border rounded-lg shadow-lg p-2"
        >
          {!showCreate ? (
            <>
              {boardLabels.length === 0 ? (
                <p className="text-xs text-text-secondary px-2 py-2 text-center">
                  No labels yet — create your first one below
                </p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {boardLabels.map((label, index) => {
                    const isAssigned = pendingLabelIds.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        ref={index === 0 ? firstChipRef : undefined}
                        type="button"
                        role="checkbox"
                        aria-checked={isAssigned}
                        onClick={() => handleToggle(label)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left
                                    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                                    transition-colors duration-100
                                    ${isAssigned ? 'font-medium bg-nav-hover' : 'hover:bg-nav-hover'}`}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                          aria-hidden="true"
                        />
                        <span className="flex-1">
                          {label.icon && <span aria-hidden="true">{label.icon} </span>}
                          {label.name}
                        </span>
                        {isAssigned && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-text-secondary
                           hover:bg-nav-hover hover:text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                           border-t border-border mt-1 pt-2"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
                New label
              </button>
            </>
          ) : (
            /* Creation form */
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setShowCreate(false); resetCreateForm(); }}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary
                           focus:outline-none focus:underline mb-1"
              >
                ← Back
              </button>

              {/* Name input */}
              <div className="flex flex-col gap-0.5">
                <label htmlFor="label-name-input" className="text-xs font-medium text-text-secondary">
                  Label name
                </label>
                <input
                  ref={nameInputRef}
                  id="label-name-input"
                  type="text"
                  value={labelName}
                  onChange={(e) => { setLabelName(e.target.value); setNameError(null); }}
                  placeholder="Label name..."
                  maxLength={50}
                  aria-invalid={nameError ? 'true' : 'false'}
                  aria-describedby={nameError ? 'label-name-error' : undefined}
                  className={`w-full rounded-md border px-3 py-1.5 text-sm text-text-primary
                              bg-surface-card placeholder:text-text-disabled
                              focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                              ${nameError ? 'border-red-400 focus:ring-red-400' : 'border-border'}`}
                />
                {nameError && (
                  <span id="label-name-error" className="text-xs text-red-500">
                    {nameError}
                  </span>
                )}
              </div>

              {/* Color swatches */}
              <div>
                <span className="text-xs font-medium text-text-secondary">Color</span>
                <div className="mt-1">
                  <ColorSwatchGrid selectedHex={labelColor} onSelect={setLabelColor} />
                </div>
              </div>

              {/* Emoji input */}
              <div className="flex flex-col gap-0.5">
                <label htmlFor="label-icon-input" className="text-xs font-medium text-text-secondary">
                  Icon (emoji, optional)
                </label>
                <input
                  id="label-icon-input"
                  type="text"
                  value={labelIcon}
                  onChange={handleEmojiChange}
                  placeholder="e.g. 🐛"
                  maxLength={2}
                  aria-describedby="label-icon-hint"
                  className="w-16 rounded-md border border-border px-2 py-1.5 text-sm text-center
                             bg-surface-card placeholder:text-text-disabled
                             focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                />
                <span id="label-icon-hint" className="text-xs text-text-disabled">
                  Paste or type one emoji (optional)
                </span>
              </div>

              {/* Live preview */}
              <div>
                <span className="text-xs font-medium text-text-secondary">Preview</span>
                <div className="mt-1" aria-live="polite">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: previewLabel.color + '33', color: previewLabel.color }}
                  >
                    {previewLabel.icon && <span aria-hidden="true">{previewLabel.icon}</span>}
                    {previewLabel.name}
                  </span>
                </div>
              </div>

              {/* Create error from hook state */}
              {derivedCreateError && (
                <p className="text-xs text-red-500">{derivedCreateError}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); resetCreateForm(); }}
                  className="text-xs text-text-secondary hover:text-text-primary
                             focus:outline-none focus:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="bg-primary hover:bg-primary-hover text-primary-foreground
                             text-xs font-medium px-3 py-1.5 rounded-md
                             disabled:opacity-50 disabled:cursor-not-allowed
                             focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                             transition-colors duration-150"
                >
                  {isCreating ? 'Creating...' : 'Create label'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
