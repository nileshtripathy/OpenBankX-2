import { Landmark } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BankAccountCard } from '@/components/bank/BankAccountCard';
import { LinkBankDialog } from '@/components/bank/LinkBankDialog';
import { useBankAccounts, useBalanceSummary } from '@/hooks/useBank';

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function BankPage() {
  const { data: accounts, isLoading } = useBankAccounts();
  const { data: summary } = useBalanceSummary();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Bank accounts</h1>
          <p className="text-sm text-muted">Link, view, and refresh your connected accounts.</p>
        </div>
        <LinkBankDialog />
      </div>

      {/* Per-currency totals across active accounts - computed server-side via a Mongo aggregation pipeline (see bank.service.ts getBalanceSummary). */}
      {summary && summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.map((s) => (
            <Badge key={s.currency} variant="fiat" className="gap-1.5 py-1.5 text-sm">
              {formatMoney(s.totalCurrentBalance, s.currency)}
              <span className="text-muted">
                · {s.accountCount} account{s.accountCount === 1 ? '' : 's'}
              </span>
            </Badge>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!isLoading && accounts?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Landmark className="h-8 w-8 text-muted" />
          <p className="font-medium">No bank accounts linked</p>
          <p className="max-w-xs text-sm text-muted">
            Connect a bank account to see balances alongside your crypto wallet.
          </p>
        </div>
      )}

      {accounts && accounts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <BankAccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
