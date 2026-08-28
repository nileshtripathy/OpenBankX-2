import { useState } from 'react';
import { formatEther, formatUnits } from 'ethers';
import { toast } from 'sonner';
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDepositETH,
  useWithdrawETH,
  useDepositToken,
  useWithdrawToken,
  useVaultBalance,
  useWalletTokenBalance,
  ZeroAddress,
} from '@/hooks/useVault';
import { useBlockchainConfig } from '@/hooks/useBlockchainConfig';
import { getErrorMessage } from '@/lib/api';

function AssetForm({
  direction,
  asset,
}: {
  direction: 'deposit' | 'withdraw';
  asset: 'eth' | 'token';
}) {
  const [amount, setAmount] = useState('');
  const { data: config } = useBlockchainConfig();
  const tokenAddress = config?.mockTokenAddress ?? '';

  const depositEth = useDepositETH();
  const withdrawEth = useWithdrawETH();
  const depositToken = useDepositToken();
  const withdrawToken = useWithdrawToken();

  const vaultBalance = useVaultBalance(asset === 'eth' ? ZeroAddress : tokenAddress);
  const walletBalance = useWalletTokenBalance(asset === 'eth' ? ZeroAddress : tokenAddress);

  const mutation =
    asset === 'eth'
      ? direction === 'deposit'
        ? depositEth
        : withdrawEth
      : direction === 'deposit'
        ? depositToken
        : withdrawToken;

  const formatBalance = (wei?: string) =>
    wei ? Number(asset === 'eth' ? formatEther(wei) : formatUnits(wei, 18)).toFixed(4) : '—';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    mutation.mutate(amount, {
      onSuccess: (hash) => {
        toast.success(`${direction === 'deposit' ? 'Deposit' : 'Withdrawal'} confirmed`, {
          description: `Tx ${hash.slice(0, 10)}...${hash.slice(-6)}`,
        });
        setAmount('');
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
      <div className="flex justify-between text-xs text-muted">
        <span>Vault balance: {formatBalance(vaultBalance.data)} {asset === 'eth' ? 'ETH' : 'OBXT'}</span>
        <span>Wallet balance: {formatBalance(walletBalance.data)} {asset === 'eth' ? 'ETH' : 'OBXT'}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${direction}-${asset}-amount`}>Amount</Label>
        <Input
          id={`${direction}-${asset}-amount`}
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={mutation.isPending} variant={asset === 'eth' ? 'crypto' : 'default'}>
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {direction === 'deposit' ? 'Deposit' : 'Withdraw'}
      </Button>
    </form>
  );
}

export function DepositWithdrawDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="crypto">
          <ArrowDownToLine className="h-4 w-4" />
          Deposit / Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vault deposit &amp; withdraw</DialogTitle>
          <DialogDescription>
            Funds move directly between your wallet and the OpenBankX vault contract - you sign every transaction in MetaMask.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="deposit-eth">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="deposit-eth">Deposit ETH</TabsTrigger>
            <TabsTrigger value="withdraw-eth">Withdraw ETH</TabsTrigger>
            <TabsTrigger value="deposit-token">Deposit OBXT</TabsTrigger>
            <TabsTrigger value="withdraw-token">Withdraw OBXT</TabsTrigger>
          </TabsList>
          <TabsContent value="deposit-eth">
            <AssetForm direction="deposit" asset="eth" />
          </TabsContent>
          <TabsContent value="withdraw-eth">
            <AssetForm direction="withdraw" asset="eth" />
          </TabsContent>
          <TabsContent value="deposit-token">
            <AssetForm direction="deposit" asset="token" />
          </TabsContent>
          <TabsContent value="withdraw-token">
            <AssetForm direction="withdraw" asset="token" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
