import { Wallet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useWalletLogin } from '@/hooks/useWallet';
import { getErrorMessage } from '@/lib/api';

export function ConnectWalletButton() {
  const walletLogin = useWalletLogin();
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant="crypto"
      className="w-full"
      disabled={walletLogin.isPending}
      onClick={() =>
        walletLogin.mutate(undefined, {
          onSuccess: () => navigate('/dashboard'),
          onError: (err) => toast.error(getErrorMessage(err)),
        })
      }
    >
      {walletLogin.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Wallet className="h-4 w-4" />
      )}
      Continue with MetaMask
    </Button>
  );
}
