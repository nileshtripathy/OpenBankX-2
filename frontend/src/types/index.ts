export interface User {
  id: string;
  name: string;
  email: string | null;
  walletAddress: string | null;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface BankAccount {
  id: string;
  provider: 'plaid' | 'mock';
  institutionName: string;
  accountName: string;
  officialName: string | null;
  accountType: string;
  mask: string;
  currency: string;
  currentBalance: number;
  availableBalance: number;
  status: 'active' | 'revoked';
  lastSyncedAt: string;
}

export interface MockInstitution {
  institutionId: string;
  institutionName: string;
  accounts: {
    providerAccountId: string;
    name: string;
    type: string;
    mask: string;
  }[];
}

export interface LinkTokenResponse {
  linkToken: string;
  provider: 'plaid' | 'mock';
  mockInstitutions: MockInstitution[] | null;
}

export interface BlockchainTransaction {
  _id: string;
  txHash: string;
  logIndex: number;
  contractName: 'vault' | 'swap';
  eventType: 'deposit' | 'withdraw' | 'transfer' | 'swap';
  walletAddress: string;
  counterpartyAddress?: string;
  tokenInAddress?: string;
  tokenOutAddress?: string;
  amountIn?: string;
  amountOut?: string;
  blockNumber: number;
  blockTimestamp: string;
  status: 'confirmed';
  createdAt: string;
}

export interface PaginatedTransactions {
  items: BlockchainTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  details?: unknown;
}
