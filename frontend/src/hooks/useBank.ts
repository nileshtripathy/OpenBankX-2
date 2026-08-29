import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiEnvelope, BankAccount, LinkTokenResponse, BalanceSummaryEntry } from '@/types';

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<BankAccount[]>>('/bank/accounts');
      return res.data.data;
    },
    // Live updates now arrive via socket.io (see useRealtimeSocket) the moment
    // a manual refresh or the scheduled cron job changes a balance; this poll
    // is just a slow fallback in case the socket connection is down.
    refetchInterval: 5 * 60_000,
  });
}

export function useCreateLinkToken() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiEnvelope<LinkTokenResponse>>('/bank/link-token');
      return res.data.data;
    },
  });
}

export function useExchangePublicToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publicToken: string) => {
      const res = await api.post<ApiEnvelope<BankAccount[]>>('/bank/exchange', {
        publicToken,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });
}

export function useRefreshBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await api.post<ApiEnvelope<BankAccount>>(
        `/bank/accounts/${accountId}/refresh`
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });
}

export function useUnlinkBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      await api.delete(`/bank/accounts/${accountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });
}

/** Per-currency totals across linked accounts - backed by a Mongo aggregation pipeline. */
export function useBalanceSummary() {
  return useQuery({
    queryKey: ['bank-balance-summary'],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<BalanceSummaryEntry[]>>('/bank/accounts/summary');
      return res.data.data;
    },
  });
}
