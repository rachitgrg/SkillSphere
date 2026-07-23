import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Bell, Search, ChevronDown, User, Settings, LogOut,
  LayoutDashboard, Briefcase, MessageSquare, Zap,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { logout } from '../../store/slices/authSlice';
import { toggleMobileMenu, setMobileMenuOpen } from '../../store/slices/uiSlice';
import { Avatar } from '../common/Avatar';

export function Navbar() {
  const { user, isAuthenticated } = useAppSelector((s) => s.auth);
  const { mobileMenuOpen } = useAppSelector((s) => s.ui);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
    dispatch(logout());
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin/dashboard';
    if (user.role === 'freelancer') return '/freelancer/dashboard';
    return '/client/dashboard';
  };

  const navLinks = [
    { label: 'Browse Gigs', href: '/gigs', icon: <Briefcase className="w-4 h-4" /> },
    { label: 'How It Works', href: '/#how-it-works', icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass border-b border-dark-700/50 shadow-lg shadow-black/10' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text hidden sm:block">SkillSphere</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === link.href
                    ? 'text-primary-400 bg-primary-500/10'
                    : 'text-dark-300 hover:text-white hover:bg-dark-700/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {/* Search toggle */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all"
            >
              <Search className="w-5 h-5" />
            </button>

            {isAuthenticated && user ? (
              <>
                {/* Notifications */}
                <Link
                  to="/notifications"
                  className="relative p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full" />
                </Link>

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
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-dark-700/50 transition-all"
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
                        <Link to={`/${user.role}/profile`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-dark-300 hover:text-white hover:bg-dark-700/50 transition-all">
                          <User className="w-4 h-4" /> Profile
                        </Link>
                        <Link to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-dark-300 hover:text-white hover:bg-dark-700/50 transition-all">
                          <Settings className="w-4 h-4" /> Settings
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
                <Link to="/register" className="btn-primary px-4 py-2 text-sm">
                  <span>Get Started</span>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => dispatch(toggleMobileMenu())}
              className="md:hidden p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Search bar overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-dark-700/50"
          >
            <div className="max-w-2xl mx-auto px-4 py-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search gigs, freelancers, skills..."
                  className="glass-input w-full pl-12 pr-4 py-3 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      navigate(`/search?q=${(e.target as HTMLInputElement).value}`);
                      setSearchOpen(false);
                    }
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-dark-700/50"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-dark-300 hover:text-white hover:bg-dark-700/50 transition-all"
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
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
