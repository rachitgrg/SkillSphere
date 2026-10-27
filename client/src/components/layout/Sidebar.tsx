import { Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Briefcase, FileText, MessageSquare, CreditCard,
  Star, BarChart3, Users, Shield, AlertTriangle, ScrollText, Settings,
  ChevronLeft, ChevronRight, User, Calendar, Search, Bell, Zap, BadgeCheck,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { toggleSidebarCollapsed } from '../../store/slices/uiSlice';

interface SidebarLink {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const freelancerLinks: SidebarLink[] = [
  { label: 'Dashboard', href: '/freelancer/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Browse Gigs', href: '/gigs', icon: <Search className="w-5 h-5" /> },
  { label: 'My Proposals', href: '/freelancer/proposals', icon: <FileText className="w-5 h-5" /> },
  { label: 'Active Projects', href: '/freelancer/projects', icon: <Briefcase className="w-5 h-5" /> },
  { label: 'Messages', href: '/chat', icon: <MessageSquare className="w-5 h-5" /> },
  { label: 'Earnings', href: '/freelancer/earnings', icon: <CreditCard className="w-5 h-5" /> },
  { label: 'Reviews', href: '/freelancer/reviews', icon: <Star className="w-5 h-5" /> },
  { label: 'Analytics', href: '/freelancer/analytics', icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Schedule', href: '/freelancer/schedule', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Profile', href: '/freelancer/profile', icon: <User className="w-5 h-5" /> },
  { label: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
];

const clientLinks: SidebarLink[] = [
  { label: 'Dashboard', href: '/client/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Post a Gig', href: '/client/gigs/new', icon: <Zap className="w-5 h-5" /> },
  { label: 'My Gigs', href: '/client/gigs', icon: <Briefcase className="w-5 h-5" /> },
  { label: 'Find Freelancers', href: '/search?tab=freelancers', icon: <Search className="w-5 h-5" /> },
  { label: 'Messages', href: '/chat', icon: <MessageSquare className="w-5 h-5" /> },
  { label: 'Meetings', href: '/client/meetings', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Payments', href: '/client/payments', icon: <CreditCard className="w-5 h-5" /> },
  { label: 'Analytics', href: '/client/analytics', icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Reviews', href: '/client/reviews', icon: <Star className="w-5 h-5" /> },
  { label: 'Profile', href: '/client/profile', icon: <User className="w-5 h-5" /> },
  { label: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
];

const adminLinks: SidebarLink[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Users', href: '/admin/users', icon: <Users className="w-5 h-5" /> },
  { label: 'Gig Approval', href: '/admin/gigs', icon: <Shield className="w-5 h-5" /> },
  { label: 'Verifications', href: '/admin/verifications', icon: <BadgeCheck className="w-5 h-5" /> },
  { label: 'Payments', href: '/admin/payments', icon: <CreditCard className="w-5 h-5" /> },
  { label: 'Disputes', href: '/admin/disputes', icon: <AlertTriangle className="w-5 h-5" /> },
  { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Audit Logs', href: '/admin/logs', icon: <ScrollText className="w-5 h-5" /> },
  { label: 'Notifications', href: '/notifications', icon: <Bell className="w-5 h-5" /> },
  { label: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
];

export function Sidebar() {
  const { user } = useAppSelector((s) => s.auth);
  const { sidebarCollapsed } = useAppSelector((s) => s.ui);
  const dispatch = useAppDispatch();
  const location = useLocation();

  const links = user?.role === 'admin' ? adminLinks : user?.role === 'freelancer' ? freelancerLinks : clientLinks;

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-16 bottom-0 z-40 glass border-r border-dark-700/50 flex flex-col hidden lg:flex"
    >
      <div className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {links.map((link) => {
            const isActive = location.pathname === link.href.split('?')[0];
            return (
              <Link key={link.href} to={link.href} className="block relative">
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-gradient-to-r from-primary-500/15 to-accent-500/10 rounded-xl border border-primary-500/20"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <div
                  className={`
                    relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                    ${isActive ? 'text-primary-400' : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/30'}
                    ${sidebarCollapsed ? 'justify-center' : ''}
                  `}
                >
                  <span className="shrink-0">{link.icon}</span>
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                      >
                        {link.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {link.badge && !sidebarCollapsed && (
                    <span className="ml-auto bg-primary-500/20 text-primary-400 text-xs px-2 py-0.5 rounded-full">
                      {link.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-dark-700/50">
        <button
          onClick={() => dispatch(toggleSidebarCollapsed())}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
