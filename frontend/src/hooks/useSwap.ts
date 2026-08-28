import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseEther, parseUnits } from 'ethers';
import { api } from '@/lib/api';
import { getSigner, getSwapContract, getErc20Contract, generateRefId } from '@/lib/contracts';
import { useBlockchainConfig } from './useBlockchainConfig';
import type { ApiEnvelope } from '@/types';

export function useSwapQuote(tokenIn: string, tokenOut: string, amountInWei: string | null) {
  return useQuery({
    queryKey: ['swap-quote', tokenIn, tokenOut, amountInWei],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<{ amountOut: string }>>('/blockchain/quote', {
        params: { tokenIn, tokenOut, amountIn: amountInWei },
      });
      return res.data.data.amountOut;
    },
    enabled: !!amountInWei && amountInWei !== '0',
    staleTime: 5_000,
  });
}

interface SwapInput {
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // human units, e.g. "1.5"
  minAmountOut: string; // wei units, already computed with slippage tolerance applied
  tokenInIsEth: boolean;
  tokenInDecimals: number;
}

export function useExecuteSwap() {
  const { data: config } = useBlockchainConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SwapInput) => {
      if (!config) throw new Error('Blockchain config not loaded yet');
      const signer = await getSigner();
      const swap = getSwapContract(config, signer);

      const amountInWei = input.tokenInIsEth
        ? parseEther(input.amountIn)
        : parseUnits(input.amountIn, input.tokenInDecimals);

      if (!input.tokenInIsEth) {
        const token = getErc20Contract(input.tokenIn, config, signer);
        const approveTx = await token.approve(config.swapAddress, amountInWei);
        await approveTx.wait();
      }

      const tx = await swap.swap(
        input.tokenIn,
        input.tokenOut,
        amountInWei,
        input.minAmountOut,
        generateRefId(),
        input.tokenInIsEth ? { value: amountInWei } : {}
      );
      const receipt = await tx.wait();
      return receipt.hash as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault-balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      queryClient.invalidateQueries({ queryKey: ['blockchain-transactions'] });
    },
  });
}
