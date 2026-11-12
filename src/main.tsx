import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles/index.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { queryClient } from './app/queryClient';
import { router } from './app/router';
import { AppErrorBoundary } from './components/shared/ErrorScreens';
import { prefetchStorefrontRoute } from './features/storefront/prefetch';

prefetchStorefrontRoute(queryClient, window.location.pathname, window.location.search);

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
