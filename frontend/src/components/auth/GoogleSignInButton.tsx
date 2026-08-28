import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@/hooks/useAuthMutations';
import { getErrorMessage } from '@/lib/api';

// Minimal shape of the bits of the Google Identity Services SDK we use.
// The full SDK is loaded from Google's CDN at runtime, not bundled -
// there's no npm package for it, it's a plain <script> + global `google`.
interface GoogleCredentialResponse {
  credential: string;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_ID = 'google-identity-services';

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (document.getElementById(SCRIPT_ID)) {
    // Script tag already added by a previous mount - just wait for it.
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Renders Google's own "Sign in with Google" button (not a custom-styled
 * one - Google's branding guidelines require using their rendered button).
 * On credential response, forwards the ID token to POST /auth/google,
 * where it's verified server-side (see auth.service.ts googleLogin).
 *
 * Silently renders nothing if VITE_GOOGLE_CLIENT_ID isn't set, so the app
 * works fine without Google OAuth configured.
 */
export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const googleLogin = useGoogleLogin();
  const navigate = useNavigate();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            googleLogin.mutate(response.credential, {
              onSuccess: () => navigate('/dashboard'),
              onError: (err) => toast.error(getErrorMessage(err)),
            });
          },
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      })
      .catch(() => {
        // No Google button if the script fails to load (e.g. offline, blocked) -
        // email/password and wallet login remain fully functional.
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, googleLogin, navigate]);

  if (!clientId) return null;

  return <div ref={containerRef} className="flex w-full justify-center" />;
}
