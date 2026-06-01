import { z } from 'zod';

export const LoginSchema = z.object({
  firstName: z
    .string()
    .min(2, 'Name must be 2–30 letters and spaces only')
    .max(30, 'Name must be 2–30 letters and spaces only')
    .regex(/^[A-Za-z ]+$/, 'Name must be 2–30 letters and spaces only')
    .refine(
      (s) => s.trim().length >= 2,
      'Name must contain at least 2 non-space characters',
    ),
});

export type LoginInput = z.infer<typeof LoginSchema>;
