import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useCreateAutomationRule } from '../../hooks/useCreateAutomationRule';
import type { AutomationRule } from '../../types/domain';

type TriggerType = AutomationRule['triggerType'] | '';
type ActionType = AutomationRule['actionType'] | '';

interface AutomationRuleFormProps {
  boardId: string;
  columns: Array<{ id: string; name: string }>;
  labels: Array<{ id: string; name: string; color: string; icon?: string | null }>;
  onCancel: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  triggerType?: string;
  triggerConfig?: string;
  actionType?: string;
  actionConfig?: string;
}

export function AutomationRuleForm({ boardId, columns, labels, onCancel, onSuccess }: AutomationRuleFormProps) {
  const [triggerType, setTriggerType] = useState<TriggerType>('');
  const [triggerColumnId, setTriggerColumnId] = useState('');
  const [triggerLabelId, setTriggerLabelId] = useState('');
  const [actionType, setActionType] = useState<ActionType>('');
  const [actionLabelId, setActionLabelId] = useState('');
  const [actionColumnId, setActionColumnId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');

  const createRule = useCreateAutomationRule(boardId);
  const firstSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstSelectRef.current?.focus();
  }, []);

  const validate = (): FormErrors => {
    const newErrors: FormErrors = {};
    if (!triggerType) {
      newErrors.triggerType = 'Select a trigger type';
    }
    if (triggerType === 'card_moved_to_column' && !triggerColumnId) {
      newErrors.triggerConfig = 'Select a column to watch';
    }
    if (triggerType === 'card_label_assigned' && !triggerLabelId) {
      newErrors.triggerConfig = 'Select a label to watch';
    }
    if (!actionType) {
      newErrors.actionType = 'Select an action type';
    }
    if (actionType === 'assign_label' && !actionLabelId) {
      newErrors.actionConfig = 'Select a label to apply';
    }
    if (actionType === 'move_to_column' && !actionColumnId) {
      newErrors.actionConfig = 'Select a column to move to';
    }
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setFormError('');

    const triggerConfig: Record<string, string> = {};
    if (triggerType === 'card_moved_to_column') triggerConfig['columnId'] = triggerColumnId;
    if (triggerType === 'card_label_assigned') triggerConfig['labelId'] = triggerLabelId;

    const actionConfig: Record<string, string> = {};
    if (actionType === 'assign_label') actionConfig['labelId'] = actionLabelId;
    if (actionType === 'move_to_column') actionConfig['columnId'] = actionColumnId;

    createRule.mutate(
      {
        triggerType: triggerType as AutomationRule['triggerType'],
        triggerConfig,
        actionType: actionType as AutomationRule['actionType'],
        actionConfig,
      },
      {
        onSuccess: () => {
          toast.success('Automation rule saved');
          onSuccess();
        },
        onError: (error: unknown) => {
          if (error instanceof Error && error.message.startsWith('HTTP 422')) {
            setFormError('This rule would create a circular automation loop');
          } else {
            toast.error('Failed to save rule. Please try again.');
          }
        },
      },
    );
  };

  const handleTriggerTypeChange = (value: TriggerType) => {
    setTriggerType(value);
    setTriggerColumnId('');
    setTriggerLabelId('');
    setErrors((prev) => ({ ...prev, triggerConfig: undefined }));
  };

  const handleActionTypeChange = (value: ActionType) => {
    setActionType(value);
    setActionLabelId('');
    setActionColumnId('');
    setErrors((prev) => ({ ...prev, actionConfig: undefined }));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-col gap-4 px-4 py-3 flex-1 overflow-y-auto">
        {/* TRIGGER section */}
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Trigger</p>

          <label htmlFor="trigger-type" className="text-xs font-medium text-text-secondary block mb-1">
            When…
          </label>
          <select
            id="trigger-type"
            ref={firstSelectRef}
            value={triggerType}
            onChange={(e) => handleTriggerTypeChange(e.target.value as TriggerType)}
            aria-invalid={!!errors.triggerType}
            aria-describedby={errors.triggerType ? 'trigger-type-error' : undefined}
            className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            <option value="">Select trigger…</option>
            <option value="card_moved_to_column">Card moves to column</option>
            <option value="card_label_assigned">Label assigned to card</option>
            <option value="card_due_date_set">Due date set on card</option>
          </select>
          {errors.triggerType && (
            <span id="trigger-type-error" className="text-xs text-red-500 mt-1 block">
              {errors.triggerType}
            </span>
          )}
        </div>

        {/* Trigger config: column (card_moved_to_column) */}
        {triggerType === 'card_moved_to_column' && (
          <div>
            <label htmlFor="trigger-column" className="text-xs font-medium text-text-secondary block mb-1">
              Column
            </label>
            <select
              id="trigger-column"
              value={triggerColumnId}
              onChange={(e) => {
                setTriggerColumnId(e.target.value);
                setErrors((prev) => ({ ...prev, triggerConfig: undefined }));
              }}
              aria-invalid={!!errors.triggerConfig}
              aria-describedby={errors.triggerConfig ? 'trigger-config-error' : undefined}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              <option value="">Select a column to watch</option>
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
            {errors.triggerConfig && (
              <span id="trigger-config-error" className="text-xs text-red-500 mt-1 block">
                {errors.triggerConfig}
              </span>
            )}
          </div>
        )}

        {/* Trigger config: label (card_label_assigned) */}
        {triggerType === 'card_label_assigned' && (
          <div>
            <label htmlFor="trigger-label" className="text-xs font-medium text-text-secondary block mb-1">
              Label
            </label>
            <select
              id="trigger-label"
              value={triggerLabelId}
              onChange={(e) => {
                setTriggerLabelId(e.target.value);
                setErrors((prev) => ({ ...prev, triggerConfig: undefined }));
              }}
              aria-invalid={!!errors.triggerConfig}
              aria-describedby={errors.triggerConfig ? 'trigger-config-error' : undefined}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              <option value="">Select a label to watch</option>
              {labels.map((lbl) => (
                <option key={lbl.id} value={lbl.id}>
                  {lbl.name}
                </option>
              ))}
            </select>
            {errors.triggerConfig && (
              <span id="trigger-config-error" className="text-xs text-red-500 mt-1 block">
                {errors.triggerConfig}
              </span>
            )}
          </div>
        )}

        {/* ACTION section */}
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Action</p>

          <label htmlFor="action-type" className="text-xs font-medium text-text-secondary block mb-1">
            Then…
          </label>
          <select
            id="action-type"
            value={actionType}
            onChange={(e) => handleActionTypeChange(e.target.value as ActionType)}
            aria-invalid={!!errors.actionType}
            aria-describedby={errors.actionType ? 'action-type-error' : undefined}
            className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            <option value="">Select action…</option>
            <option value="assign_label">Assign label</option>
            <option value="move_to_column">Move card to column</option>
            <option value="notify">Notify team</option>
          </select>
          {errors.actionType && (
            <span id="action-type-error" className="text-xs text-red-500 mt-1 block">
              {errors.actionType}
            </span>
          )}
        </div>

        {/* Action config: label (assign_label) */}
        {actionType === 'assign_label' && (
          <div>
            <label htmlFor="action-label" className="text-xs font-medium text-text-secondary block mb-1">
              Label
            </label>
            <select
              id="action-label"
              value={actionLabelId}
              onChange={(e) => {
                setActionLabelId(e.target.value);
                setErrors((prev) => ({ ...prev, actionConfig: undefined }));
              }}
              aria-invalid={!!errors.actionConfig}
              aria-describedby={errors.actionConfig ? 'action-config-error' : undefined}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              <option value="">Select a label to apply</option>
              {labels.map((lbl) => (
                <option key={lbl.id} value={lbl.id}>
                  {lbl.name}
                </option>
              ))}
            </select>
            {errors.actionConfig && (
              <span id="action-config-error" className="text-xs text-red-500 mt-1 block">
                {errors.actionConfig}
              </span>
            )}
          </div>
        )}

        {/* Action config: column (move_to_column) */}
        {actionType === 'move_to_column' && (
          <div>
            <label htmlFor="action-column" className="text-xs font-medium text-text-secondary block mb-1">
              Column
            </label>
            <select
              id="action-column"
              value={actionColumnId}
              onChange={(e) => {
                setActionColumnId(e.target.value);
                setErrors((prev) => ({ ...prev, actionConfig: undefined }));
              }}
              aria-invalid={!!errors.actionConfig}
              aria-describedby={errors.actionConfig ? 'action-config-error' : undefined}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              <option value="">Select a column to move to</option>
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
            {errors.actionConfig && (
              <span id="action-config-error" className="text-xs text-red-500 mt-1 block">
                {errors.actionConfig}
              </span>
            )}
          </div>
        )}

        {/* Form-level error (circular rule / server error) */}
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-text-secondary hover:text-text-primary px-4 py-2 rounded-md hover:bg-nav-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createRule.isPending}
          aria-busy={createRule.isPending || undefined}
          className="bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        >
          {createRule.isPending ? (
            <>
              <svg
                className="h-4 w-4 animate-spin inline mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path d="M4 12a8 8 0 0 1 8-8" />
              </svg>
              Saving…
            </>
          ) : (
            'Save rule'
          )}
        </button>
      </div>
    </form>
  );
}
