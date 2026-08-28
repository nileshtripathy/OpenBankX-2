import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseEther, parseUnits, ZeroAddress } from 'ethers';
import { api } from '@/lib/api';
import { getSigner, getVaultContract, getErc20Contract, generateRefId } from '@/lib/contracts';
import { useBlockchainConfig } from './useBlockchainConfig';
import type { ApiEnvelope } from '@/types';

export function useVaultBalance(token: string) {
  const { data: config } = useBlockchainConfig();
  return useQuery({
    queryKey: ['vault-balance', token],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<{ balance: string }>>('/blockchain/balance/vault', {
        params: { token },
      });
      return res.data.data.balance;
    },
    enabled: !!config,
    refetchInterval: 15_000, // near-real-time; SSE tx stream triggers immediate refetches too
  });
}

export function useWalletTokenBalance(token: string) {
  return useQuery({
    queryKey: ['wallet-balance', token],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<{ balance: string }>>('/blockchain/balance/wallet', {
        params: { token },
      });
      return res.data.data.balance;
    },
    refetchInterval: 15_000,
  });
}

function invalidateAfterTx(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['vault-balance'] });
  queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
  queryClient.invalidateQueries({ queryKey: ['blockchain-transactions'] });
}

export function useDepositETH() {
  const { data: config } = useBlockchainConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amountEth: string) => {
      if (!config) throw new Error('Blockchain config not loaded yet');
      const signer = await getSigner();
      const vault = getVaultContract(config, signer);
      const tx = await vault.depositETH(generateRefId(), { value: parseEther(amountEth) });
      const receipt = await tx.wait();
      return receipt.hash as string;
    },
    onSuccess: () => invalidateAfterTx(queryClient),
  });
}

export function useWithdrawETH() {
  const { data: config } = useBlockchainConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amountEth: string) => {
      if (!config) throw new Error('Blockchain config not loaded yet');
      const signer = await getSigner();
      const vault = getVaultContract(config, signer);
      const tx = await vault.withdrawETH(parseEther(amountEth), generateRefId());
      const receipt = await tx.wait();
      return receipt.hash as string;
    },
    onSuccess: () => invalidateAfterTx(queryClient),
  });
}

/** Deposits the mock ERC-20 test token - approves the vault, then deposits, in sequence. */
export function useDepositToken() {
  const { data: config } = useBlockchainConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount: string) => {
      if (!config) throw new Error('Blockchain config not loaded yet');
      const signer = await getSigner();
      const token = getErc20Contract(config.mockTokenAddress, config, signer);
      const vault = getVaultContract(config, signer);
      const value = parseUnits(amount, 18);

      const approveTx = await token.approve(config.vaultAddress, value);
      await approveTx.wait();

      const depositTx = await vault.depositToken(config.mockTokenAddress, value, generateRefId());
      const receipt = await depositTx.wait();
      return receipt.hash as string;
    },
    onSuccess: () => invalidateAfterTx(queryClient),
  });
}

export function useWithdrawToken() {
  const { data: config } = useBlockchainConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount: string) => {
      if (!config) throw new Error('Blockchain config not loaded yet');
      const signer = await getSigner();
      const vault = getVaultContract(config, signer);
      const tx = await vault.withdrawToken(config.mockTokenAddress, parseUnits(amount, 18), generateRefId());
      const receipt = await tx.wait();
      return receipt.hash as string;
    },
    onSuccess: () => invalidateAfterTx(queryClient),
  });
}

/** Instant internal ledger transfer to another user's wallet address (no on-chain token movement). */
export function useInternalTransfer() {
  const { data: config } = useBlockchainConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { to: string; token: string; amount: string; isEth: boolean }) => {
      if (!config) throw new Error('Blockchain config not loaded yet');
      const signer = await getSigner();
      const vault = getVaultContract(config, signer);
      const value = input.isEth ? parseEther(input.amount) : parseUnits(input.amount, 18);
      const tx = await vault.transfer(input.to, input.token, value, generateRefId());
      const receipt = await tx.wait();
      return receipt.hash as string;
    },
    onSuccess: () => invalidateAfterTx(queryClient),
  });
}

export { ZeroAddress };
