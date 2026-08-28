import { RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import { useRefreshBankAccount, useUnlinkBankAccount } from '@/hooks/useBank';
import type { BankAccount } from '@/types';

export function BankAccountCard({ account }: { account: BankAccount }) {
  const refresh = useRefreshBankAccount();
  const unlink = useUnlinkBankAccount();

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <p className="text-sm text-muted">{account.institutionName}</p>
          <p className="font-medium">
            {account.accountName} <span className="font-mono text-muted">•••• {account.mask}</span>
          </p>
        </div>
        <Badge variant="fiat" className="capitalize">
          {account.accountType}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tabular-nums">
          <AnimatedNumber value={account.currentBalance} prefix="$" />
        </p>
        <div className="rail-divider mt-2 mb-3 max-w-[8rem]" />
        <p className="text-xs text-muted">
          Available: ${account.availableBalance.toFixed(2)} · Synced{' '}
          {new Date(account.lastSyncedAt).toLocaleTimeString()}
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate(account.id)}
          >
            {refresh.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate(account.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Unlink
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
