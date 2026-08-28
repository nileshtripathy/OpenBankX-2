import crypto from 'crypto';
import { ApiError } from '../../utils/ApiError';
import {
  BankProvider,
  ProviderBalance,
  ProviderExchangeResult,
  ProviderLinkToken,
} from './BankProvider.interface';

const FAKE_INSTITUTIONS = [
  {
    institutionId: 'ins_mock_chase',
    institutionName: 'Chase (Mock)',
    accounts: [
      { providerAccountId: 'acc_checking_001', name: 'Total Checking', officialName: 'Chase Total Checking', type: 'checking', mask: '4821' },
      { providerAccountId: 'acc_savings_001', name: 'Savings', officialName: 'Chase Premier Savings', type: 'savings', mask: '9013' },
    ],
  },
  {
    institutionId: 'ins_mock_boa',
    institutionName: 'Bank of America (Mock)',
    accounts: [
      { providerAccountId: 'acc_checking_002', name: 'Advantage Checking', type: 'checking', mask: '2277' },
    ],
  },
  {
    institutionId: 'ins_mock_wells',
    institutionName: 'Wells Fargo (Mock)',
    accounts: [
      { providerAccountId: 'acc_checking_003', name: 'Everyday Checking', type: 'checking', mask: '6650' },
      { providerAccountId: 'acc_credit_003', name: 'Active Cash Card', type: 'credit', mask: '1188' },
    ],
  },
];

/** Deterministic pseudo-random balance so refreshes look "live" without a real backend. */
function deterministicBalance(seed: string): number {
  const hash = crypto
    .createHash('sha256')
    .update(seed + Date.now().toString().slice(0, -4))
    .digest('hex');
  const int = parseInt(hash.slice(0, 8), 16);
  return Math.round(((int % 500000) / 100) * 100) / 100; // up to $5,000.00
}

export class MockBankProvider implements BankProvider {
  readonly name = 'mock' as const;

  async createLinkToken(userId: string): Promise<ProviderLinkToken> {
    const linkToken = `mock-link-${userId}-${crypto.randomBytes(6).toString('hex')}`;
    return { linkToken, mockInstitutions: FAKE_INSTITUTIONS };
  }

  async exchangePublicToken(publicToken: string): Promise<ProviderExchangeResult> {
    // publicToken format expected from frontend mock picker: "mock-public:<institutionId>"
    const [prefix, institutionId] = publicToken.split(':');
    if (prefix !== 'mock-public' || !institutionId) {
      throw ApiError.badRequest('Invalid mock public token');
    }

    const institution = FAKE_INSTITUTIONS.find(
      (i) => i.institutionId === institutionId
    );
    if (!institution) {
      throw ApiError.badRequest('Unknown mock institution');
    }

    return {
      itemId: `mock-item-${crypto.randomBytes(8).toString('hex')}`,
      accessToken: `mock-access-${crypto.randomBytes(16).toString('hex')}`,
      institutionName: institution.institutionName,
      accounts: institution.accounts,
    };
  }

  async getBalances(
    _accessToken: string,
    accountIds: string[]
  ): Promise<ProviderBalance[]> {
    return accountIds.map((id) => {
      const current = deterministicBalance(id);
      return {
        providerAccountId: id,
        currentBalance: current,
        availableBalance: Math.max(0, current - 50), // simulate a small hold
        currency: 'USD',
      };
    });
  }

  async revokeAccess(_accessToken: string): Promise<void> {
    // No-op: nothing to revoke against a mock provider.
  }
}
