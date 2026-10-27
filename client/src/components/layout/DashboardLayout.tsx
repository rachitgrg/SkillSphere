import { Outlet } from 'react-router';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { VerifyEmailBanner } from './VerifyEmailBanner';
import { useAppSelector } from '../../hooks/useRedux';

/** Navbar + sidebar chrome. The page renders exactly once; only the desktop margin follows the sidebar width. */
export function DashboardLayout() {
  const { sidebarCollapsed } = useAppSelector((s) => s.ui);

  return (
    <div className="min-h-screen bg-dark-950">
      <Navbar hasSidebar />
      <Sidebar />
      <main className={`pt-16 min-h-screen transition-[margin] duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}`}>
        <div className="p-4 lg:p-6">
          <VerifyEmailBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
