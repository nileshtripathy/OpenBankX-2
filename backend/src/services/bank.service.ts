import { BankAccount, IBankAccount } from '../models/BankAccount';
import { ApiError } from '../utils/ApiError';
import { encrypt, decrypt } from '../utils/crypto';
import { getBankProvider } from './bankProviders';
import { cacheWrap, cacheDel } from '../utils/cache';
import { env } from '../config/env';
import { emitToUser } from '../realtime/socket';

const accountsCacheKey = (userId: string) => `bank:accounts:${userId}`;

function sanitize(account: IBankAccount) {
  return {
    id: account._id.toString(),
    provider: account.provider,
    institutionName: account.institutionName,
    accountName: account.accountName,
    officialName: account.officialName ?? null,
    accountType: account.accountType,
    mask: account.mask,
    currency: account.currency,
    currentBalance: account.currentBalance,
    availableBalance: account.availableBalance,
    status: account.status,
    lastSyncedAt: account.lastSyncedAt,
  };
}

export const BankService = {
  async createLinkToken(userId: string) {
    const provider = getBankProvider();
    const result = await provider.createLinkToken(userId);
    return {
      linkToken: result.linkToken,
      provider: provider.name,
      // Only present for the mock provider - the frontend uses this to render
      // a fake institution picker instead of the real Plaid Link widget.
      mockInstitutions: result.mockInstitutions ?? null,
    };
  },

  async exchangePublicToken(userId: string, publicToken: string) {
    const provider = getBankProvider();
    const result = await provider.exchangePublicToken(publicToken);

    const accessTokenEncrypted = encrypt(result.accessToken);

    const savedAccounts = await Promise.all(
      result.accounts.map((acc) =>
        BankAccount.findOneAndUpdate(
          { userId, providerAccountId: acc.providerAccountId },
          {
            userId,
            provider: provider.name,
            itemId: result.itemId,
            accessTokenEncrypted,
            providerAccountId: acc.providerAccountId,
            institutionName: result.institutionName,
            accountName: acc.name,
            officialName: acc.officialName,
            accountType: acc.type,
            mask: acc.mask,
            status: 'active',
            lastSyncedAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );

    // Immediately pull real balances rather than leaving them at 0 until next refresh.
    await BankService.refreshBalances(
      userId,
      savedAccounts.map((a) => a!._id.toString())
    );

    const refreshed = await BankAccount.find({
      _id: { $in: savedAccounts.map((a) => a!._id) },
    });

    await cacheDel(accountsCacheKey(userId));
    return refreshed.map(sanitize);
  },

  /** Cached per-user - the dashboard re-fetches this on every mount, and linked-account lists change infrequently. */
  async listAccounts(userId: string) {
    return cacheWrap(accountsCacheKey(userId), env.redis.ttl.bankAccounts, async () => {
      const accounts = await BankAccount.find({ userId }).sort({ createdAt: -1 });
      return accounts.map(sanitize);
    });
  },

  async refreshBalances(userId: string, accountIds?: string[]) {
    const query: Record<string, unknown> = { userId, status: 'active' };
    if (accountIds?.length) query._id = { $in: accountIds };

    const accounts = await BankAccount.find(query).select('+accessTokenEncrypted');
    if (accounts.length === 0) return [];

    // Group by item/access token so we make one provider call per linked item, not per account.
    const byToken = new Map<string, IBankAccount[]>();
    for (const acc of accounts) {
      const list = byToken.get(acc.accessTokenEncrypted) ?? [];
      list.push(acc);
      byToken.set(acc.accessTokenEncrypted, list);
    }

    const provider = getBankProvider();
    const updated: IBankAccount[] = [];

    for (const [encryptedToken, group] of byToken) {
      const accessToken = decrypt(encryptedToken);
      const balances = await provider.getBalances(
        accessToken,
        group.map((a) => a.providerAccountId)
      );

      for (const acc of group) {
        const bal = balances.find((b) => b.providerAccountId === acc.providerAccountId);
        if (!bal) continue;
        acc.currentBalance = bal.currentBalance;
        acc.availableBalance = bal.availableBalance;
        acc.currency = bal.currency;
        acc.lastSyncedAt = new Date();
        await acc.save();
        updated.push(acc);
      }
    }

    if (updated.length > 0) {
      await cacheDel(accountsCacheKey(userId));
      const sanitized = updated.map(sanitize);
      // Pushed over the socket.io channel so the dashboard updates instantly
      // instead of waiting for the next poll - used by both the manual
      // "refresh" button and the scheduled cron job (see jobs/scheduler.ts).
      emitToUser(userId, 'bank:balances-updated', sanitized);
      return sanitized;
    }

    return [];
  },

  async unlinkAccount(userId: string, accountId: string) {
    const account = await BankAccount.findOne({ _id: accountId, userId }).select(
      '+accessTokenEncrypted'
    );
    if (!account) throw ApiError.notFound('Bank account not found');

    const provider = getBankProvider();
    try {
      await provider.revokeAccess(decrypt(account.accessTokenEncrypted));
    } catch (err) {
      // Log but don't block local unlinking if the provider call fails -
      // the user still wants this account gone from their dashboard.
      console.error('[bank] provider revoke failed:', err);
    }

    account.status = 'revoked';
    await account.save();
    await BankAccount.deleteOne({ _id: account._id });

    await cacheDel(accountsCacheKey(userId));
    return { unlinked: true };
  },
};
