import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  Code2,
  MonitorSmartphone,
  PenTool,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound,
  Video,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';

type Category = {
  title: string;
  count: string;
  icon: LucideIcon;
  iconClassName: string;
  badge?: string;
  badgeClassName?: string;
};

const categories: Category[] = [
  { title: 'Web Development', count: '12,500+ freelancers', icon: Code2, iconClassName: 'text-blue-400 bg-blue-500/10', badge: 'Trending', badgeClassName: 'border-blue-400/20 bg-blue-500/10 text-blue-300' },
  { title: 'Mobile Development', count: '8,200+ freelancers', icon: MonitorSmartphone, iconClassName: 'text-emerald-400 bg-emerald-500/10', badge: 'AI Pick', badgeClassName: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' },
  { title: 'UI/UX Design', count: '6,800+ freelancers', icon: PenTool, iconClassName: 'text-pink-400 bg-pink-500/10', badge: 'Popular', badgeClassName: 'border-pink-400/20 bg-pink-500/10 text-pink-300' },
  { title: 'Digital Marketing', count: '5,600+ freelancers', icon: Rocket, iconClassName: 'text-amber-400 bg-amber-500/10' },
  { title: 'Writing & Translation', count: '4,900+ freelancers', icon: PenTool, iconClassName: 'text-violet-400 bg-violet-500/10' },
  { title: 'Video & Animation', count: '3,400+ freelancers', icon: Video, iconClassName: 'text-cyan-400 bg-cyan-500/10' },
];

const metrics = [
  { label: 'Happy Clients', value: '10,000+', icon: UsersRound, className: 'text-blue-400 bg-blue-500/10' },
  { label: 'Verified Freelancers', value: '25,000+', icon: ShieldCheck, className: 'text-indigo-400 bg-indigo-500/10' },
  { label: 'Projects Completed', value: '50,000+', icon: BriefcaseBusiness, className: 'text-cyan-400 bg-cyan-500/10' },
  { label: 'Average Rating', value: '4.8/5', icon: Star, className: 'text-amber-400 bg-amber-500/10' },
];

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
};

const checklistIconVariants = {
  rest: { opacity: 0.7, scale: 1, x: -1 },
  hover: { opacity: 1, scale: 1.14, x: 0 },
};

const audienceCardVariants = {
  rest: { y: 0 },
  hover: { y: -4 },
};

type TrustedBrand = {
  name: string;
  mark: 'orbit' | 'beam' | 'pulse' | 'stack' | 'grid' | 'wave' | 'ring';
};

const trustedBrands: TrustedBrand[] = [
  { name: 'zomentum', mark: 'orbit' },
  { name: 'BrightAI', mark: 'beam' },
  { name: 'Pulse', mark: 'pulse' },
  { name: 'cloudstack', mark: 'stack' },
  { name: 'tensorcorp', mark: 'grid' },
  { name: 'vertwave', mark: 'wave' },
  { name: 'layerops', mark: 'ring' },
];

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function TrustedLogo({ name, mark }: TrustedBrand) {
  const markPaths = {
    orbit: <><circle cx="13" cy="14" r="7" stroke="currentColor" strokeWidth="1.6" /><path d="M4 14h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
    beam: <><path d="m5 19 7-11 7 11" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8.5 14h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
    pulse: <path d="M3 15h4l2.5-6 4.2 10 2.5-5H23" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
    stack: <><path d="m13 5 9 5-9 5-9-5 9-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="m4 14 9 5 9-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>,
    grid: <><rect x="5" y="6" width="6" height="6" rx="1" fill="currentColor" /><rect x="14" y="6" width="6" height="6" rx="1" fill="currentColor" opacity="0.62" /><rect x="5" y="15" width="6" height="6" rx="1" fill="currentColor" opacity="0.62" /><rect x="14" y="15" width="6" height="6" rx="1" fill="currentColor" /></>,
    wave: <path d="M3 16c3.6 0 3.6-7 7.2-7s3.6 7 7.2 7 3.6-7 7.2-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
    ring: <><circle cx="12" cy="14" r="7" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="14" r="2" fill="currentColor" /></>,
  };

  return (
    <svg viewBox="0 0 132 28" aria-label={name} role="img" className="h-7 w-[116px] fill-none">
      <g>{markPaths[mark]}</g>
      <text x="30" y="18" fill="currentColor" fontSize="12" fontFamily="Inter, sans-serif" fontWeight="600" letterSpacing="-0.2">{name}</text>
    </svg>
  );
}

