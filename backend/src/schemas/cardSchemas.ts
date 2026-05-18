import { z } from 'zod';

export const CreateCardSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(10_000).nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
});
export type CreateCardInput = z.infer<typeof CreateCardSchema>;

export const UpdateCardSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10_000).nullable().optional(),
    dueDate: z.string().datetime({ offset: true }).nullable().optional(),
    columnId: z.string().uuid().optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
