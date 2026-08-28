import { BrowserProvider, Contract, JsonRpcSigner } from 'ethers';
import type { BlockchainConfig } from '@/hooks/useBlockchainConfig';

export async function getSigner(): Promise<JsonRpcSigner> {
  if (!window.ethereum) {
    throw new Error('MetaMask not detected. Please install the MetaMask extension.');
  }
  const provider = new BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  return provider.getSigner();
}

export function getVaultContract(config: BlockchainConfig, signer: JsonRpcSigner): Contract {
  return new Contract(config.vaultAddress, config.abis.vault, signer);
}

export function getSwapContract(config: BlockchainConfig, signer: JsonRpcSigner): Contract {
  return new Contract(config.swapAddress, config.abis.swap, signer);
}

export function getErc20Contract(tokenAddress: string, config: BlockchainConfig, signer: JsonRpcSigner): Contract {
  return new Contract(tokenAddress, config.abis.erc20, signer);
}

/** Generates a fresh idempotency reference for a transaction, logged alongside the on-chain event. */
export function generateRefId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
