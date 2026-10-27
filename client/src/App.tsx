import React, { Suspense, lazy, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ScrollToTop } from './components/common/ScrollToTop';
import { Spinner } from './components/common/Spinner';
import { useAppSelector } from './hooks/useRedux';
import type { UserRole } from './types';
import { getDashboardPath } from './utils/routes';

/** Lazy-loads a named export so each page becomes its own chunk. */
const page = <K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => loader().then((module) => ({ default: module[name] })));

// Public
const LandingPage = page(() => import('./pages/public/LandingPage'), 'LandingPage');
const AboutPage = page(() => import('./pages/public/AboutPage'), 'AboutPage');
const TermsPage = page(() => import('./pages/public/StaticPages'), 'TermsPage');
const PrivacyPage = page(() => import('./pages/public/StaticPages'), 'PrivacyPage');
const ContactPage = page(() => import('./pages/public/StaticPages'), 'ContactPage');
const NotFoundPage = page(() => import('./pages/public/NotFoundPage'), 'NotFoundPage');
const GigListPage = page(() => import('./pages/gigs/GigListPage'), 'GigListPage');
const GigDetailPage = page(() => import('./pages/gigs/GigDetailPage'), 'GigDetailPage');
const SearchResultsPage = page(() => import('./pages/gigs/SearchResultsPage'), 'SearchResultsPage');
const PublicFreelancerProfile = page(() => import('./pages/freelancer/ProfilePage'), 'ProfilePage');

// Auth
const LoginPage = page(() => import('./pages/auth/LoginPage'), 'LoginPage');
const RegisterPage = page(() => import('./pages/auth/RegisterPage'), 'RegisterPage');
const VerifyEmailPage = page(() => import('./pages/auth/AuthFlowPages'), 'VerifyEmailPage');
const ForgotPasswordPage = page(() => import('./pages/auth/AuthFlowPages'), 'ForgotPasswordPage');
const ResetPasswordPage = page(() => import('./pages/auth/AuthFlowPages'), 'ResetPasswordPage');
const TwoFactorPage = page(() => import('./pages/auth/AuthFlowPages'), 'TwoFactorPage');
const OAuthCallbackPage = page(() => import('./pages/auth/OAuthCallbackPage'), 'OAuthCallbackPage');
const ChooseRolePage = page(() => import('./pages/auth/AuthFlowPages'), 'ChooseRolePage');
const SettingsPage = page(() => import('./pages/settings/SettingsPage'), 'SettingsPage');

// Shared (signed in)
const ChatPage = page(() => import('./pages/chat/ChatPage'), 'ChatPage');
const NotificationsPage = page(() => import('./pages/notifications/NotificationsPage'), 'NotificationsPage');
const ProjectProgressPage = page(() => import('./pages/gigs/ProjectProgressPage'), 'ProjectProgressPage');
const CreateDisputePage = page(() => import('./pages/disputes/DisputePages'), 'CreateDisputePage');
const DisputeDetailPage = page(() => import('./pages/disputes/DisputePages'), 'DisputeDetailPage');
const TransactionHistoryPage = page(() => import('./pages/payments/PaymentPages'), 'TransactionHistoryPage');
const ReviewPage = page(() => import('./pages/reviews/ReviewPages'), 'ReviewPage');

// Client
const ClientDashboard = page(() => import('./pages/client/ClientDashboard'), 'ClientDashboard');
const ClientProfile = page(() => import('./pages/client/ProfilePage'), 'ProfilePage');
const ClientGigsPage = page(() => import('./pages/client/ClientGigsPage'), 'ClientGigsPage');
const GigProposalsPage = page(() => import('./pages/client/GigProposalsPage'), 'GigProposalsPage');
const MeetingsPage = page(() => import('./pages/client/MeetingsPage'), 'MeetingsPage');
const ClientAnalyticsPage = page(() => import('./pages/client/ClientAnalyticsPage'), 'ClientAnalyticsPage');
const CreateGigPage = page(() => import('./pages/gigs/CreateGigPage'), 'CreateGigPage');

// Freelancer
const FreelancerDashboard = page(() => import('./pages/freelancer/FreelancerDashboard'), 'FreelancerDashboard');
const FreelancerProposalsPage = page(() => import('./pages/freelancer/MyProposalsPage'), 'MyProposalsPage');
const FreelancerProjectsPage = page(() => import('./pages/freelancer/ProjectsPage'), 'ProjectsPage');
const FreelancerAnalytics = page(() => import('./pages/freelancer/AnalyticsPage'), 'AnalyticsPage');
const SchedulerPage = page(() => import('./pages/freelancer/SchedulerPage'), 'SchedulerPage');
const EditProfilePage = page(() => import('./pages/freelancer/EditProfilePage'), 'EditProfilePage');

