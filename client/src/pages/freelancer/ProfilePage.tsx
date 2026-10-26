import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import toast from 'react-hot-toast';
import { Award, Briefcase, Calendar, ChevronLeft, ChevronRight, Download, Edit, Github, Globe, IndianRupee, Linkedin, MapPin, MessageSquare, Star } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { Modal } from '../../components/common/Modal';
import { QueryState } from '../../components/common/QueryState';
import { SkillBadge } from '../../components/profile/SkillBadge';
import { PortfolioCard } from '../../components/profile/PortfolioCard';
import { WorkTimeline } from '../../components/profile/WorkTimeline';
import { AvailabilityCalendar } from '../../components/profile/AvailabilityCalendar';
import { VerifiedBadge } from '../../components/profile/VerifiedBadge';
import { ReviewCard } from '../../components/reviews/ReviewCard';
import { ReviewBreakdownChart } from '../../components/reviews/ReviewBreakdownChart';
import { ReportReviewButton } from '../../components/reviews/ReportReviewButton';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { useFreelancerProfile, useReviewBreakdown, useUserReviews } from '../../hooks/queries/useProfiles';
import { useStartConversation } from '../../hooks/queries/useChat';
import { useAppSelector } from '../../hooks/useRedux';
import type { PortfolioItem } from '../../types';
import { formatCurrency, formatDay, fullName, getErrorMessage } from '../../utils/helpers';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="glass-card p-6 rounded-2xl border border-slate-800">
    <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
    {children}
  </section>
);

/**
 * Freelancer profile. `/freelancers/:id` is the public page (own layout); `/freelancer/profile`
 * shows the signed-in freelancer's own profile inside the dashboard with an Edit button.
 */
export function ProfilePage() {
  const { id } = useParams();
  const me = useAppSelector((s) => s.auth.user);
  const userId = id ?? me?._id;
  const isPublicRoute = Boolean(id);
  const isOwn = me?._id === userId;

  const content = <FreelancerProfileContent userId={userId} isOwn={isOwn} />;
  if (!isPublicRoute) return content;
  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />
      <main className="flex-grow pt-24 pb-20 max-w-6xl mx-auto px-4 sm:px-6 w-full">{content}</main>
      <Footer />
    </div>
  );
}

