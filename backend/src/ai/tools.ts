import { ethers } from 'ethers';
import { BankService } from '../services/bank.service';
import { BlockchainService } from '../services/blockchain.service';
import { User } from '../models/User';

/**
 * Tools the assistant can call mid-conversation (function calling / tool
 * use). Every tool is scoped to `userId` internally - the model never
 * supplies whose data to fetch, only which data - so there's no way for a
 * crafted prompt to make the assistant read another user's accounts.
 *
 * Each tool wraps an existing service function rather than querying the DB
 * directly, so the assistant is always reading through the same caching,
 * validation, and business logic as the REST API - one source of truth.
 */

export const toolDefinitions = [
  {
    name: 'get_bank_accounts',
    description:
      "Lists the user's linked bank accounts, with balances and currency. Use this for questions about fiat/bank balances.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_balance_summary',
    description:
      "Total balance across all of the user's linked bank accounts, grouped by currency. Use this for 'total balance' or 'how much money do I have' style questions.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_vault_balance',
    description:
      "The user's balance held inside the OpenBankX crypto vault for a given token. Use this for questions about crypto/vault balances. Requires the user to have a linked wallet.",
    input_schema: {
      type: 'object' as const,
      properties: {
        token: {
          type: 'string',
          description:
            "Token contract address, or the literal string 'ETH' for the native token.",
        },
      },
      required: ['token'],
    },
  },
  {
    name: 'get_recent_transactions',
    description:
      "The user's most recent on-chain transactions (deposits, withdrawals, transfers, swaps). Requires a linked wallet.",
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max transactions to return, default 5, max 20.' },
        eventType: {
          type: 'string',
          enum: ['deposit', 'withdraw', 'transfer', 'swap'],
          description: 'Optional filter to a single event type.',
        },
      },
      required: [],
    },
  },
] as const;

export type ToolName = (typeof toolDefinitions)[number]['name'];

interface ToolContext {
  userId: string;
}

/** Runs one tool call and returns a JSON-serializable result (or a plain-English error the model can relay to the user). */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name as ToolName) {
    case 'get_bank_accounts':
      return BankService.listAccounts(ctx.userId);

    case 'get_balance_summary':
      return BankService.getBalanceSummary(ctx.userId);

    case 'get_vault_balance': {
      const user = await User.findById(ctx.userId);
      if (!user?.walletAddress) {
        return { error: 'The user has not linked a wallet yet, so there is no vault balance to check.' };
      }
      const tokenInput = String(input.token || '');
      const token = tokenInput.toUpperCase() === 'ETH' ? ethers.ZeroAddress : tokenInput;
      if (!ethers.isAddress(token)) {
        return { error: `"${tokenInput}" is not a valid token address or "ETH".` };
      }
      const balance = await BlockchainService.getVaultBalance(user.walletAddress, token);
      return { token: tokenInput, balanceWei: balance };
    }

    case 'get_recent_transactions': {
      const user = await User.findById(ctx.userId);
      if (!user?.walletAddress) {
        return { error: 'The user has not linked a wallet yet, so there are no on-chain transactions to show.' };
      }
      const limit = Math.min(Number(input.limit) || 5, 20);
      const eventType = input.eventType as string | undefined;
      const result = await BlockchainService.listTransactions(user.walletAddress, {
        page: 1,
        limit,
        eventType,
      });
      return result.items;
    }

    default:
      return { error: `Unknown tool "${name}".` };
  }
}
