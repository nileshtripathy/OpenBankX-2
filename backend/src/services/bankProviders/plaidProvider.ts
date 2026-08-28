import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import {
  BankProvider,
  ProviderBalance,
  ProviderExchangeResult,
  ProviderLinkToken,
} from './BankProvider.interface';

export class PlaidProvider implements BankProvider {
  readonly name = 'plaid' as const;
  private client: PlaidApi;

  constructor() {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[env.plaid.env] ?? PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': env.plaid.clientId,
          'PLAID-SECRET': env.plaid.secret,
        },
      },
    });
    this.client = new PlaidApi(configuration);
  }

  async createLinkToken(userId: string): Promise<ProviderLinkToken> {
    const response = await this.client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'OpenBankX',
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return { linkToken: response.data.link_token };
  }

  async exchangePublicToken(publicToken: string): Promise<ProviderExchangeResult> {
    let exchangeRes;
    try {
      exchangeRes = await this.client.itemPublicTokenExchange({
        public_token: publicToken,
      });
    } catch {
      throw ApiError.badRequest('Failed to exchange Plaid public token');
    }

    const accessToken = exchangeRes.data.access_token;
    const itemId = exchangeRes.data.item_id;

    const accountsRes = await this.client.accountsGet({ access_token: accessToken });
    const institutionName =
      accountsRes.data.item.institution_id ?? 'Connected Bank';

    return {
      itemId,
      accessToken,
      institutionName,
      accounts: accountsRes.data.accounts.map((a) => ({
        providerAccountId: a.account_id,
        name: a.name,
        officialName: a.official_name ?? undefined,
        type: a.subtype ?? a.type,
        mask: a.mask ?? '0000',
      })),
    };
  }

  async getBalances(
    accessToken: string,
    accountIds: string[]
  ): Promise<ProviderBalance[]> {
    const response = await this.client.accountsBalanceGet({
      access_token: accessToken,
    });
    return response.data.accounts
      .filter((a) => accountIds.includes(a.account_id))
      .map((a) => ({
        providerAccountId: a.account_id,
        currentBalance: a.balances.current ?? 0,
        availableBalance: a.balances.available ?? a.balances.current ?? 0,
        currency: a.balances.iso_currency_code ?? 'USD',
      }));
  }

  async revokeAccess(accessToken: string): Promise<void> {
    await this.client.itemRemove({ access_token: accessToken });
  }
}
