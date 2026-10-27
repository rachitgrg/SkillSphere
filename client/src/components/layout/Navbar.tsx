import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Bell, Search, ChevronDown, User, LogOut,
  LayoutDashboard, MessageSquare, Zap,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { logoutUser } from '../../store/slices/authSlice';
import { toggleMobileMenu, setMobileMenuOpen, setNotificationDropdownOpen, toggleNotificationDropdown } from '../../store/slices/uiSlice';
import { Avatar } from '../common/Avatar';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { useUnreadCount } from '../../hooks/queries/useNotifications';

/** `hasSidebar` (dashboard layout): the menu button opens the sidebar drawer instead of the public dropdown. */
export function Navbar({ hasSidebar = false }: { hasSidebar?: boolean }) {
  const { user, isAuthenticated } = useAppSelector((s) => s.auth);
  const { mobileMenuOpen, notificationDropdownOpen } = useAppSelector((s) => s.ui);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: unread = 0 } = useUnreadCount(isAuthenticated);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    dispatch(setMobileMenuOpen(false));
    setProfileOpen(false);
  }, [location, dispatch]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    dispatch(logoutUser()).finally(() => navigate('/login'));
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin/dashboard';
    if (user.role === 'freelancer') return '/freelancer/dashboard';
    return '/client/dashboard';
  };

  const getProfilePath = () => {
    if (!user || user.role === 'admin') return getDashboardPath();
    return `/${user.role}/profile`;
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass border-b border-dark-700/50 shadow-lg shadow-black/10' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2.5 rounded-xl transition-transform duration-300 ease-out hover:scale-[1.015] focus-ring">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/25 transition-shadow duration-300 ease-out group-hover:shadow-primary-500/40">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text hidden sm:block">SkillSphere</span>
          </Link>

          {/* Right section */}
          <div className="flex items-center gap-2.5">
            {/* Search toggle */}
            <button
              onClick={() => navigate('/search')}
              aria-label="Search SkillSphere"
              className="focus-ring rounded-lg p-2 text-dark-400 transition-all duration-300 ease-out hover:-translate-y-px hover:bg-dark-700/50 hover:text-white"
            >
              <Search className="w-5 h-5" />
            </button>

            {isAuthenticated && user ? (
              <>
                {/* Notifications */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => dispatch(toggleNotificationDropdown())}
                    aria-label="Open notifications"
                    className="relative p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all"
                  >
                    <Bell className="w-5 h-5" />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary-500 text-[10px] font-bold text-white flex items-center justify-center" aria-label={`${unread} unread`}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                  <NotificationDropdown
                    isOpen={notificationDropdownOpen}
                    onClose={() => dispatch(setNotificationDropdownOpen(false))}
                  />
                </div>

                {/* Messages */}
                <Link
                  to="/chat"
                  className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all hidden sm:block"
                >
                  <MessageSquare className="w-5 h-5" />
                </Link>

                {/* Profile Dropdown */}
                <div ref={profileRef} className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="focus-ring flex items-center gap-2 rounded-xl p-1.5 transition-all duration-300 ease-out hover:scale-[1.02] hover:bg-dark-700/50"
                  >
                    <Avatar
                      src={user.avatar}
                      firstName={user.firstName}
                      lastName={user.lastName}
                      size="sm"
                      status="online"
                    />
                    <span className="text-sm font-medium text-dark-200 hidden lg:block">
                      {user.firstName}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-dark-400 hidden lg:block transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-64 glass-card-static p-2 z-50"
                      >
                        <div className="px-3 py-3 border-b border-dark-700/50 mb-1">
                          <p className="text-sm font-semibold text-white">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-dark-400 mt-0.5">{user.email}</p>
                          <span className="badge badge-primary mt-2 text-[10px]">{user.role}</span>
                        </div>
                        <Link to={getDashboardPath()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-dark-300 hover:text-white hover:bg-dark-700/50 transition-all">
                          <LayoutDashboard className="w-4 h-4" /> Dashboard
                        </Link>
                        <Link to={getProfilePath()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-dark-300 hover:text-white hover:bg-dark-700/50 transition-all">
                          <User className="w-4 h-4" /> Profile
                        </Link>
                        <hr className="divider my-1" />
                        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 w-full transition-all">
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost px-4 py-2 text-sm hidden sm:block">
                  Sign In
                </Link>
                <Link to={isAuthenticated && user ? getDashboardPath() : '/register'} className="btn-primary px-4 py-2 text-sm">
                  <span>Get Started</span>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => dispatch(toggleMobileMenu())}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls={hasSidebar ? 'mobile-sidebar' : undefined}
              className={`${hasSidebar ? 'lg:hidden' : 'md:hidden'} p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all`}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && !hasSidebar && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-dark-700/50"
          >
            <div className="px-4 py-4 space-y-1">
              {isAuthenticated && (
                <>
                  <Link to="/chat" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-dark-300 hover:text-white hover:bg-dark-700/50 transition-all">
                    <MessageSquare className="w-4 h-4" /> Messages
                  </Link>
                  <Link to={getDashboardPath()} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-dark-300 hover:text-white hover:bg-dark-700/50 transition-all">
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                  </Link>
                </>
              )}
              {!isAuthenticated && (
                <div className="pt-3 border-t border-dark-700/50 space-y-2">
                  <Link to="/login" className="block text-center btn-ghost px-4 py-2.5 text-sm w-full">Sign In</Link>
                  <Link to="/register" className="block text-center btn-primary px-4 py-2.5 text-sm w-full"><span>Get Started</span></Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
