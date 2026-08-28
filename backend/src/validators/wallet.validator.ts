import { z } from 'zod';

const addressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const nonceSchema = z.object({
  body: z.object({
    walletAddress: addressSchema,
  }),
});

export const verifySchema = z.object({
  body: z.object({
    walletAddress: addressSchema,
    signature: z.string().min(1, 'Signature is required'),
  }),
});

export type NonceInput = z.infer<typeof nonceSchema>['body'];
export type VerifyInput = z.infer<typeof verifySchema>['body'];
