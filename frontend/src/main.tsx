import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import { ToastProvider } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/confirm';
import { queryClient } from './lib/queryClient';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <App />
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
