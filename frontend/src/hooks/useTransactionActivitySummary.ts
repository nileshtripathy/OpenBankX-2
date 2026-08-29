import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiEnvelope, TransactionActivitySummaryEntry } from '@/types';

/** Monthly on-chain activity breakdown by event type - backed by a Mongo aggregation pipeline. */
export function useTransactionActivitySummary() {
  return useQuery({
    queryKey: ['blockchain-transactions-summary'],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<TransactionActivitySummaryEntry[]>>(
        '/blockchain/transactions/summary'
      );
      return res.data.data;
    },
  });
}
