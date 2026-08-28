import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import type { BankAccount, BlockchainTransaction } from '@/types';

/**
 * Opens a socket.io connection once the user is authenticated and wires
 * server-pushed events straight into the react-query cache, so the UI
 * updates the moment something changes on the backend instead of waiting
 * on the next poll interval:
 *
 *   - `bank:balances-updated` - fired after a manual refresh or the
 *     scheduled cron job re-pulls balances from the bank provider.
 *   - `blockchain:tx`         - fired the instant a new on-chain event for
 *     this wallet is indexed (mirrors the SSE stream, but over a single
 *     shared connection other features can reuse too).
 */
export function useRealtimeSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      return;
    }

    const socket = getSocket(accessToken);

    const onBalancesUpdated = (accounts: BankAccount[]) => {
      queryClient.setQueryData(['bank-accounts'], accounts);
      toast.success('Bank balances updated');
    };

    const onBlockchainTx = (tx: BlockchainTransaction) => {
      queryClient.invalidateQueries({ queryKey: ['blockchain-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['vault-balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      toast.info(`New ${tx.eventType} detected on-chain`);
    };

    const onConnectError = (err: Error) => {
      console.warn('[socket] connection error:', err.message);
    };

    socket.on('bank:balances-updated', onBalancesUpdated);
    socket.on('blockchain:tx', onBlockchainTx);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('bank:balances-updated', onBalancesUpdated);
      socket.off('blockchain:tx', onBlockchainTx);
      socket.off('connect_error', onConnectError);
    };
  }, [accessToken, queryClient]);
}
