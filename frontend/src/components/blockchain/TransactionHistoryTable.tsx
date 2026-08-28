import { formatEther, formatUnits } from 'ethers';
import { ArrowDownToLine, ArrowUpFromLine, Send, ArrowLeftRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBlockchainTransactions } from '@/hooks/useTransactionStream';
import { useAuthStore } from '@/store/auth.store';
import type { BlockchainTransaction } from '@/types';

const eventMeta: Record<
  BlockchainTransaction['eventType'],
  { icon: typeof ArrowDownToLine; label: string; variant: 'fiat' | 'crypto' | 'default' | 'outline' }
> = {
  deposit: { icon: ArrowDownToLine, label: 'Deposit', variant: 'fiat' },
  withdraw: { icon: ArrowUpFromLine, label: 'Withdraw', variant: 'outline' },
  transfer: { icon: Send, label: 'Transfer', variant: 'default' },
  swap: { icon: ArrowLeftRight, label: 'Swap', variant: 'crypto' },
};

function formatAmount(wei?: string, isToken = false) {
  if (!wei) return '—';
  const value = isToken ? formatUnits(wei, 18) : formatEther(wei);
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function TransactionHistoryTable({ page = 1, eventType }: { page?: number; eventType?: string }) {
  const { data, isLoading } = useBlockchainTransactions(page, eventType);
  const myWallet = useAuthStore((s) => s.user?.walletAddress);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <ArrowLeftRight className="h-8 w-8 text-muted" />
        <p className="font-medium">No on-chain activity yet</p>
        <p className="max-w-xs text-sm text-muted">
          Deposit, withdraw, transfer, or swap to see your transaction history here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Counterparty</th>
            <th className="px-4 py-3">Tx hash</th>
            <th className="px-4 py-3">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.items.map((tx) => {
            const meta = eventMeta[tx.eventType];
            const Icon = meta.icon;
            const isOutgoing = tx.walletAddress === myWallet;
            const isToken = !!tx.tokenInAddress && tx.tokenInAddress !== '0x0000000000000000000000000000000000000000';

            return (
              <tr key={`${tx.txHash}-${tx.logIndex}`} className="hover:bg-surface-2/50">
                <td className="px-4 py-3">
                  <Badge variant={meta.variant} className="gap-1">
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">
                  {tx.eventType === 'swap'
                    ? `${formatAmount(tx.amountIn)} → ${formatAmount(tx.amountOut)}`
                    : `${isOutgoing ? '-' : '+'}${formatAmount(tx.amountIn, isToken)}`}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {tx.counterpartyAddress
                    ? `${tx.counterpartyAddress.slice(0, 6)}...${tx.counterpartyAddress.slice(-4)}`
                    : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {new Date(tx.blockTimestamp).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
