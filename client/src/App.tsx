import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { LandingPage } from './pages/public/LandingPage';
import { AboutPage } from './pages/public/AboutPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage, TwoFactorPage } from './pages/auth/AuthFlowPages';
import { ClientDashboard } from './pages/client/ClientDashboard';
import { ProfilePage as ClientProfile } from './pages/client/ProfilePage';
import { FreelancerDashboard } from './pages/freelancer/FreelancerDashboard';
import { ProfilePage as FreelancerProfile } from './pages/freelancer/ProfilePage';
import { GigListPage } from './pages/gigs/GigListPage';
import { GigDetailPage } from './pages/gigs/GigDetailPage';
import { CreateGigPage } from './pages/gigs/CreateGigPage';
import { ChatPage } from './pages/chat/ChatPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ScrollToTop } from './components/common/ScrollToTop';
import { useAppSelector } from './hooks/useRedux';
import { Spinner } from './components/common/Spinner';

const getDashboardPath = (role: 'client' | 'freelancer' | 'admin') => {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'freelancer') return '/freelancer/dashboard';
  return '/client/dashboard';
};

const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role?: 'client' | 'freelancer' | 'admin' }) => {
  const { isAuthenticated, user, isBootstrapping } = useAppSelector((state) => state.auth);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (role && user.role !== role && user.role !== 'admin') return <Navigate to={getDashboardPath(user.role)} replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/gigs" element={<GigListPage />} />
      <Route path="/gigs/:id" element={<GigDetailPage />} />

      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/2fa" element={<TwoFactorPage />} />

      {/* Shared authenticated pages */}
      <Route path="/chat" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<ChatPage />} />
      </Route>
      <Route path="/notifications" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<NotificationsPage />} />
      </Route>

      {/* Client Routes */}
      <Route path="/client" element={<ProtectedRoute role="client"><DashboardLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<ClientDashboard />} />
        <Route path="profile" element={<ClientProfile />} />
        <Route path="gigs/new" element={<CreateGigPage />} />
        <Route path="chat" element={<ChatPage />} />
      </Route>

      {/* Freelancer Routes */}
      <Route path="/freelancer" element={<ProtectedRoute role="freelancer"><DashboardLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<FreelancerDashboard />} />
        <Route path="profile" element={<FreelancerProfile />} />
        <Route path="chat" element={<ChatPage />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute role="admin"><DashboardLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<UserManagement />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </>
  );
}