function DashboardPreview() {
  const chartHeights = [28, 40, 35, 56, 46, 68, 52, 74, 62, 88, 78, 96];

  return (
    <motion.div
      initial={{ opacity: 0, x: 28, rotate: 1.5, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.18, ease: 'easeOut' }}
      whileHover={{ rotate: -1.25, scale: 1.01 }}
      className="relative mx-auto w-full max-w-[610px]"
    >
      <motion.div
        animate={{ opacity: [0.35, 0.55, 0.35], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -inset-10 rounded-full bg-gradient-to-br from-primary-500/20 via-secondary-500/5 to-accent-500/20 blur-3xl"
      />
      <div className="absolute -left-8 bottom-3 h-56 w-56 rounded-full border border-primary-500/30" />
      <div className="absolute -right-10 -top-6 h-48 w-48 rounded-full border border-accent-500/25" />

      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative overflow-hidden rounded-2xl border border-primary-400/15 bg-[#081425]/90 p-2 shadow-2xl shadow-black/40 will-change-transform backdrop-blur-xl sm:p-3"
      >
        <div className="grid min-h-[325px] grid-cols-[96px_1fr] overflow-hidden rounded-xl border border-slate-700/45 bg-[#091627] text-[8px] sm:grid-cols-[118px_1fr] sm:text-[9px]">
          <aside className="border-r border-slate-700/50 bg-[#071222] px-2 py-3 sm:px-3">
            <div className="mb-5 flex items-center gap-1.5 px-1 font-bold text-white sm:mb-7">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-gradient-to-br from-primary-500 to-secondary-500"><Zap className="h-2.5 w-2.5" /></div>
              <span>SkillSphere</span>
            </div>
            <div className="space-y-1">
              {['Dashboard', 'Projects', 'Messages', 'Proposals', 'Payments', 'Analytics', 'Saved'].map((item, index) => (
                <div key={item} className={`flex items-center gap-1.5 rounded px-1.5 py-1.5 ${index === 0 ? 'bg-primary-500/15 text-primary-300' : 'text-slate-500'}`}>
                  <span className={`h-1.5 w-1.5 rounded-sm ${index === 0 ? 'bg-primary-400' : 'bg-slate-600'}`} />
                  <span>{item}</span>
                  {item === 'Messages' && (
                    <motion.span
                      animate={{ opacity: [0.8, 1, 0.8], scale: [1, 1.12, 1] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                      className="ml-auto rounded-full bg-primary-500 px-1 text-[6px] text-white"
                    >
                      3
                    </motion.span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-slate-700/50 pt-3 text-slate-500">Settings</div>
            <div className="mt-3 flex items-center gap-1.5 text-slate-300">
              <span className="relative h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 to-rose-400">
                <motion.span
                  animate={{ opacity: [0.25, 0.8, 0.25], scale: [1, 1.75, 1] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400"
                />
              </span>
              <span className="truncate">Rachit Jain</span>
            </div>
          </aside>

          <div className="min-w-0 p-3 sm:p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-white sm:text-xs">Good morning, Rachit <span aria-hidden="true">👋</span></p>
                <p className="mt-0.5 text-slate-500">Here&apos;s what&apos;s happening with your projects today.</p>
              </div>
              <span className="h-4 w-4 rounded-full border border-slate-600" />
            </div>

            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {[
                ['Active Projects', '12', 'text-primary-300'],
                ['Pending Proposals', '8', 'text-pink-300'],
                ['Total Spent', '$4,890', 'text-emerald-300'],
                ['Unread Messages', '5', 'text-amber-300'],
              ].map(([label, value, color], index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.46 + index * 0.09 }}
                  className="rounded-md border border-slate-700/55 bg-[#0c1a2c] p-1.5 sm:p-2"
                >
                  <p className="truncate text-slate-500">{label}</p>
                  <p className={`mt-1 text-[10px] font-bold sm:text-xs ${color}`}>{value}</p>
                  <p className="mt-0.5 truncate text-[6px] text-emerald-400 sm:text-[7px]">↗ 20% from last month</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-[1.55fr_1fr] gap-2">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.84 }}
                className="rounded-md border border-slate-700/55 bg-[#0c1a2c] p-2 sm:p-2.5"
              >
                <div className="flex items-center justify-between"><p className="font-medium text-slate-200">Project Overview</p><span className="text-primary-300">⋯</span></div>
                <div className="mt-2 flex h-20 items-end gap-1 border-b border-l border-slate-700/50 px-1 pb-1 sm:h-24">
                  {chartHeights.map((height, index) => (
                    <motion.span
                      key={index}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: 1.06 + index * 0.045, duration: 0.38, ease: 'easeOut' }}
                      className="flex-1 rounded-t-sm bg-gradient-to-t from-primary-600 to-secondary-400/90"
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[6px] text-slate-600"><span>Jan</span><span>Mar</span><span>May</span><span>Jul</span></div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.94 }}
                className="rounded-md border border-slate-700/55 bg-[#0c1a2c] p-2 sm:p-2.5"
              >
                <p className="font-medium text-slate-200">AI Recommendations</p>
                <p className="mt-0.5 text-[7px] text-slate-500">New matches for your projects</p>
                <div className="mt-2 space-y-2">
                  {['Alex Johnson', 'Sarah Williams', 'David Miller'].map((name, index) => (
                    <motion.div
                      key={name}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 1.12 + index * 0.1, ease: 'easeOut' }}
                      className="flex items-center gap-1.5"
                    >
                      <span className={`h-4 w-4 rounded-full ${['bg-violet-400', 'bg-amber-300', 'bg-cyan-400'][index]}`} />
                      <span className="min-w-0 flex-1 truncate text-slate-300">{name}</span>
                      <span className="text-[6px] text-emerald-400">+ {95 - index * 3}%</span>
                    </motion.div>
                  ))}
                </div>
                <p className="mt-3 text-[7px] font-medium text-primary-300">View all recommendations →</p>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 1.04 }}
              className="mt-2 flex items-center justify-between rounded-md border border-slate-700/55 bg-[#0c1a2c] p-2"
            >
              <div><p className="font-medium text-slate-200">E-commerce Website Redesign</p><p className="text-[7px] text-slate-500">Budget: $2,500 – $4,000</p></div>
              <div className="flex -space-x-1"><span className="h-4 w-4 rounded-full border border-[#0c1a2c] bg-violet-400" /><span className="h-4 w-4 rounded-full border border-[#0c1a2c] bg-amber-300" /><span className="h-4 w-4 rounded-full border border-[#0c1a2c] bg-cyan-400" /></div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export const LandingPage = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-[#020b16] text-white">
      <Navbar />

      <main>
        <section className="relative isolate overflow-hidden pt-28 sm:pt-32 lg:pt-36">
          <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_25%_42%,rgba(99,102,241,0.07),transparent_19%),radial-gradient(circle_at_72%_25%,rgba(80,70,229,0.16),transparent_24%),radial-gradient(circle_at_25%_60%,rgba(6,182,212,0.10),transparent_28%),linear-gradient(180deg,#030b16_0%,#04101d_100%)]" />
          <div className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />

          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-14 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:gap-8 lg:px-8 lg:pb-20">
            <motion.div initial={{ opacity: 0, x: -22 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.65, ease: 'easeOut' }} className="relative z-10 max-w-xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-primary-300">
                <Sparkles className="h-3 w-3" /> AI-powered matchmaking
              </div>
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.65rem]">
                Where Local Talent <br className="hidden lg:block" /> Meets <span className="bg-gradient-to-r from-primary-400 via-accent-400 to-secondary-400 bg-clip-text text-transparent">Real Opportunity</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg">
                SkillSphere connects businesses with verified freelancers in their community—making meaningful work and lasting relationships easier to find.
              </p>

              <div className="mt-7 grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-3 sm:gap-2">
                {[
                  ['Secure Payments', 'Protected every step', ShieldCheck, 'text-emerald-400'],
                  ['Verified Freelancers', 'Quality checked', BadgeCheck, 'text-primary-400'],
                  ['24/7 Support', 'We&apos;re here', Sparkles, 'text-accent-400'],
                ].map(([title, subtitle, Icon, color]) => {
                  const BenefitIcon = Icon as LucideIcon;
                  return (
                    <div key={title as string} className="flex items-center gap-2 sm:block">
                      <BenefitIcon className={`h-5 w-5 shrink-0 ${color as string} sm:mb-2`} />
                      <div><p className="text-xs font-medium text-slate-200">{title as string}</p><p className="text-[10px] text-slate-500">{subtitle as string}</p></div>
                    </div>
                  );
                })}
              </div>

            </motion.div>

            <DashboardPreview />
          </div>
        </section>

        <section className="relative z-10 border-y border-slate-800/70 bg-[#091627]/85">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-slate-700/45 px-4 sm:grid-cols-4 sm:divide-y-0 sm:px-6 lg:px-8">
            {metrics.map(({ label, value, icon: Icon, className }) => (
              <Reveal key={label} className="flex items-center gap-3 px-3 py-5 sm:px-6 sm:py-6">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${className}`}><Icon className="h-5 w-5" /></span>
                <div><p className="text-base font-bold text-white sm:text-lg">{value}</p><p className="text-[10px] text-slate-500 sm:text-xs">{label}</p></div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="bg-[#020b16] py-14 sm:py-16" id="how-it-works">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mb-6 sm:mb-7">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary-400">Browse by expertise</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Explore Popular Categories</h2>
              </div>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {categories.map(({ title, count, icon: Icon, iconClassName, badge, badgeClassName }, index) => (
                <Reveal key={title} delay={index * 0.04}>
                  <Link to="/gigs" className="group relative flex h-full items-center gap-3 rounded-xl border border-slate-800/80 bg-[#091627]/80 p-3.5 transition duration-300 ease-out hover:-translate-y-1 hover:border-primary-300/50 hover:bg-slate-900 hover:shadow-lg hover:shadow-primary-950/30 focus-ring">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 ease-out group-hover:scale-110 ${iconClassName}`}><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 pr-12"><span className="block truncate text-xs font-medium text-slate-200 group-hover:text-white">{title}</span><span className="mt-1 block text-[10px] text-slate-500">{count}</span></span>
                    {badge && <span className={`absolute right-2.5 top-2.5 rounded-full border px-1.5 py-0.5 text-[8px] font-medium leading-none ${badgeClassName}`}>{badge}</span>}
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#020b16] pb-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 lg:grid-cols-2">
              <Reveal>
                <motion.div variants={audienceCardVariants} initial="rest" animate="rest" whileHover="hover" transition={{ duration: 0.28, ease: 'easeOut' }} className="group relative overflow-hidden rounded-2xl border border-primary-500/25 bg-gradient-to-br from-primary-950/45 via-[#091627] to-[#081323] p-6 shadow-lg shadow-black/10 transition-[border-color,box-shadow] duration-300 ease-out hover:border-primary-400/50 hover:shadow-xl hover:shadow-primary-950/35 sm:p-7">
                  <div className="absolute -bottom-20 -left-14 h-40 w-72 rounded-full border border-primary-500/30" />
                  <div className="relative grid gap-6 sm:grid-cols-[1fr_165px] sm:items-center">
                    <div>
                      <span className="text-xs font-medium text-primary-300">For Clients</span>
                      <h2 className="mt-2 text-2xl font-bold text-white">Build. Hire. Grow.</h2>
                      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">Post your project, get matched with the best freelancers, and bring your ideas to life.</p>
                      <div className="mt-5"><Link to="/client/gigs/new" className="btn-primary px-4 py-2.5 text-xs transition duration-300 ease-out group-hover:brightness-110 group-hover:shadow-lg group-hover:shadow-primary-500/25"><span>Post a Project</span></Link></div>
                    </div>
                    <div className="rounded-xl border border-primary-400/15 bg-[#081426]/80 p-3 text-xs text-slate-400">
                      {['Post Project', 'Get Matched', 'Review Proposals', 'Hire & Get Work Done'].map((item, index) => <div key={item} className="flex items-center justify-between py-1.5"><span>{item}</span><motion.span variants={checklistIconVariants} transition={{ duration: 0.22, delay: index * 0.035, ease: 'easeOut' }}><Check className={`h-3.5 w-3.5 ${index === 3 ? 'text-primary-400' : 'text-emerald-400'}`} /></motion.span></div>)}
                    </div>
                  </div>
                </motion.div>
              </Reveal>

              <Reveal delay={0.1}>
                <motion.div variants={audienceCardVariants} initial="rest" animate="rest" whileHover="hover" transition={{ duration: 0.28, ease: 'easeOut' }} className="group relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/35 via-[#091627] to-[#071d1b] p-6 shadow-lg shadow-black/10 transition-[border-color,box-shadow] duration-300 ease-out hover:border-emerald-400/50 hover:shadow-xl hover:shadow-emerald-950/35 sm:p-7">
                  <div className="absolute -right-20 -top-20 h-44 w-72 rounded-full border border-emerald-500/25" />
                  <div className="relative grid gap-6 sm:grid-cols-[1fr_165px] sm:items-center">
                    <div>
                      <span className="text-xs font-medium text-emerald-300">For Freelancers</span>
                      <h2 className="mt-2 text-2xl font-bold text-white">Find Work. Earn. Succeed.</h2>
                      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">Discover projects that match your skills, submit proposals, and grow your career.</p>
                      <div className="mt-5"><Link to="/gigs" className="btn-success px-4 py-2.5 text-xs transition duration-300 ease-out group-hover:brightness-110 group-hover:shadow-lg group-hover:shadow-emerald-500/20"><span>Browse Projects</span></Link></div>
                    </div>
                    <div className="rounded-xl border border-emerald-400/15 bg-[#081725]/80 p-3 text-xs text-slate-400">
                      {['Create Profile', 'Find Projects', 'Submit Proposals', 'Get Hired & Earn'].map((item, index) => <div key={item} className="flex items-center justify-between py-1.5"><span>{item}</span><motion.span variants={checklistIconVariants} transition={{ duration: 0.22, delay: index * 0.035, ease: 'easeOut' }}><Check className={`h-3.5 w-3.5 ${index === 3 ? 'text-primary-400' : 'text-emerald-400'}`} /></motion.span></div>)}
                    </div>
                  </div>
                </motion.div>
              </Reveal>
            </div>

            <Reveal delay={0.15} className="mt-12 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Trusted by businesses and talent worldwide</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-4 sm:gap-x-8">
                {trustedBrands.map((brand) => <div key={brand.name} className="text-slate-600 transition-colors duration-300 ease-out hover:text-slate-300"><TrustedLogo {...brand} /></div>)}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};
