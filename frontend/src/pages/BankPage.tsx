import { Landmark } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BankAccountCard } from '@/components/bank/BankAccountCard';
import { LinkBankDialog } from '@/components/bank/LinkBankDialog';
import { useBankAccounts } from '@/hooks/useBank';

export default function BankPage() {
  const { data: accounts, isLoading } = useBankAccounts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Bank accounts</h1>
          <p className="text-sm text-muted">Link, view, and refresh your connected accounts.</p>
        </div>
        <LinkBankDialog />
      </div>

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
