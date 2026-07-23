import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { store } from './store/store';
import { SocketProvider } from './contexts/SocketContext';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <BrowserRouter>
            <App />
            <Toaster position="top-right" toastOptions={{ className: 'glass-card border border-slate-700 bg-slate-900 text-white' }} />
          </BrowserRouter>
        </SocketProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
