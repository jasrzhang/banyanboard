import type { AutomationRepository, AutomationRule, CreateAutomationRuleData } from '../repositories/AutomationRepository.js';
import type { ActivityService } from './ActivityService.js';
import type { Logger } from '../types/logger.js';

// Re-export repository types so controllers can import from the service layer
// without violating the controller→repository layering rule enforced by ESLint.
export { AutomationRule, CreateAutomationRuleData } from '../repositories/AutomationRepository.js';

/**
 * Thrown by createRule() when the new rule would produce a direct 2-hop
 * column-move loop (A→B and B→A both exist). Mapped to HTTP 422 by
 * AutomationController.create so the client receives a machine-readable code.
 */
export class CircularRuleError extends Error {
  readonly code = 'CIRCULAR_RULE_DETECTED';

  constructor(message = 'This rule would create a circular automation loop') {
    super(message);
    this.name = 'CircularRuleError';
  }
}

/** Thrown by deleteRule() when boardId + ruleId pair is not found. Maps to 404. */
export class NotFoundError extends Error {
  constructor(message = 'Automation rule not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class AutomationService {
  constructor(
    private readonly automationRepo: AutomationRepository,
    private readonly activityService: ActivityService,
    private readonly logger: Logger,
  ) {}

  async listByBoard(boardId: string): Promise<AutomationRule[]> {
    return this.automationRepo.findByBoardId(boardId);
  }

  async createRule(boardId: string, data: CreateAutomationRuleData): Promise<AutomationRule> {
    // Cycle detection: only applies to card_moved_to_column → move_to_column pairs.
    // Detects direct 2-hop loops (A→B, B→A) only.
    // TODO: Multi-hop cycles (A→B→C→A) are out of scope for MVP.
    if (data.triggerType === 'card_moved_to_column' && data.actionType === 'move_to_column') {
      const triggerColumnId = data.triggerConfig['columnId'];
      const actionColumnId = data.actionConfig['columnId'];

      if (triggerColumnId && actionColumnId) {
        // A loop exists if any existing rule has its trigger column equal to our
        // action column AND its action column equal to our trigger column.
        const existingMoveRules = await this.automationRepo.findMoveRulesByBoard(boardId);
        const hasCycle = existingMoveRules.some(
          (rule) =>
            rule.triggerConfig['columnId'] === actionColumnId &&
            rule.actionConfig['columnId'] === triggerColumnId,
        );
        if (hasCycle) {
          throw new CircularRuleError();
        }
      }
    }

    return this.automationRepo.create(boardId, data);
  }

  async deleteRule(boardId: string, ruleId: string): Promise<void> {
    // delete() scopes the DELETE to (boardId, ruleId) — returns false when the
    // rule belongs to a different board, preventing cross-board deletion.
    const deleted = await this.automationRepo.delete(boardId, ruleId);
    if (!deleted) {
      throw new NotFoundError();
    }
  }

  /**
   * Evaluates automation rules triggered by a card being moved to a column.
   * Called fire-and-forget from CardController after the HTTP response is sent,
   * so rule failures never surface to the client. Each rule is executed
   * independently — a failure in one rule does not skip subsequent rules.
   */
  async evaluateCardMoved(boardId: string, cardId: string, toColumnId: string): Promise<void> {
    let matchingRules: AutomationRule[];
    try {
      matchingRules = await this.automationRepo.findEnabledByTrigger(
        boardId,
        'card_moved_to_column',
        toColumnId,
      );
    } catch (err) {
      // DB failure during rule lookup: log and bail rather than propagate.
      // The primary card-move operation already succeeded at this point.
      this.logger.warn('RULE_EXECUTION_FAILED', {
        event: 'RULE_EXECUTION_FAILED',
        triggerType: 'card_moved_to_column',
        reason: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    for (const rule of matchingRules) {
      try {
        await this.executeAction(boardId, cardId, rule);
      } catch (err) {
        // Per-rule failure: log and continue to remaining rules.
        // Common cause: stale rule referencing a deleted label or column.
        this.logger.warn('RULE_EXECUTION_FAILED', {
          event: 'RULE_EXECUTION_FAILED',
          ruleId: rule.id,
          triggerType: rule.triggerType,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Evaluates automation rules triggered when labels are assigned to a card.
   * Called fire-and-forget from CardLabelController after the HTTP response is
   * sent. Only newly-added label IDs are evaluated (not the full post-update set),
   * so re-assigning an already-present label does not re-fire its rules.
   */
  async evaluateLabelAssigned(boardId: string, cardId: string, addedLabelIds: string[]): Promise<void> {
    for (const labelId of addedLabelIds) {
      let matchingRules: AutomationRule[];
      try {
        matchingRules = await this.automationRepo.findEnabledByLabelTrigger(boardId, labelId);
      } catch (err) {
        // DB failure for this label: log, skip to next label.
        this.logger.warn('RULE_EXECUTION_FAILED', {
          event: 'RULE_EXECUTION_FAILED',
          triggerType: 'card_label_assigned',
          reason: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      for (const rule of matchingRules) {
        try {
          await this.executeAction(boardId, cardId, rule);
        } catch (err) {
          this.logger.warn('RULE_EXECUTION_FAILED', {
            event: 'RULE_EXECUTION_FAILED',
            ruleId: rule.id,
            triggerType: rule.triggerType,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  /**
   * Dispatches a single rule action and records an automation_triggered activity
   * event on success. Throws on misconfigured actionConfig so the caller can log
   * RULE_EXECUTION_FAILED and continue to the next rule.
   */
  private async executeAction(boardId: string, cardId: string, rule: AutomationRule): Promise<void> {
    if (rule.actionType === 'assign_label') {
      const labelId = rule.actionConfig['labelId'];
      if (!labelId) throw new Error('assign_label rule missing labelId in actionConfig');
      // ON CONFLICT DO NOTHING handles idempotent re-assignment gracefully.
      await this.automationRepo.assignLabel(cardId, labelId);
    } else if (rule.actionType === 'move_to_column') {
      const columnId = rule.actionConfig['columnId'];
      if (!columnId) throw new Error('move_to_column rule missing columnId in actionConfig');
      await this.automationRepo.moveCardToColumn(cardId, columnId);
    } else if (rule.actionType === 'notify') {
      // notify: no side-effect beyond the activity event recorded below.
      // Placeholder for future notification delivery (email, webhook, etc.).
    }

    // Always record an automation_triggered event so the activity feed shows
    // which rule fired and what action it took.
    await this.activityService.recordEvent({
      boardId,
      cardId,
      eventType: 'automation_triggered',
      payload: {
        ruleId: rule.id,
        triggerType: rule.triggerType,
        actionType: rule.actionType,
      },
    });
  }
}
