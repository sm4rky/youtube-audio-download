import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from './app/query-client.ts';
import { queryCachePersistOptions } from './lib/query-cache-persister.ts';
import './index.css';
import App from './app/App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={queryCachePersistOptions}>
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
);
