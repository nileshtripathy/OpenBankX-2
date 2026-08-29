import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionHistoryTable } from '@/components/blockchain/TransactionHistoryTable';
import { useTransactionActivitySummary } from '@/hooks/useTransactionActivitySummary';

const filters = [
  { value: 'all', label: 'All' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'withdraw', label: 'Withdrawals' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'swap', label: 'Swaps' },
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Compact "N deposits, M swaps in Aug 2026" strip built from the aggregation-pipeline summary endpoint. */
function ActivitySummaryStrip() {
  const { data: summary } = useTransactionActivitySummary();
  if (!summary || summary.length === 0) return null;

  // Group entries (already sorted newest-first by the aggregation pipeline) by year/month.
  const byMonth = new Map<string, typeof summary>();
  for (const entry of summary) {
    const key = `${entry.year}-${entry.month}`;
    byMonth.set(key, [...(byMonth.get(key) ?? []), entry]);
  }
  const recentMonths = Array.from(byMonth.entries()).slice(0, 3);

  return (
    <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface/50 px-4 py-3 text-sm text-muted">
      {recentMonths.map(([key, entries]) => {
        const [, month] = key.split('-').map(Number);
        const parts = entries.map((e) => `${e.count} ${e.eventType}${e.count === 1 ? '' : 's'}`);
        return (
          <span key={key}>
            <span className="font-medium text-foreground">{MONTH_NAMES[month - 1]}</span>: {parts.join(', ')}
          </span>
        );
      })}
    </div>
  );
}

export default function TransactionsPage() {
  const [filter, setFilter] = useState('all');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Transaction history</h1>
        <p className="text-sm text-muted">
          Indexed directly from on-chain events - updates in real time as blocks confirm.
        </p>
      </div>

      <ActivitySummaryStrip />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          {filters.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <TransactionHistoryTable eventType={filter === 'all' ? undefined : filter} />
    </div>
  );
}
