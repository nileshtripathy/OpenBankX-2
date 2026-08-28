import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { ZeroAddress } from 'ethers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInternalTransfer } from '@/hooks/useVault';
import { useBlockchainConfig } from '@/hooks/useBlockchainConfig';
import { getErrorMessage } from '@/lib/api';

export function TransferDialog() {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<'eth' | 'token'>('eth');
  const { data: config } = useBlockchainConfig();
  const transfer = useInternalTransfer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!to || !amount || Number(amount) <= 0) return;

    transfer.mutate(
      {
        to,
        token: asset === 'eth' ? ZeroAddress : (config?.mockTokenAddress ?? ''),
        amount,
        isEth: asset === 'eth',
      },
      {
        onSuccess: (hash) => {
          toast.success('Transfer confirmed', {
            description: `Tx ${hash.slice(0, 10)}...${hash.slice(-6)}`,
          });
          setOpen(false);
          setTo('');
          setAmount('');
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Send className="h-4 w-4" />
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send within OpenBankX</DialogTitle>
          <DialogDescription>
            Instant, gas-efficient transfer between vault balances - no on-chain token movement.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={asset} onValueChange={(v) => setAsset(v as 'eth' | 'token')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="eth">ETH</TabsTrigger>
            <TabsTrigger value="token">OBXT</TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-to">Recipient wallet address</Label>
            <Input
              id="transfer-to"
              placeholder="0x..."
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-amount">Amount</Label>
            <Input
              id="transfer-amount"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={transfer.isPending}>
            {transfer.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
