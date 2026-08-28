import { z } from 'zod';

const addressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

const amountSchema = z
  .string()
  .trim()
  .regex(/^[0-9]+$/, 'Amount must be a positive integer string (wei units)');

export const balanceQuerySchema = z.object({
  query: z.object({
    token: addressSchema,
  }),
});

export const quoteQuerySchema = z.object({
  query: z.object({
    tokenIn: addressSchema,
    tokenOut: addressSchema,
    amountIn: amountSchema,
  }),
});

export const transactionsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    eventType: z.enum(['deposit', 'withdraw', 'transfer', 'swap']).optional(),
  }),
});
