import { Outlet } from 'react-router';
import { motion } from 'framer-motion';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAppSelector } from '../../hooks/useRedux';

export function DashboardLayout() {
  const { sidebarCollapsed } = useAppSelector((s) => s.ui);

  return (
    <div className="min-h-screen bg-dark-950">
      <Navbar />
      <Sidebar />
      <motion.main
        animate={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="pt-16 min-h-screen hidden lg:block"
      >
        <div className="p-6">
          <Outlet />
        </div>
      </motion.main>
      {/* Mobile: no sidebar margin */}
      <main className="pt-16 min-h-screen lg:hidden">
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
