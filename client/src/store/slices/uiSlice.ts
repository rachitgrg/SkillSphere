import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  mobileMenuOpen: boolean;
  notificationDropdownOpen: boolean;
  searchQuery: string;
}

const initialState: UiState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: 'dark',
  activeModal: null,
  modalData: null,
  mobileMenuOpen: false,
  notificationDropdownOpen: false,
  searchQuery: '',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setTheme: (state, action: PayloadAction<'dark' | 'light'>) => {
      state.theme = action.payload;
    },
    openModal: (state, action: PayloadAction<{ name: string; data?: Record<string, unknown> }>) => {
      state.activeModal = action.payload.name;
      state.modalData = action.payload.data || null;
    },
    closeModal: (state) => {
      state.activeModal = null;
      state.modalData = null;
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
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapsed,
  setTheme,
  openModal,
  closeModal,
  toggleMobileMenu,
  setMobileMenuOpen,
  toggleNotificationDropdown,
  setSearchQuery,
} = uiSlice.actions;

export default uiSlice.reducer;
