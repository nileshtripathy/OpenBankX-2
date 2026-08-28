import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionHistoryTable } from '@/components/blockchain/TransactionHistoryTable';

const filters = [
  { value: 'all', label: 'All' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'withdraw', label: 'Withdrawals' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'swap', label: 'Swaps' },
];

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
