import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { ApiEnvelope, User } from '@/types';

interface AuthResponse {
  user: User;
  accessToken: string;
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const res = await api.post<ApiEnvelope<AuthResponse>>('/auth/login', input);
      return res.data.data;
    },
    onSuccess: (data) => setSession(data.user, data.accessToken),
  });
}

export function useGoogleLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (idToken: string) => {
      const res = await api.post<ApiEnvelope<AuthResponse>>('/auth/google', { idToken });
      return res.data.data;
    },
    onSuccess: (data) => setSession(data.user, data.accessToken),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (input: { name: string; email: string; password: string }) => {
      const res = await api.post<ApiEnvelope<AuthResponse>>('/auth/register', input);
      return res.data.data;
    },
    onSuccess: (data) => setSession(data.user, data.accessToken),
  });
}

export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<User>>('/auth/me');
      return res.data.data;
    },
    enabled: !!accessToken,
    staleTime: 60_000,
  });
}
