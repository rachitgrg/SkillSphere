import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Mail, MessageSquare } from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

/** Contact address shown on the Contact page. */
const SUPPORT_EMAIL = 'support@skillsphere.example';

function StaticLayout({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  useDocumentTitle(title);
  return (
    <div className="min-h-screen flex flex-col bg-dark-950">
      <Navbar />
      <main className="flex-grow pt-32 pb-20 w-full max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>
        {updated && <p className="text-sm text-dark-500 mb-8">Last updated {updated}</p>}
        <div className="glass-card p-8 rounded-2xl border border-slate-800 space-y-5 text-slate-300 leading-relaxed">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

const H2 = ({ children }: { children: ReactNode }) => <h2 className="text-xl font-semibold text-white pt-2">{children}</h2>;

export function TermsPage() {
  return (
    <StaticLayout title="Terms of Service" updated="25 October 2026">
      <p>
        SkillSphere is a portfolio project that demonstrates a hyperlocal freelance marketplace. By using it you agree to
        these terms.
      </p>
      <H2>Accounts</H2>
      <p>
        You are responsible for your account and for keeping your password and two-factor codes private. Admins may
        suspend accounts that post fraudulent gigs, fake reviews or abusive messages.
      </p>
      <H2>Gigs, proposals and payments</H2>
      <p>
        Clients fund milestones into escrow before work starts. Payments run in Razorpay <strong>test mode</strong>: no
        real money moves and payouts are simulated. Disputes are mediated by an admin, who may refund, release or split an
        escrowed payment.
      </p>
      <H2>Content</H2>
      <p>
        You keep ownership of what you upload (portfolio items, attachments, messages). You grant SkillSphere the right to
        display it to the people you share it with on the platform.
      </p>
    </StaticLayout>
  );
}

export function PrivacyPage() {
  return (
    <StaticLayout title="Privacy Policy" updated="25 October 2026">
      <H2>What we store</H2>
      <p>
        Your name, email, hashed password, profile details, an approximate location (city coordinates) for local search,
        gigs, proposals, messages, reviews and payment records. Card details are handled by Razorpay and never reach our
        servers.
      </p>
      <H2>How it is used</H2>
      <p>
        To match clients with nearby freelancers, show your public profile, send notifications and emails you asked for,
        and detect fraud (for example, reviews from accounts that share an IP address).
      </p>
      <H2>Your choices</H2>
      <p>
        You can edit your profile, change notification preferences and request account deletion from the{' '}
        <Link to="/contact" className="text-primary-400 hover:underline">
          contact page
        </Link>
        .
      </p>
    </StaticLayout>
  );
}

export function ContactPage() {
  return (
    <StaticLayout title="Contact us">
      <p>Questions about a gig, a payment or your account? Reach us here:</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="flex items-center gap-3 rounded-xl border border-dark-700 p-4 hover:border-primary-500/50 transition-colors focus-ring"
        >
          <Mail className="w-5 h-5 text-primary-400" />
          <span>{SUPPORT_EMAIL}</span>
        </a>
        <Link
          to="/chat"
          className="flex items-center gap-3 rounded-xl border border-dark-700 p-4 hover:border-primary-500/50 transition-colors focus-ring"
        >
          <MessageSquare className="w-5 h-5 text-primary-400" />
          <span>Message the other party in chat</span>
        </Link>
      </div>
      <p className="text-sm text-dark-400">
        For payment problems on an active gig, open a dispute from the project page so an admin can mediate.
      </p>
    </StaticLayout>
  );
}
