import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import { queryClient } from '@/lib/queryClient';
import { hydrateSession } from '@/lib/api';
import './index.css';

function Root() {
  useEffect(() => {
    // Attempt a silent session restore using the httpOnly refresh cookie,
    // so a page reload doesn't force the user to log in again.
    hydrateSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
