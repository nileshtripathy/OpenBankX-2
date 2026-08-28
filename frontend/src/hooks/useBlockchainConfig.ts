import { useQuery } from '@tanstack/react-query';
import type { InterfaceAbi } from 'ethers';
import { api } from '@/lib/api';
import type { ApiEnvelope } from '@/types';

export interface BlockchainConfig {
  rpcUrl: string;
  chainId: number;
  vaultAddress: string;
  swapAddress: string;
  mockTokenAddress: string;
  abis: {
    vault: InterfaceAbi;
    swap: InterfaceAbi;
    erc20: InterfaceAbi;
  };
}

/** Contract addresses/ABIs come from the backend, not hardcoded in the frontend build -
 *  so redeploying contracts only requires updating backend .env, not rebuilding the app. */
export function useBlockchainConfig() {
  return useQuery({
    queryKey: ['blockchain-config'],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<BlockchainConfig>>('/blockchain/config');
      return res.data.data;
    },
    staleTime: Infinity, // contract addresses don't change during a session
  });
}
