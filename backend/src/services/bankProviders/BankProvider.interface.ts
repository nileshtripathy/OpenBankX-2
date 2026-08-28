export interface ProviderLinkAccount {
  providerAccountId: string;
  name: string;
  officialName?: string;
  type: string; // checking | savings | credit
  mask: string; // last 4 digits
}

export interface ProviderLinkToken {
  linkToken: string;
  // Mock provider embeds fake institutions/accounts directly so the frontend
  // can render a picker without needing Plaid Link's real widget.
  mockInstitutions?: {
    institutionId: string;
    institutionName: string;
    accounts: ProviderLinkAccount[];
  }[];
}

export interface ProviderExchangeResult {
  itemId: string;
  accessToken: string; // caller is responsible for encrypting before persisting
  institutionName: string;
  accounts: ProviderLinkAccount[];
}

export interface ProviderBalance {
  providerAccountId: string;
  currentBalance: number;
  availableBalance: number;
  currency: string;
}

export interface BankProvider {
  readonly name: 'plaid' | 'mock';

  createLinkToken(userId: string): Promise<ProviderLinkToken>;

  /**
   * publicToken: what the client got back from Link.
   * For the mock provider, this is a synthetic token encoding the chosen institution.
   */
  exchangePublicToken(publicToken: string): Promise<ProviderExchangeResult>;

  getBalances(
    accessToken: string,
    accountIds: string[]
  ): Promise<ProviderBalance[]>;

  revokeAccess(accessToken: string): Promise<void>;
}
