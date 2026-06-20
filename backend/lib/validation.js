import { z } from 'zod';
import { AppError } from './errors.js';

export const idSchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/, 'Invalid identifier.');
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.');

export const noteBodySchema = z.object({
  text: z.string().trim().min(1, 'A note cannot be empty.').max(4000, 'A note must be 4,000 characters or less.'),
  date: dateSchema.optional(),
});

export const partnerMatchSchema = z.object({
  clientId: idSchema,
  category: z.string().trim().min(1).max(80),
});

export const clientIdSchema = z.object({ clientId: idSchema });

export const noteOrganiseSchema = z.object({
  clientId: idSchema,
  rawNotes: z.string().trim().min(1, 'Meeting notes cannot be empty.').max(6000, 'Meeting notes must be 6,000 characters or less.'),
});

export const askLearningSchema = z.object({
  question: z.string().trim().min(3, 'Enter a longer question.').max(1200, 'Question must be 1,200 characters or less.'),
});

export function parseOrThrow(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Please check the submitted information.', result.error.flatten());
  }
  return result.data;
}
