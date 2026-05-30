import { z } from 'zod';

/*
 * Zod schema for POST /api/boards/:boardId/automations.
 *
 * triggerConfig and actionConfig are open-ended JSONB maps in the DB, but the
 * required keys depend on the trigger/action type. superRefine() enforces
 * cross-field validation that cannot be expressed with discriminated unions
 * because both sides of the pair are in the same flat object.
 *
 * Supported combinations (MVP):
 *   card_moved_to_column   + assign_label    → triggerConfig.columnId, actionConfig.labelId
 *   card_moved_to_column   + move_to_column  → triggerConfig.columnId, actionConfig.columnId
 *   card_label_assigned    + assign_label    → triggerConfig.labelId,  actionConfig.labelId
 *   card_label_assigned    + move_to_column  → triggerConfig.labelId,  actionConfig.columnId
 *   (any trigger)          + notify          → no config keys required
 */
export const CreateAutomationRuleSchema = z
  .object({
    triggerType: z.enum(['card_moved_to_column', 'card_label_assigned', 'card_due_date_set']),
    triggerConfig: z.record(z.string(), z.string()).default({}),
    actionType: z.enum(['assign_label', 'move_to_column', 'notify']),
    actionConfig: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((data, ctx) => {
    // Validate triggerConfig based on triggerType
    if (data.triggerType === 'card_moved_to_column') {
      if (!data.triggerConfig['columnId'] || !z.string().uuid().safeParse(data.triggerConfig['columnId']).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['triggerConfig', 'columnId'],
          message: 'triggerConfig.columnId must be a valid UUID for card_moved_to_column trigger',
        });
      }
    }
    if (data.triggerType === 'card_label_assigned') {
      if (!data.triggerConfig['labelId'] || !z.string().uuid().safeParse(data.triggerConfig['labelId']).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['triggerConfig', 'labelId'],
          message: 'triggerConfig.labelId must be a valid UUID for card_label_assigned trigger',
        });
      }
    }

    // Validate actionConfig based on actionType
    if (data.actionType === 'assign_label') {
      if (!data.actionConfig['labelId'] || !z.string().uuid().safeParse(data.actionConfig['labelId']).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actionConfig', 'labelId'],
          message: 'actionConfig.labelId must be a valid UUID for assign_label action',
        });
      }
    }
    if (data.actionType === 'move_to_column') {
      if (!data.actionConfig['columnId'] || !z.string().uuid().safeParse(data.actionConfig['columnId']).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actionConfig', 'columnId'],
          message: 'actionConfig.columnId must be a valid UUID for move_to_column action',
        });
      }
    }
  });

export type CreateAutomationRuleInput = z.infer<typeof CreateAutomationRuleSchema>;
