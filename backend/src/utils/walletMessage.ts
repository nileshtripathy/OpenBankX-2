import { env } from '../config/env';

export function buildSignMessage(
  walletAddress: string,
  nonce: string,
  issuedAt: string
): string {
  return [
    env.wallet.signMessage,
    '',
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
  ].join('\n');
}
