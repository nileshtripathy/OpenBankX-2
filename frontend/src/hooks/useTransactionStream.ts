import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { ApiEnvelope, BlockchainTransaction, PaginatedTransactions } from '@/types';

export function useBlockchainTransactions(page = 1, eventType?: string) {
  return useQuery({
    queryKey: ['blockchain-transactions', page, eventType],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<PaginatedTransactions>>('/blockchain/transactions', {
        params: { page, limit: 20, eventType },
      });
      return res.data.data;
    },
  });
}

/**
 * Opens an SSE connection to the backend's live event stream and invalidates
 * the transaction/balance queries whenever a new on-chain event is indexed -
 * this is what makes the dashboard update without a manual refresh.
 */
export function useTransactionStream() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;

    const url = `${import.meta.env.VITE_API_URL}/blockchain/transactions/stream?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);

    source.onmessage = (event) => {
      if (event.data.startsWith(':')) return; // heartbeat/comment lines
      try {
        const tx = JSON.parse(event.data) as BlockchainTransaction;
        toast.success(`New ${tx.eventType} indexed on-chain`, {
          description: `${tx.txHash.slice(0, 10)}...${tx.txHash.slice(-6)}`,
        });
      } catch {
        // ignore malformed frames
      }
      queryClient.invalidateQueries({ queryKey: ['blockchain-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['vault-balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
    };

    source.onerror = () => {
      // EventSource auto-reconnects on its own; nothing to do here.
    };

    return () => source.close();
  }, [accessToken, queryClient]);
}
