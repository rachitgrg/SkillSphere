import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { User, RegisterInput } from '../../types';
import { authApi } from '../../api/authApi';
import { refreshAccessToken } from '../../api/axiosInstance';
import { getErrorMessage } from '../../utils/helpers';

/**
 * The access token lives only in memory. On page load `bootstrapSession` exchanges the
 * httpOnly refresh cookie for a fresh access token, so nothing sensitive is in localStorage.
 */
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isBootstrapping: true,
  isLoading: false,
  error: null,
};

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return await authApi.login(credentials);
    } catch (err: unknown) {
      return rejectWithValue(getErrorMessage(err, 'Login failed'));
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (data: RegisterInput, { rejectWithValue }) => {
    try {
      return await authApi.register(data);
    } catch (err: unknown) {
      return rejectWithValue(getErrorMessage(err, 'Registration failed'));
    }
  }
);

/** Restores the session from the refresh cookie. `onRefreshed` (main.tsx) stores the result. */
export const bootstrapSession = createAsyncThunk('auth/bootstrap', async () => {
  try {
    await refreshAccessToken();
    return true;
  } catch {
    return false;
  }
});

/** Revokes the refresh token server-side, then clears local state. */
export const logoutUser = createAsyncThunk('auth/logoutUser', async (_, { dispatch }) => {
  try {
    await authApi.logout();
  } finally {
    dispatch(logout());
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    setCredentials: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        // A 2FA challenge is not a session; the page continues to /2fa with the temp token.
        if ('twoFactorRequired' in action.payload) return;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Session bootstrap
      .addCase(bootstrapSession.fulfilled, (state) => {
        state.isBootstrapping = false;
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.isBootstrapping = false;
      });
  },
});

export const { logout, clearError, setCredentials, updateUser } = authSlice.actions;
export default authSlice.reducer;
