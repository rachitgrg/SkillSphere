import { act, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../store/store';
import { setCredentials } from '../store/slices/authSlice';
import type { User } from '../types';

type Handler = (...args: unknown[]) => unknown;

/** A stand-in for the socket.io client socket: records handlers and lets the test fire events. */
const fakeSocket = {
  handlers: new Map<string, Handler>(),
  on: vi.fn((event: string, handler: Handler) => fakeSocket.handlers.set(event, handler)),
  connect: vi.fn(),
  close: vi.fn(),
  emit: (event: string, ...args: unknown[]) => fakeSocket.handlers.get(event)?.(...args),
};
vi.mock('socket.io-client', () => ({ io: vi.fn(() => fakeSocket) }));

const refresh = vi.fn();
vi.mock('../api/axiosInstance', () => ({ refreshAccessToken: () => refresh() }));

const { SocketProvider } = await import('./SocketContext');

const renderSignedIn = () => {
  store.dispatch(setCredentials({ token: 'expired', user: { _id: 'u1', role: 'client' } as User }));
  render(
    <Provider store={store}>
      <QueryClientProvider client={new QueryClient()}>
        <SocketProvider>
          <p>app</p>
        </SocketProvider>
      </QueryClientProvider>
    </Provider>
  );
};

const rejectHandshake = (message: string) => act(async () => {
  await fakeSocket.emit('connect_error', new Error(message));
});

describe('SocketProvider reconnects after the access token expires (P1-2)', () => {
  beforeEach(() => {
    fakeSocket.handlers.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    store.dispatch({ type: 'auth/logout' });
  });

  it('refreshes the token and connects again when the handshake is rejected as "Invalid token"', async () => {
    refresh.mockResolvedValue('fresh');
    renderSignedIn();
    await rejectHandshake('Invalid token');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fakeSocket.connect).toHaveBeenCalledTimes(1);
  });

  it('caps the retries, and starts over after a successful connect', async () => {
    refresh.mockResolvedValue('fresh');
    renderSignedIn();
    for (let i = 0; i < 5; i++) await rejectHandshake('Invalid token');
    expect(refresh).toHaveBeenCalledTimes(3);

    act(() => void fakeSocket.emit('connect'));
    await rejectHandshake('Invalid token');
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it('ignores other errors (socket.io retries transport errors itself; bans are final)', async () => {
    renderSignedIn();
    await rejectHandshake('xhr poll error');
    await rejectHandshake('Account is not active');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('signs out when the refresh is refused', async () => {
    refresh.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, { status: 401, statusText: '', data: {}, headers: {}, config: { headers: new AxiosHeaders() } })
    );
    renderSignedIn();
    await rejectHandshake('Invalid token');
    expect(store.getState().auth.user).toBeNull();
    expect(fakeSocket.connect).not.toHaveBeenCalled();
  });
});
