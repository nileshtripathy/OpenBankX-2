import { env } from '../../config/env';
import { BankProvider } from './BankProvider.interface';
import { MockBankProvider } from './mockProvider';
import { PlaidProvider } from './plaidProvider';

let instance: BankProvider | null = null;

/** Returns the active bank provider - Plaid if credentials are configured, mock otherwise. */
export function getBankProvider(): BankProvider {
  if (instance) return instance;

  instance =
    env.plaid.clientId && env.plaid.secret
      ? new PlaidProvider()
      : new MockBankProvider();

  console.log(`[bank] using "${instance.name}" provider`);
  return instance;
}
