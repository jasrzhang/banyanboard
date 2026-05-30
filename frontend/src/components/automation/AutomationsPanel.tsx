import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { AutomationRule } from '../../types/domain';
import { useAutomationRules } from '../../hooks/useAutomationRules';
import { useDeleteAutomationRule } from '../../hooks/useDeleteAutomationRule';
import { AutomationRuleForm } from './AutomationRuleForm';

interface AutomationsPanelProps {
  boardId: string;
  onClose: () => void;
  columns: Array<{ id: string; name: string }>;
  labels: Array<{ id: string; name: string; color: string; icon?: string | null }>;
}

function ruleToString(
  rule: AutomationRule,
  columns: Array<{ id: string; name: string }>,
  labels: Array<{ id: string; name: string; color: string; icon?: string | null }>,
): string {
  const findColumn = (id: string) => columns.find((c) => c.id === id)?.name ?? '(deleted)';
  const findLabel = (id: string) => labels.find((l) => l.id === id)?.name ?? '(deleted)';

  const { triggerType, triggerConfig, actionType, actionConfig } = rule;

  switch (triggerType) {
    case 'card_moved_to_column': {
      const colName = findColumn(triggerConfig['columnId'] ?? '');
      switch (actionType) {
        case 'assign_label':
          return `When card moves to ${colName} → Assign label: ${findLabel(actionConfig['labelId'] ?? '')}`;
        case 'move_to_column':
          return `When card moves to ${colName} → Move to: ${findColumn(actionConfig['columnId'] ?? '')}`;
        case 'notify':
          return `When card moves to ${colName} → Notify team`;
      }
      break;
    }
    case 'card_label_assigned': {
      const labelName = findLabel(triggerConfig['labelId'] ?? '');
      switch (actionType) {
        case 'assign_label':
          return `When label ${labelName} assigned → Assign label: ${findLabel(actionConfig['labelId'] ?? '')}`;
        case 'move_to_column':
          return `When label ${labelName} assigned → Move to: ${findColumn(actionConfig['columnId'] ?? '')}`;
        case 'notify':
          return `When label ${labelName} assigned → Notify team`;
      }
      break;
    }
    case 'card_due_date_set': {
      switch (actionType) {
        case 'assign_label':
          return `When due date set → Assign label: ${findLabel(actionConfig['labelId'] ?? '')}`;
        case 'move_to_column':
          return `When due date set → Move to: ${findColumn(actionConfig['columnId'] ?? '')}`;
        case 'notify':
          return `When due date set → Notify team`;
      }
      break;
    }
  }

  return 'Automation rule';
}

export function AutomationsPanel({ boardId, onClose, columns, labels }: AutomationsPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const { data: rules = [], isLoading } = useAutomationRules(boardId);
  const deleteRule = useDeleteAutomationRule(boardId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = (ruleId: string) => {
    deleteRule.mutate(ruleId, {
      onError: () => {
        toast.error('Failed to delete rule');
      },
    });
  };

  return (
    <aside
      aria-label="Automations"
      className="flex-shrink-0 w-80 border-l border-border bg-surface-card flex flex-col h-full overflow-hidden"
    >
      {/* Panel header — changes when form is open */}
      {showForm ? (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
            aria-label="Back to rules list"
          >
            ← New rule
          </button>
          <button
            type="button"
            aria-label="Close automations panel"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Automations</h2>
          <button
            type="button"
            aria-label="Close automations panel"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
          >
            ×
          </button>
        </div>
      )}

      {/* Body — form takeover or list/loading/empty */}
      {showForm ? (
        <AutomationRuleForm
          boardId={boardId}
          columns={columns}
          labels={labels}
          onCancel={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      ) : isLoading ? (
        <div className="flex justify-center p-4">
          <svg
            className="h-5 w-5 animate-spin text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M4 12a8 8 0 0 1 8-8" />
          </svg>
          <span className="sr-only">Loading rules…</span>
        </div>
      ) : rules.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center flex-1 gap-2 px-4 py-8 text-center">
          <svg
            className="h-8 w-8 text-text-disabled"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <p className="text-sm font-medium text-text-secondary">Automate repetitive transitions.</p>
          <p className="text-xs text-text-disabled">
            When a card moves to Done, apply the Shipped label — automatically.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-colors duration-150"
          >
            Add rule
          </button>
        </div>
      ) : (
        /* Rule list */
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
            >
              + Add rule
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {rules.map((rule) => {
              const summary = ruleToString(rule, columns, labels);
              const isDeleting = deleteRule.isPending && deleteRule.variables === rule.id;
              return (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border last:border-b-0 hover:bg-surface-sidebar"
                >
                  <span className="text-xs text-text-primary min-w-0 flex-1">{summary}</span>
                  <button
                    type="button"
                    aria-label="Delete rule"
                    onClick={() => handleDelete(rule.id)}
                    disabled={isDeleting}
                    className="shrink-0 text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <svg
                          className="h-3 w-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path d="M4 12a8 8 0 0 1 8-8" />
                        </svg>
                        <span className="sr-only">Deleting…</span>
                      </>
                    ) : (
                      <span aria-hidden="true">×</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}
