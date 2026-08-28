import { useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCreateLinkToken, useExchangePublicToken } from '@/hooks/useBank';
import { getErrorMessage } from '@/lib/api';
import type { MockInstitution } from '@/types';

export function LinkBankDialog() {
  const [open, setOpen] = useState(false);
  const [institutions, setInstitutions] = useState<MockInstitution[] | null>(null);
  const [provider, setProvider] = useState<'plaid' | 'mock' | null>(null);
  const createLinkToken = useCreateLinkToken();
  const exchange = useExchangePublicToken();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      createLinkToken.mutate(undefined, {
        onSuccess: (data) => {
          setProvider(data.provider);
          setInstitutions(data.mockInstitutions);

          // Plaid-ready hook: when a real Plaid link token comes back, this is
          // where you'd hand data.linkToken to Plaid's `usePlaidLink` widget
          // instead of rendering the mock picker below.
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      });
    }
  };

  const handleSelectInstitution = (institutionId: string) => {
    exchange.mutate(`mock-public:${institutionId}`, {
      onSuccess: () => {
        toast.success('Bank account linked');
        setOpen(false);
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Landmark className="h-4 w-4" />
          Link a bank account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a bank account</DialogTitle>
          <DialogDescription>
            {provider === 'plaid'
              ? 'Choose your bank to securely connect via Plaid.'
              : 'Sandbox mode — pick a sample institution to simulate linking.'}
          </DialogDescription>
        </DialogHeader>

        {createLinkToken.isPending && (
          <div className="flex items-center justify-center py-8 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {institutions && (
          <div className="flex flex-col gap-2">
            {institutions.map((inst) => (
              <Card
                key={inst.institutionId}
                className="cursor-pointer p-3 transition-colors hover:bg-surface-2"
                onClick={() => handleSelectInstitution(inst.institutionId)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{inst.institutionName}</p>
                    <p className="text-xs text-muted">
                      {inst.accounts.length} account{inst.accounts.length > 1 ? 's' : ''} available
                    </p>
                  </div>
                  {exchange.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
