import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import authReducer from '../../store/slices/authSlice';
import { ProtectedRoute } from './ProtectedRoute';
import type { User, UserRole } from '../../types';

const renderAt = (auth: { user?: Partial<User> | null; isBootstrapping?: boolean }, role?: UserRole) => {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        user: (auth.user ?? null) as User | null,
        token: auth.user ? 'jwt' : null,
        isAuthenticated: Boolean(auth.user),
        isBootstrapping: auth.isBootstrapping ?? false,
        isLoading: false,
        error: null,
      },
    },
  });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/client/dashboard']}>
        <Routes>
          <Route path="/client/dashboard" element={<ProtectedRoute role={role}><p>client area</p></ProtectedRoute>} />
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/choose-role" element={<p>choose role</p>} />
          <Route path="/freelancer/dashboard" element={<p>freelancer dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
};

describe('ProtectedRoute', () => {
  it('waits for the session bootstrap before deciding', () => {
    renderAt({ isBootstrapping: true });
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
    expect(screen.queryByText('client area')).not.toBeInTheDocument();
  });

  it('sends signed-out visitors to /login', () => {
    renderAt({ user: null });
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('sends Google sign-ups without a role to /choose-role', () => {
    renderAt({ user: { _id: 'u1', role: 'client', needsRoleSelection: true } }, 'client');
    expect(screen.getByText('choose role')).toBeInTheDocument();
  });

  it('sends users of another role to their own dashboard', () => {
    renderAt({ user: { _id: 'u1', role: 'freelancer' } }, 'client');
    expect(screen.getByText('freelancer dashboard')).toBeInTheDocument();
  });

  it('renders the area for the right role', () => {
    renderAt({ user: { _id: 'u1', role: 'client' } }, 'client');
    expect(screen.getByText('client area')).toBeInTheDocument();
  });
});
