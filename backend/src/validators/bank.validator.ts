import { z } from 'zod';

export const exchangeSchema = z.object({
  body: z.object({
    publicToken: z.string().min(1, 'publicToken is required'),
  }),
});

export const accountIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Account id is required'),
  }),
});

export type ExchangeInput = z.infer<typeof exchangeSchema>['body'];
