import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authReducer from '../../store/slices/authSlice';
import { authApi } from '../../api/authApi';
import { TwoFactorPage } from './AuthFlowPages';
import type { AuthResponse } from '../../types';

const renderAt = (entry: string | { pathname: string; search?: string; state?: unknown }) => {
  const store = configureStore({ reducer: { auth: authReducer } });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/2fa" element={<TwoFactorPage />} />
          <Route path="/client/dashboard" element={<p>client dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return store;
};

const typeCode = (code: string) =>
  code.split('').forEach((digit, i) => fireEvent.change(screen.getByLabelText(`Digit ${i + 1}`), { target: { value: digit } }));

describe('TwoFactorPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('without a challenge, says the sign-in expired', () => {
    renderAt('/2fa');
    expect(screen.getByText(/sign-in session expired/i)).toBeInTheDocument();
  });

  it('after Google sign-in, verifies against the challenge cookie (no token in the URL or state)', async () => {
    const session = { user: { _id: 'u1', role: 'client' }, token: 'jwt' } as unknown as AuthResponse;
    const verify = vi.spyOn(authApi, 'verifyTwoFactor').mockResolvedValue(session);
    const store = renderAt('/2fa?via=google');

    typeCode('123456');

    await waitFor(() => expect(screen.getByText('client dashboard')).toBeInTheDocument());
    expect(verify).toHaveBeenCalledWith(undefined, '123456');
    expect(store.getState().auth.token).toBe('jwt');
  });

  it('after a password login, sends the tempToken from router state', async () => {
    const verify = vi.spyOn(authApi, 'verifyTwoFactor').mockResolvedValue({ user: { _id: 'u1', role: 'client' }, token: 'jwt' } as unknown as AuthResponse);
    renderAt({ pathname: '/2fa', state: { tempToken: 'challenge' } });
    typeCode('654321');
    await waitFor(() => expect(verify).toHaveBeenCalledWith('challenge', '654321'));
  });
});