// Admin
const AdminDashboard = page(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
const UserManagement = page(() => import('./pages/admin/UserManagement'), 'UserManagement');
const GigApproval = page(() => import('./pages/admin/AdminPages'), 'GigApproval');
const FreelancerVerification = page(() => import('./pages/admin/AdminPages'), 'FreelancerVerification');
const PaymentMonitoring = page(() => import('./pages/admin/AdminPages'), 'PaymentMonitoring');
const DisputeManagement = page(() => import('./pages/admin/AdminPages'), 'DisputeManagement');
const AdminAnalytics = page(() => import('./pages/admin/AdminPages'), 'AnalyticsPage');
const AdminLogsPage = page(() => import('./pages/admin/AdminPages'), 'AdminLogsPage');

const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <Spinner size="lg" />
  </div>
);

const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role?: UserRole }) => {
  const { isAuthenticated, user, isBootstrapping } = useAppSelector((state) => state.auth);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.needsRoleSelection) return <Navigate to="/choose-role" replace />;
  if (role && user.role !== role) return <Navigate to={getDashboardPath(user.role)} replace />;
  return <>{children}</>;
};

/** Sends each role to its own version of a page. */
const RoleRedirect = (paths: Record<UserRole, string>) => {
  const role = useAppSelector((s) => s.auth.user?.role) ?? 'client';
  return <Navigate to={paths[role]} replace />;
};

/** Signed-in area with the dashboard chrome; `role` restricts it to one role. */
const Area = ({ role }: { role?: UserRole }) => (
  <ProtectedRoute role={role}>
    <DashboardLayout />
  </ProtectedRoute>
);

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/gigs" element={<GigListPage />} />
          <Route path="/gigs/:id" element={<GigDetailPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/freelancers/:id" element={<PublicFreelancerProfile />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/2fa" element={<TwoFactorPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/choose-role" element={<ChooseRolePage />} />

          {/* Any signed-in user */}
          <Route element={<Area />}>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/projects/:gigId" element={<ProjectProgressPage />} />
            <Route path="/disputes/new" element={<CreateDisputePage />} />
            <Route path="/disputes/:id" element={<DisputeDetailPage />} />
            {/* Role-neutral links (used by notifications) */}
            <Route path="/payments" element={<RoleRedirect client="/client/payments" freelancer="/freelancer/earnings" admin="/admin/payments" />} />
            <Route path="/reviews" element={<RoleRedirect client="/client/reviews" freelancer="/freelancer/reviews" admin="/admin/dashboard" />} />
            <Route path="/bookings" element={<RoleRedirect client="/client/meetings" freelancer="/freelancer/schedule" admin="/admin/dashboard" />} />
          </Route>

          {/* Client */}
          <Route path="/client" element={<Area role="client" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ClientDashboard />} />
            <Route path="gigs" element={<ClientGigsPage />} />
            <Route path="gigs/new" element={<CreateGigPage />} />
            <Route path="gigs/:id/proposals" element={<GigProposalsPage />} />
            <Route path="payments" element={<TransactionHistoryPage />} />
            <Route path="meetings" element={<MeetingsPage />} />
            <Route path="analytics" element={<ClientAnalyticsPage />} />
            <Route path="reviews" element={<ReviewPage />} />
            <Route path="profile" element={<ClientProfile />} />
          </Route>

          {/* Freelancer */}
          <Route path="/freelancer" element={<Area role="freelancer" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<FreelancerDashboard />} />
            <Route path="proposals" element={<FreelancerProposalsPage />} />
            <Route path="projects" element={<FreelancerProjectsPage />} />
            <Route path="earnings" element={<TransactionHistoryPage />} />
            <Route path="reviews" element={<ReviewPage />} />
            <Route path="analytics" element={<FreelancerAnalytics />} />
            <Route path="schedule" element={<SchedulerPage />} />
            <Route path="profile" element={<PublicFreelancerProfile />} />
            <Route path="profile/edit" element={<EditProfilePage />} />
          </Route>

          {/* Admin */}
          <Route path="/admin" element={<Area role="admin" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="gigs" element={<GigApproval />} />
            <Route path="verifications" element={<FreelancerVerification />} />
            <Route path="payments" element={<PaymentMonitoring />} />
            <Route path="disputes" element={<DisputeManagement />} />
            <Route path="disputes/:id" element={<DisputeDetailPage />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="logs" element={<AdminLogsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