function FreelancerProfileContent({ userId, isOwn }: { userId?: string; isOwn: boolean }) {
  const navigate = useNavigate();
  const me = useAppSelector((s) => s.auth.user);
  const profileQuery = useFreelancerProfile(userId);
  const reviews = useUserReviews(userId);
  const breakdown = useReviewBreakdown(userId);
  const startConversation = useStartConversation();
  const [gallery, setGallery] = useState<{ item: PortfolioItem; index: number } | null>(null);
  const profile = profileQuery.data;

  const message = async () => {
    if (!profile) return;
    try {
      const conversation = await startConversation.mutateAsync({ participantId: profile.user._id });
      navigate(`/chat?c=${conversation._id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <QueryState
      isLoading={profileQuery.isLoading}
      isError={profileQuery.isError}
      error={profileQuery.error}
      onRetry={() => profileQuery.refetch()}
    >
      {profile && (
        <div className="space-y-6">
          <header className="relative rounded-3xl overflow-hidden glass-card border border-slate-800">
            <div className="h-32 sm:h-40 bg-gradient-to-r from-indigo-600 to-cyan-600" />
            <div className="px-6 sm:px-8 pb-6 relative flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6">
              <div className="-mt-12 shrink-0">
                <Avatar src={profile.user.avatar} firstName={profile.user.firstName} lastName={profile.user.lastName} size="xl" className="rounded-full border-4 border-slate-900 ring-2 ring-slate-800" />
              </div>
              <div className="flex-1 text-center md:text-left md:pt-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  {fullName(profile.user)} <VerifiedBadge status={profile.verification?.status} />
                </h1>
                <p className="text-indigo-400 font-medium">{profile.title}</p>
                {profile.headline && <p className="text-sm text-slate-300 mt-1">{profile.headline}</p>}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 mt-2 text-sm text-slate-400">
                  {profile.user.address?.city && <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {profile.user.address.city}</span>}
                  <span className="flex items-center"><Star className="w-4 h-4 mr-1 text-amber-400" /> {profile.totalReviews ? `${profile.averageRating.toFixed(1)} (${profile.totalReviews})` : 'New'}</span>
                  <span className="flex items-center"><Briefcase className="w-4 h-4 mr-1" /> {profile.completedGigs} jobs done</span>
                  <span className="flex items-center"><Calendar className="w-4 h-4 mr-1" /> Joined {formatDay(profile.user.createdAt)}</span>
                </div>
              </div>
              <div className="flex gap-3 w-full md:w-auto md:pt-4">
                {profile.resume && (
                  <a href={profile.resume.url} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 md:flex-none justify-center px-4 py-2 flex items-center gap-2">
                    <Download className="w-4 h-4" /> <span>Resume</span>
                  </a>
                )}
                {isOwn ? (
                  <Link to="/freelancer/profile/edit" className="btn-secondary flex-1 md:flex-none justify-center px-4 py-2 flex items-center">
                    <Edit className="w-4 h-4 mr-2" /> Edit profile
                  </Link>
                ) : (
                  me && me.role !== 'admin' && (
                    <button onClick={message} disabled={startConversation.isPending} className="btn-primary flex-1 md:flex-none px-4 py-2 flex items-center justify-center gap-2">
                      <MessageSquare className="w-4 h-4" /> <span>Message</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Section title="Skills">
                {profile.skills.length ? (
                  <div className="flex flex-wrap gap-2">{profile.skills.map((s) => <SkillBadge key={s.name} skill={s} />)}</div>
                ) : (
                  <p className="text-sm text-slate-500">No skills listed yet.</p>
                )}
              </Section>

              {profile.portfolio.length > 0 && (
                <Section title="Portfolio">
                  <div className="grid sm:grid-cols-2 gap-4">
                    {profile.portfolio.map((item, i) => (
                      <PortfolioCard key={item._id ?? i} item={item} onOpen={() => setGallery({ item, index: 0 })} />
                    ))}
                  </div>
                </Section>
              )}

              {profile.workExperience.length > 0 && (
                <Section title="Work experience">
                  <WorkTimeline items={profile.workExperience} />
                </Section>
              )}

              {(profile.certifications.length > 0 || profile.education.length > 0) && (
                <Section title="Certifications & education">
                  <ul className="space-y-3 text-sm">
                    {profile.certifications.map((c, i) => (
                      <li key={c._id ?? i} className="flex items-start gap-2">
                        <Award className="w-4 h-4 text-amber-400 mt-0.5" />
                        <div>
                          {c.credentialUrl ? <a href={c.credentialUrl} target="_blank" rel="noreferrer" className="text-white hover:underline">{c.name}</a> : <span className="text-white">{c.name}</span>}
                          <span className="text-slate-400"> · {c.issuer} · {formatDay(c.issueDate)}</span>
                        </div>
                      </li>
                    ))}
                    {profile.education.map((e, i) => (
                      <li key={`edu-${i}`} className="text-slate-300">🎓 {e.degree}, {e.institution} ({e.year})</li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section title={`Reviews${profile.totalReviews ? ` (${profile.totalReviews})` : ''}`}>
                {reviews.data?.length ? (
                  <div className="space-y-4">{reviews.data.map((r) => <ReviewCard key={r._id} review={r} footer={me && !isOwn && <ReportReviewButton reviewId={r._id} />} />)}</div>
                ) : (
                  <p className="text-sm text-slate-500">No reviews yet.</p>
                )}
              </Section>
            </div>

            <aside className="space-y-6">
              <Section title="Rates">
                <p className="flex items-center gap-1 text-2xl font-bold text-white">
                  <IndianRupee className="w-5 h-5 text-emerald-400" />
                  {profile.hourlyRate ? `${formatCurrency(profile.hourlyRate)}/hr` : 'Rate on request'}
                </p>
                <p className={`text-xs mt-1 capitalize ${profile.availability === 'available' ? 'text-emerald-400' : 'text-amber-400'}`}>{profile.availability}</p>
                {profile.milestonePricing && profile.milestonePricing.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {profile.milestonePricing.map((p) => (
                      <li key={p.title} className="rounded-xl border border-slate-800 p-3">
                        <div className="flex justify-between text-sm"><span className="text-white font-medium">{p.title}</span><span className="text-emerald-400">{formatCurrency(p.price)}</span></div>
                        {p.description && <p className="text-xs text-slate-400 mt-1">{p.description}</p>}
                        <p className="text-xs text-slate-500 mt-1">Delivered in {p.deliveryDays} days</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Availability">
                <AvailabilityCalendar slots={profile.availabilitySlots} />
              </Section>

              {breakdown.data && breakdown.data.totalReviews > 0 && (
                <Section title="Client feedback">
                  <ReviewBreakdownChart breakdown={breakdown.data} />
                </Section>
              )}

              {(profile.languages.length > 0 || Object.values(profile.socialLinks ?? {}).some(Boolean)) && (
                <Section title="More">
                  {profile.languages.length > 0 && (
                    <p className="text-sm text-slate-300 mb-3">{profile.languages.map((l) => `${l.language} (${l.proficiency})`).join(', ')}</p>
                  )}
                  <div className="flex gap-3">
                    {profile.socialLinks?.github && <a href={profile.socialLinks.github} target="_blank" rel="noreferrer" aria-label="GitHub" className="text-slate-400 hover:text-white"><Github className="w-5 h-5" /></a>}
                    {profile.socialLinks?.linkedin && <a href={profile.socialLinks.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="text-slate-400 hover:text-white"><Linkedin className="w-5 h-5" /></a>}
                    {profile.socialLinks?.website && <a href={profile.socialLinks.website} target="_blank" rel="noreferrer" aria-label="Website" className="text-slate-400 hover:text-white"><Globe className="w-5 h-5" /></a>}
                  </div>
                </Section>
              )}
            </aside>
          </div>

          <Modal isOpen={gallery !== null} onClose={() => setGallery(null)} title={gallery?.item.title} size="xl">
            {gallery && (
              <div className="relative">
                <img src={gallery.item.images[gallery.index]} alt={`${gallery.item.title} ${gallery.index + 1}`} className="w-full max-h-[70vh] object-contain rounded-xl" />
                {gallery.item.images.length > 1 && (
                  <div className="flex justify-between items-center mt-3">
                    <button aria-label="Previous image" className="btn-ghost p-2" onClick={() => setGallery({ ...gallery, index: (gallery.index - 1 + gallery.item.images.length) % gallery.item.images.length })}>
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm text-slate-400">{gallery.index + 1} / {gallery.item.images.length}</span>
                    <button aria-label="Next image" className="btn-ghost p-2" onClick={() => setGallery({ ...gallery, index: (gallery.index + 1) % gallery.item.images.length })}>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Modal>
        </div>
      )}
    </QueryState>
  );
}
