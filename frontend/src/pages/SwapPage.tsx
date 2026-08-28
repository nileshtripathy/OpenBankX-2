import { useState, useMemo } from 'react';
import { parseEther, formatEther, ZeroAddress } from 'ethers';
import { toast } from 'sonner';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useBlockchainConfig } from '@/hooks/useBlockchainConfig';
import { useSwapQuote, useExecuteSwap } from '@/hooks/useSwap';
import { getErrorMessage } from '@/lib/api';

const SLIPPAGE_BPS = 50n; // 0.5%

export default function SwapPage() {
  const { data: config } = useBlockchainConfig();
  const [direction, setDirection] = useState<'ethToToken' | 'tokenToEth'>('ethToToken');
  const [amountIn, setAmountIn] = useState('');

  const tokenIn = direction === 'ethToToken' ? ZeroAddress : (config?.mockTokenAddress ?? '');
  const tokenOut = direction === 'ethToToken' ? (config?.mockTokenAddress ?? '') : ZeroAddress;

  const amountInWei = useMemo(() => {
    if (!amountIn || Number(amountIn) <= 0) return null;
    try {
      return parseEther(amountIn).toString();
    } catch {
      return null;
    }
  }, [amountIn]);

  const quote = useSwapQuote(tokenIn, tokenOut, amountInWei);
  const executeSwap = useExecuteSwap();

  const minAmountOut = quote.data
    ? ((BigInt(quote.data) * (10000n - SLIPPAGE_BPS)) / 10000n).toString()
    : '0';

  const handleSwap = () => {
    if (!amountIn || !quote.data) return;
    executeSwap.mutate(
      {
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        tokenInIsEth: direction === 'ethToToken',
        tokenInDecimals: 18,
      },
      {
        onSuccess: (hash) => {
          toast.success('Swap confirmed', { description: `Tx ${hash.slice(0, 10)}...${hash.slice(-6)}` });
          setAmountIn('');
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Swap &amp; Exchange</h1>
        <p className="text-sm text-muted">Trade ETH and OBXT through the on-chain liquidity pool.</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">
            {direction === 'ethToToken' ? 'ETH -> OBXT' : 'OBXT -> ETH'}
          </CardTitle>
          <CardDescription>0.3% pool fee, 0.5% slippage tolerance</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount-in">You pay</Label>
            <Input
              id="amount-in"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            />
          </div>

          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setDirection((d) => (d === 'ethToToken' ? 'tokenToEth' : 'ethToToken'));
                setAmountIn('');
              }}
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>You receive (estimated)</Label>
            <div className="rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm">
              {quote.isFetching
                ? 'Fetching quote...'
                : quote.data
                  ? Number(formatEther(quote.data)).toFixed(4) + ' ' + (direction === 'ethToToken' ? 'OBXT' : 'ETH')
                  : '—'}
            </div>
          </div>

          <Button
            onClick={handleSwap}
            disabled={!amountIn || !quote.data || executeSwap.isPending}
            variant="crypto"
          >
            {executeSwap.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Swap
          </Button>

          <p className="text-xs text-muted">
            Minimum received after slippage: {Number(formatEther(minAmountOut)).toFixed(4)}{' '}
            {direction === 'ethToToken' ? 'OBXT' : 'ETH'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
