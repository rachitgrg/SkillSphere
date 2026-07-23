import { Link } from 'react-router';
import { Zap, Github, Twitter, Linkedin, Mail } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Browse Gigs', href: '/gigs' },
    { label: 'Find Freelancers', href: '/freelancers' },
    { label: 'Post a Project', href: '/gigs/create' },
    { label: 'Pricing', href: '/pricing' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Blog', href: '/blog' },
    { label: 'Press', href: '/press' },
  ],
  Support: [
    { label: 'Help Center', href: '/help' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'Trust & Safety', href: '/trust' },
    { label: 'Terms of Service', href: '/terms' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Cookie Policy', href: '/cookies' },
    { label: 'Accessibility', href: '/accessibility' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-dark-700/50 bg-dark-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer */}
        <div className="py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold gradient-text">SkillSphere</span>
            </Link>
            <p className="text-sm text-dark-400 mb-4 leading-relaxed">
              Connect with world-class freelancers and bring your projects to life.
            </p>
            <div className="flex gap-3">
              {[
                { icon: <Twitter className="w-4 h-4" />, href: '#' },
                { icon: <Github className="w-4 h-4" />, href: '#' },
                { icon: <Linkedin className="w-4 h-4" />, href: '#' },
                { icon: <Mail className="w-4 h-4" />, href: '#' },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  className="w-9 h-9 rounded-lg bg-dark-800 flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-all"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-dark-400 hover:text-primary-400 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-dark-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-dark-500">
            © {new Date().getFullYear()} SkillSphere. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">Terms</Link>
            <Link to="/privacy" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">Privacy</Link>
            <Link to="/cookies" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
