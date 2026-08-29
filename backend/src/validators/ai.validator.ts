import { z } from 'zod';

export const chatSchema = z.object({
  body: z.object({
    message: z.string().trim().min(1, 'Message is required').max(2000, 'Message is too long'),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(4000),
        })
      )
      .max(20, 'Too much history - start a new conversation')
      .optional()
      .default([]),
  }),
});

export type ChatInput = z.infer<typeof chatSchema>['body'];
