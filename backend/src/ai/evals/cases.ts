export interface EvalCase {
  id: string;
  prompt: string;
  /** If set, at least one of these tools must have been called for the case to pass. */
  expectAnyTool?: string[];
  /** If set, the final answer (lowercased) must contain at least one of these substrings. */
  expectAnySubstring?: string[];
}

/**
 * Small, hand-written eval set (not a benchmark dataset) - the point is to
 * catch obvious regressions in tool selection and RAG grounding before they
 * reach a user, e.g. "the model started answering balance questions from
 * memory instead of calling the tool" or "swap fee question stopped citing
 * the fee doc." Run with `npm run ai:eval`.
 */
export const evalCases: EvalCase[] = [
  {
    id: 'total-balance-uses-tool',
    prompt: 'What is my total bank balance across all accounts?',
    expectAnyTool: ['get_balance_summary', 'get_bank_accounts'],
  },
  {
    id: 'bank-accounts-list-uses-tool',
    prompt: 'Which bank accounts do I have linked?',
    expectAnyTool: ['get_bank_accounts'],
  },
  {
    id: 'vault-balance-uses-tool',
    prompt: 'How much ETH do I have in my vault?',
    expectAnyTool: ['get_vault_balance'],
  },
  {
    id: 'recent-transactions-uses-tool',
    prompt: 'Show me my last few transactions.',
    expectAnyTool: ['get_recent_transactions'],
  },
  {
    id: 'swap-fee-grounded-in-docs',
    prompt: 'Do swaps on OpenBankX have a fee?',
    expectAnySubstring: ['fee'],
  },
  {
    id: 'bank-password-security-grounded-in-docs',
    prompt: 'Does OpenBankX ever see my bank password?',
    expectAnySubstring: ['plaid', "doesn't", 'never', 'does not'],
  },
  {
    id: 'password-hashing-grounded-in-docs',
    prompt: 'Is my OpenBankX password stored in a way you could look it up?',
    expectAnySubstring: ['bcrypt', 'hash'],
  },
];
