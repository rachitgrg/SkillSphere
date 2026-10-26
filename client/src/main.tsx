import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { store } from './store/store';
import { configureAuth } from './api/axiosInstance';
import { bootstrapSession, logout, setCredentials } from './store/slices/authSlice';
import type { User } from './types';
import { SocketProvider } from './contexts/SocketContext';
import { CallProvider } from './contexts/CallContext';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

configureAuth({
  getToken: () => store.getState().auth.token,
  onRefreshed: ({ token, user }) => store.dispatch(setCredentials({ token, user: user as User })),
  onAuthFailure: () => {
    store.dispatch(logout());
    queryClient.clear();
  },
});
// Tokens used to be kept in localStorage; remove any left over from older builds.
try {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
} catch {
  // storage unavailable
}
store.dispatch(bootstrapSession());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <CallProvider>
          <BrowserRouter>
            <App />
            <Toaster position="top-right" toastOptions={{ className: 'glass-card border border-slate-700 bg-slate-900 text-white' }} />
          </BrowserRouter>
          </CallProvider>
        </SocketProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
