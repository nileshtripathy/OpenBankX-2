import { z } from 'zod';

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const setUserActiveSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});
