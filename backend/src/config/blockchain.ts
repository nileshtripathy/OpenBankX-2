import { ethers } from 'ethers';
import { env } from './env';
import VaultAbi from '../blockchain/abi/OpenBankXVault.json';
import SwapAbi from '../blockchain/abi/OpenBankXSwap.json';
import Erc20Abi from '../blockchain/abi/MockERC20.json';

export const provider = new ethers.JsonRpcProvider(env.blockchain.rpcUrl);

/**
 * Read-only contract instances (no signer - the backend never sends
 * transactions or holds private keys; all writes are signed client-side
 * via MetaMask). Used for balance reads and event subscription/backfill.
 */
export function getVaultContract(): ethers.Contract {
  if (!env.blockchain.vaultAddress) {
    throw new Error('VAULT_CONTRACT_ADDRESS is not configured');
  }
  return new ethers.Contract(env.blockchain.vaultAddress, VaultAbi, provider);
}

export function getSwapContract(): ethers.Contract {
  if (!env.blockchain.swapAddress) {
    throw new Error('SWAP_CONTRACT_ADDRESS is not configured');
  }
  return new ethers.Contract(env.blockchain.swapAddress, SwapAbi, provider);
}

export function getErc20Contract(tokenAddress: string): ethers.Contract {
  return new ethers.Contract(tokenAddress, Erc20Abi, provider);
}

export { VaultAbi, SwapAbi, Erc20Abi };
