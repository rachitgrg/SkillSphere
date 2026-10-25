import { Link } from 'react-router';
import { Zap, Github, Mail } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Browse Gigs', href: '/gigs' },
    { label: 'Find Freelancers', href: '/search?tab=freelancers' },
    { label: 'Post a Project', href: '/client/gigs/new' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Contact Us', href: '/contact' },
  ],
  Legal: [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-dark-700/50 bg-dark-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-14 sm:gap-x-10 sm:py-16 md:grid-cols-4 lg:gap-x-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="group mb-5 flex items-center gap-2 rounded-lg focus-ring">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 transition-transform duration-300 ease-out group-hover:scale-105">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold gradient-text">SkillSphere</span>
            </Link>
            <p className="mb-5 text-sm leading-relaxed text-dark-400">
              Hire verified freelancers near you, with escrow-protected milestone payments.
            </p>
            <div className="flex gap-3">
              {[
                { icon: <Github className="w-4 h-4" />, href: 'https://github.com/rachitgrg/SkillSphere', label: 'Source code on GitHub' },
                { icon: <Mail className="w-4 h-4" />, href: '/contact', label: 'Contact us' },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  title={social.label}
                  {...(social.href.startsWith('http') && { target: '_blank', rel: 'noreferrer' })}
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg bg-dark-800 text-dark-400 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-dark-700 hover:text-white"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-dark-200">{title}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="focus-ring inline-flex rounded text-sm text-dark-400 transition duration-300 ease-out hover:translate-x-0.5 hover:text-primary-400"
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
        <div className="flex flex-col items-center justify-between gap-4 border-t border-dark-700/50 py-7 sm:flex-row">
          <p className="text-sm text-dark-500">
            © {new Date().getFullYear()} SkillSphere. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="focus-ring rounded text-xs text-dark-500 transition-colors duration-300 hover:text-dark-300">Terms</Link>
            <Link to="/privacy" className="focus-ring rounded text-xs text-dark-500 transition-colors duration-300 hover:text-dark-300">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
