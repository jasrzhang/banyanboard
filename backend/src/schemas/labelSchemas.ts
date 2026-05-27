import { z } from 'zod';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const CreateLabelSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  color: z.string().regex(HEX_COLOR, 'Color must be a 6-digit hex code'),
  icon: z.string().max(10).nullable().optional(),
});
export type CreateLabelInput = z.infer<typeof CreateLabelSchema>;

export const UpdateLabelSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    color: z.string().regex(HEX_COLOR).optional(),
    icon: z.string().max(10).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });
export type UpdateLabelInput = z.infer<typeof UpdateLabelSchema>;

export const ReplaceCardLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid()).min(0).max(50), // min(0) explicit: empty array clears all labels
});
export type ReplaceCardLabelsInput = z.infer<typeof ReplaceCardLabelsSchema>;
