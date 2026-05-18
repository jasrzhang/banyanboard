import { z } from 'zod';

// Placeholder for future POST /api/boards
export const CreateBoardSchema = z.object({
  name: z.string().min(1).max(500),
});
export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;
