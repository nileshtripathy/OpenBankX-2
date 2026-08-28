import { Landmark, Wallet as WalletIcon } from 'lucide-react';
import { formatEther } from 'ethers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import { DepositWithdrawDialog } from '@/components/blockchain/DepositWithdrawDialog';
import { TransferDialog } from '@/components/blockchain/TransferDialog';
import { useBankAccounts } from '@/hooks/useBank';
import { useVaultBalance, ZeroAddress } from '@/hooks/useVault';
import { useAuthStore } from '@/store/auth.store';

export default function DashboardPage() {
  const { data: accounts, isLoading: bankLoading } = useBankAccounts();
  const vaultEth = useVaultBalance(ZeroAddress);
  const user = useAuthStore((s) => s.user);

  const totalFiat = accounts?.reduce((sum, a) => sum + a.currentBalance, 0) ?? 0;
  const vaultEthValue = vaultEth.data ? Number(formatEther(vaultEth.data)) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-muted">Here&apos;s your combined ledger across every rail.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted">Fiat balance (bank accounts)</p>
          {bankLoading ? (
            <Skeleton className="mt-2 h-10 w-48" />
          ) : (
            <p className="font-mono text-4xl font-semibold tabular-nums">
              <AnimatedNumber value={totalFiat} prefix="$" />
            </p>
          )}
          <div className="rail-divider mt-3 max-w-xs" />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Landmark className="h-4 w-4 text-fiat" />
            <CardTitle className="text-base">Fiat rail</CardTitle>
            <Badge variant="fiat" className="ml-auto">
              {accounts?.length ?? 0} linked
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {bankLoading && <Skeleton className="h-14 w-full" />}
            {!bankLoading && accounts?.length === 0 && (
              <p className="text-sm text-muted">
                No bank accounts linked yet. Head to Bank Accounts to connect one.
              </p>
            )}
            {accounts?.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-muted">
                  {a.institutionName} •••• {a.mask}
                </span>
                <span className="font-mono tabular-nums">${a.currentBalance.toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <WalletIcon className="h-4 w-4 text-crypto" />
            <CardTitle className="text-base">Crypto rail</CardTitle>
            <Badge variant="crypto" className="ml-auto">
              {user?.walletAddress ? 'Connected' : 'Not connected'}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {user?.walletAddress ? (
              <>
                <div>
                  <p className="text-xs text-muted">Vault balance</p>
                  <p className="font-mono text-2xl font-semibold tabular-nums">
                    {vaultEth.isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <AnimatedNumber value={vaultEthValue} decimals={4} />
                    )}{' '}
                    <span className="text-base text-muted">ETH</span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DepositWithdrawDialog />
                  <TransferDialog />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">
                Connect a wallet from the login page to see on-chain balances and use deposits,
                withdrawals, transfers, and swaps.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
