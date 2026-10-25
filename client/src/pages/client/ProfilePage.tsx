import { useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, Globe, MapPin, Pencil, ShieldCheck, Star } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { ReviewCard } from '../../components/reviews/ReviewCard';
import { useMe, useUpdateClientProfile, useUpdateMe, useUserReviews } from '../../hooks/queries/useProfiles';
import type { ClientProfile } from '../../types';
import { CITIES } from '../../utils/constants';
import { formatCurrency, formatDay, fullName, getErrorMessage } from '../../utils/helpers';

const fieldClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500';

/** The signed-in client's own profile, with inline editing. */
export function ProfilePage() {
  const me = useMe();
  const user = me.data?.user;
  const profile = me.data?.profile as ClientProfile | null | undefined;
  const reviews = useUserReviews(user?._id);
  const [editing, setEditing] = useState(false);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Profile"
        description="What freelancers see when they look at your gigs."
        actions={!editing && user && <Button variant="secondary" size="sm" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditing(true)}>Edit profile</Button>}
      />
      <QueryState isLoading={me.isLoading} isError={me.isError} error={me.error} onRetry={() => me.refetch()}>
        {user && profile && (editing ? (
          <EditClientProfile user={user} profile={profile} onDone={() => setEditing(false)} />
        ) : (
          <>
            <section className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-6 items-center md:items-start">
              <Avatar src={user.avatar} firstName={user.firstName} lastName={user.lastName} size="xl" />
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold text-white">{fullName(user)}</h2>
                {profile.companyName && <p className="text-slate-300 flex items-center gap-1.5 justify-center md:justify-start mt-1"><Building2 className="w-4 h-4" /> {profile.companyName}{profile.industry ? ` · ${profile.industry}` : ''}</p>}
                {(profile.description || user.bio) && <p className="text-slate-400 max-w-2xl mt-3">{profile.description || user.bio}</p>}
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-300 justify-center md:justify-start">
                  {user.address?.city && <span className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-indigo-400" /> {user.address.city}</span>}
                  {profile.companyWebsite && <a href={profile.companyWebsite} target="_blank" rel="noreferrer" className="flex items-center hover:text-white"><Globe className="w-4 h-4 mr-1 text-cyan-400" /> {profile.companyWebsite.replace(/^https?:\/\//, '')}</a>}
                  <span className="flex items-center"><Star className="w-4 h-4 mr-1 text-amber-400" /> {profile.totalReviews ? `${profile.averageRating.toFixed(1)} (${profile.totalReviews} reviews)` : 'No reviews yet'}</span>
                  {profile.paymentVerified && <span className="flex items-center text-emerald-400"><ShieldCheck className="w-4 h-4 mr-1" /> Payment verified</span>}
                </div>
                <p className="text-xs text-slate-500 mt-3">Member since {formatDay(user.createdAt)}</p>
              </div>
            </section>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Gigs posted', profile.postedGigs],
                ['Active', profile.activeGigs],
                ['Completed', profile.completedGigs],
                ['Total spent', formatCurrency(profile.totalSpent)],
              ].map(([label, value]) => (
                <div key={label} className="glass-card rounded-2xl border border-slate-800 p-4">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="text-xl font-bold text-white mt-1">{value}</div>
                </div>
              ))}
            </div>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Reviews from freelancers</h2>
              <QueryState
                isLoading={reviews.isLoading}
                isError={reviews.isError}
                error={reviews.error}
                isEmpty={!reviews.data?.length}
                empty={{ title: 'No reviews yet', description: 'Freelancers can review you after a gig is completed.' }}
              >
                <div className="grid md:grid-cols-2 gap-4">{reviews.data?.map((r) => <ReviewCard key={r._id} review={r} />)}</div>
              </QueryState>
            </section>
          </>
        ))}
      </QueryState>
    </div>
  );
}

function EditClientProfile({ user, profile, onDone }: { user: NonNullable<ReturnType<typeof useMe>['data']>['user']; profile: ClientProfile; onDone: () => void }) {
  const updateMe = useUpdateMe();
  const updateProfile = useUpdateClientProfile();
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? '',
    city: user.address?.city ?? '',
    companyName: profile.companyName ?? '',
    companyWebsite: profile.companyWebsite ?? '',
    companySize: profile.companySize ?? '',
    industry: profile.industry ?? '',
    description: profile.description ?? '',
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const city = CITIES.find((c) => c.name === form.city);
    try {
      await updateMe.mutateAsync({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        ...(city && { address: { city: city.name, state: city.state, country: 'India' }, location: { type: 'Point', coordinates: city.coordinates } }),
      });
      await updateProfile.mutateAsync({
        companyName: form.companyName,
        companyWebsite: form.companyWebsite,
        companySize: (form.companySize || undefined) as ClientProfile['companySize'],
        industry: form.industry,
        description: form.description,
      });
      toast.success('Profile saved');
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save'));
    }
  };

  return (
    <form onSubmit={save} className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="First name" value={form.firstName} onChange={set('firstName')} required />
        <Input label="Last name" value={form.lastName} onChange={set('lastName')} required />
        <Input label="Phone" value={form.phone} onChange={set('phone')} />
        <div>
          <label htmlFor="client-city" className="block text-sm font-medium text-dark-300 mb-1.5">City</label>
          <select id="client-city" className={fieldClass} value={form.city} onChange={set('city')}>
            <option value="">Not set</option>
            {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </div>
        <Input label="Company" value={form.companyName} onChange={set('companyName')} />
        <Input label="Website" type="url" placeholder="https://" value={form.companyWebsite} onChange={set('companyWebsite')} />
        <Input label="Industry" value={form.industry} onChange={set('industry')} />
        <div>
          <label htmlFor="company-size" className="block text-sm font-medium text-dark-300 mb-1.5">Company size</label>
          <select id="company-size" className={fieldClass} value={form.companySize} onChange={set('companySize')}>
            <option value="">Not set</option>
            {['1-10', '11-50', '51-200', '201-500', '500+'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="company-description" className="block text-sm font-medium text-dark-300 mb-1.5">About the company</label>
        <textarea id="company-description" rows={4} maxLength={1000} className={fieldClass} value={form.description} onChange={set('description')} />
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" isLoading={updateMe.isPending || updateProfile.isPending}>Save</Button>
      </div>
    </form>
  );
}
