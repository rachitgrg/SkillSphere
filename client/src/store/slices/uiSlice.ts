import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  notificationDropdownOpen: boolean;
}

const initialState: UiState = {
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  notificationDropdownOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    toggleMobileMenu: (state) => {
      state.mobileMenuOpen = !state.mobileMenuOpen;
    },
    setMobileMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.mobileMenuOpen = action.payload;
    },
    toggleNotificationDropdown: (state) => {
      state.notificationDropdownOpen = !state.notificationDropdownOpen;
    },
    setNotificationDropdownOpen: (state, action: PayloadAction<boolean>) => {
      state.notificationDropdownOpen = action.payload;
    },
  },
});

export const { toggleSidebarCollapsed, toggleMobileMenu, setMobileMenuOpen, toggleNotificationDropdown, setNotificationDropdownOpen } =
  uiSlice.actions;

export default uiSlice.reducer;
