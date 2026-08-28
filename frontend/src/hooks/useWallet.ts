import { useMutation } from '@tanstack/react-query';
import { BrowserProvider } from 'ethers';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { ApiEnvelope, User } from '@/types';

declare global {
  interface Window {
    ethereum?: import('ethers').Eip1193Provider & {
      isMetaMask?: boolean;
    };
  }
}

interface WalletAuthResponse {
  user: User;
  accessToken: string;
}

/** Full MetaMask sign-in flow: connect -> request nonce -> sign -> verify. */
export function useWalletLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async () => {
      if (!window.ethereum) {
        throw new Error('MetaMask not detected. Please install the MetaMask extension.');
      }

      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const walletAddress: string = accounts[0];
      const signer = await provider.getSigner();

      const nonceRes = await api.post<ApiEnvelope<{ message: string }>>('/wallet/nonce', {
        walletAddress,
      });
      const { message } = nonceRes.data.data;

      const signature = await signer.signMessage(message);

      const verifyRes = await api.post<ApiEnvelope<WalletAuthResponse>>('/wallet/verify', {
        walletAddress,
        signature,
      });
      return verifyRes.data.data;
    },
    onSuccess: (data) => setSession(data.user, data.accessToken),
  });
}

/** Links a wallet to the currently logged-in account (email or another session). */
export function useLinkWallet() {
  return useMutation({
    mutationFn: async () => {
      if (!window.ethereum) {
        throw new Error('MetaMask not detected. Please install the MetaMask extension.');
      }
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const walletAddress: string = accounts[0];
      const signer = await provider.getSigner();

      const nonceRes = await api.post<ApiEnvelope<{ message: string }>>('/wallet/nonce', {
        walletAddress,
      });
      const signature = await signer.signMessage(nonceRes.data.data.message);

      const res = await api.post<ApiEnvelope<User>>('/wallet/link', {
        walletAddress,
        signature,
      });
      return res.data.data;
    },
  });
}
