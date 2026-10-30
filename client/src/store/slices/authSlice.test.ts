import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authReducer, { loginUser, logout, logoutUser, registerUser, setCredentials, updateUser } from './authSlice';
import { authApi } from '../../api/authApi';
import type { User } from '../../types';

vi.mock('../../api/authApi', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), getMe: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ refreshAccessToken: vi.fn() }));

const api = vi.mocked(authApi);
const user = { _id: 'u1', firstName: 'Asha', lastName: 'Rao', email: 'asha@test.dev', role: 'client' } as User;
const makeStore = () => configureStore({ reducer: { auth: authReducer } });

beforeEach(() => vi.clearAllMocks());

describe('authSlice reducers', () => {
  it('setCredentials signs in and logout clears everything', () => {
    let state = authReducer(undefined, setCredentials({ user, token: 'jwt' }));
    expect(state).toMatchObject({ user, token: 'jwt', isAuthenticated: true });

    state = authReducer(state, updateUser({ firstName: 'Ash' }));
    expect(state.user?.firstName).toBe('Ash');

    state = authReducer(state, logout());
    expect(state).toMatchObject({ user: null, token: null, isAuthenticated: false });
  });

  it('updateUser is a no-op when signed out', () => {
    expect(authReducer(undefined, updateUser({ firstName: 'x' })).user).toBeNull();
  });
});

describe('authSlice thunks', () => {
  it('login stores the session', async () => {
    api.login.mockResolvedValue({ user, token: 'jwt' } as never);
    const store = makeStore();
    await store.dispatch(loginUser({ email: user.email, password: 'pw' }));
    expect(store.getState().auth).toMatchObject({ isAuthenticated: true, token: 'jwt', isLoading: false, error: null });
  });

  it('a 2FA challenge is not a session', async () => {
    api.login.mockResolvedValue({ twoFactorRequired: true, tempToken: 'tmp' } as never);
    const store = makeStore();
    await store.dispatch(loginUser({ email: user.email, password: 'pw' }));
    expect(store.getState().auth).toMatchObject({ isAuthenticated: false, token: null, isLoading: false });
  });

  it('a failed login keeps the server message', async () => {
    api.login.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    const store = makeStore();
    await store.dispatch(loginUser({ email: user.email, password: 'bad' }));
    expect(store.getState().auth).toMatchObject({ isAuthenticated: false, error: 'Invalid credentials' });
  });

  it('register signs the new user in', async () => {
    api.register.mockResolvedValue({ user, token: 'jwt' } as never);
    const store = makeStore();
    await store.dispatch(registerUser({ firstName: 'Asha', lastName: 'Rao', email: user.email, password: 'Str0ngPass!', role: 'client' }));
    expect(store.getState().auth.user).toEqual(user);
  });

  it('logoutUser clears local state even when the server call fails', async () => {
    api.logout.mockRejectedValue(new Error('offline'));
    const store = makeStore();
    store.dispatch(setCredentials({ user, token: 'jwt' }));
    await store.dispatch(logoutUser());
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});
