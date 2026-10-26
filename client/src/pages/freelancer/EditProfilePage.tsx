import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useFieldArray, useForm, type FieldArrayPath, type UseFormRegister, type Control } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useMe, useUpdateFreelancerProfile, useUpdateMe } from '../../hooks/queries/useProfiles';
import { useConfig } from '../../hooks/queries/useConfig';
import { AvatarUploader, PortfolioManager, ResumePanel, VerificationPanel } from '../../components/profile/ProfileMedia';
import type { FreelancerProfile, ProficiencyLevel } from '../../types';
import { CITIES } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';

const fieldClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500';
const dateOnly = (iso?: string) => (iso ? iso.slice(0, 10) : '');

interface FormValues {
  title: string;
  headline: string;
  bio: string;
  city: string;
  hourlyRate: number;
  availability: FreelancerProfile['availability'];
  skills: { name: string; proficiency: ProficiencyLevel; yearsOfExperience: number }[];
  workExperience: { title: string; company: string; startDate: string; endDate: string; current: boolean; description: string }[];
  certifications: { name: string; issuer: string; issueDate: string; credentialUrl: string }[];
  education: { degree: string; institution: string; year: number }[];
  milestonePricing: { title: string; description: string; price: number; deliveryDays: number }[];
  languages: { language: string; proficiency: string }[];
  github: string;
  linkedin: string;
  website: string;
}

const toForm = (user: NonNullable<ReturnType<typeof useMe>['data']>['user'], p: FreelancerProfile): FormValues => ({
  title: p.title,
  headline: p.headline,
  bio: user.bio ?? '',
  city: user.address?.city ?? '',
  hourlyRate: p.hourlyRate,
  availability: p.availability,
  skills: p.skills.map((s) => ({ ...s, yearsOfExperience: s.yearsOfExperience ?? 0 })),
  workExperience: p.workExperience.map((w) => ({ ...w, startDate: dateOnly(w.startDate), endDate: dateOnly(w.endDate) })),
  certifications: p.certifications.map((c) => ({ name: c.name, issuer: c.issuer, issueDate: dateOnly(c.issueDate), credentialUrl: c.credentialUrl ?? '' })),
  education: p.education,
  milestonePricing: (p.milestonePricing ?? []).map((m) => ({ ...m, description: m.description ?? '' })),
  languages: p.languages,
  github: p.socialLinks?.github ?? '',
  linkedin: p.socialLinks?.linkedin ?? '',
  website: p.socialLinks?.website ?? '',
});

/** Section wrapper for a repeatable list with an "Add" button. */
function ListSection<K extends FieldArrayPath<FormValues>>({
  title,
  hint,
  control,
  name,
  empty,
  render,
}: {
  title: string;
  hint?: string;
  control: Control<FormValues>;
  name: K;
  empty: unknown;
  render: (index: number) => React.ReactNode;
}) {
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <section className="space-y-3 border-t border-slate-800 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <button type="button" onClick={() => append(empty as never)} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border border-slate-800 p-4 relative">
          <button type="button" onClick={() => remove(index)} aria-label={`Remove ${title} ${index + 1}`} className="absolute top-3 right-3 text-slate-500 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="pr-8">{render(index)}</div>
        </div>
      ))}
      {fields.length === 0 && <p className="text-sm text-slate-500">Nothing added yet.</p>}
    </section>
  );
}

export function EditProfilePage() {
  const navigate = useNavigate();
  const me = useMe();
  const config = useConfig();
  const uploadsEnabled = config.data?.uploads ?? false;
  const updateMe = useUpdateMe();
  const updateProfile = useUpdateFreelancerProfile();
  const { register, control, handleSubmit, reset } = useForm<FormValues>();
  const r: UseFormRegister<FormValues> = register;

  const profile = me.data?.profile as FreelancerProfile | null | undefined;
  useEffect(() => {
    if (me.data && profile) reset(toForm(me.data.user, profile));
  }, [me.data, profile, reset]);

  const onSubmit = async (v: FormValues) => {
    const city = CITIES.find((c) => c.name === v.city);
    const location = city ? ({ type: 'Point', coordinates: city.coordinates } as const) : undefined;
    try {
      await updateMe.mutateAsync({
        bio: v.bio,
        ...(city && { address: { city: city.name, state: city.state, country: 'India' }, location }),
      });
      await updateProfile.mutateAsync({
        title: v.title,
        headline: v.headline,
        hourlyRate: Number(v.hourlyRate) || 0,
        availability: v.availability,
        skills: v.skills.filter((s) => s.name.trim()).map((s) => ({ ...s, yearsOfExperience: Number(s.yearsOfExperience) || 0 })),
        workExperience: v.workExperience.map((w) => ({ ...w, endDate: w.current || !w.endDate ? undefined : w.endDate })),
        certifications: v.certifications.map((c) => ({ ...c, credentialUrl: c.credentialUrl || undefined })),
        education: v.education.map((e) => ({ ...e, year: Number(e.year) })),
        milestonePricing: v.milestonePricing.map((m) => ({ ...m, price: Number(m.price), deliveryDays: Number(m.deliveryDays) })),
        languages: v.languages.filter((l) => l.language.trim()),
        socialLinks: { github: v.github, linkedin: v.linkedin, website: v.website },
        ...(location && { location }),
      });
      toast.success('Profile saved');
      navigate('/freelancer/profile');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save your profile'));
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Edit profile" description="A complete profile ranks higher in AI matching and search." />
      <QueryState isLoading={me.isLoading} isError={me.isError} error={me.error} onRetry={() => me.refetch()}>
        {me.data && profile && (
          <div className="grid gap-6 mb-6">
            <div className="grid md:grid-cols-2 gap-6">
              <AvatarUploader user={me.data.user} uploadsEnabled={uploadsEnabled} />
              <ResumePanel profile={profile} uploadsEnabled={uploadsEnabled} />
            </div>
            <PortfolioManager profile={profile} uploadsEnabled={uploadsEnabled} />
            <VerificationPanel profile={profile} uploadsEnabled={uploadsEnabled} />
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Basics</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Professional title" {...r('title', { required: true })} />
              <Input label="Headline" {...r('headline')} />
              <Input label="Hourly rate (₹)" type="number" min={0} {...r('hourlyRate', { valueAsNumber: true })} />
              <div>
                <label htmlFor="availability" className="block text-sm font-medium text-dark-300 mb-1.5">Availability</label>
                <select id="availability" className={fieldClass} {...r('availability')}>
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-dark-300 mb-1.5">City</label>
                <select id="city" className={fieldClass} {...r('city')}>
                  <option value="">Not set</option>
                  {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-dark-300 mb-1.5">About you</label>
              <textarea id="bio" rows={4} maxLength={500} className={fieldClass} {...r('bio')} />
            </div>
          </section>

          <ListSection title="Skills" control={control} name="skills" empty={{ name: '', proficiency: 'intermediate', yearsOfExperience: 1 }} render={(i) => (
            <div className="grid grid-cols-12 gap-3">
              <input aria-label="Skill" placeholder="Skill (e.g. React)" className={`${fieldClass} col-span-12 sm:col-span-6`} {...r(`skills.${i}.name`)} />
              <select aria-label="Proficiency" className={`${fieldClass} col-span-7 sm:col-span-4`} {...r(`skills.${i}.proficiency`)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
              <input aria-label="Years" type="number" min={0} placeholder="Years" className={`${fieldClass} col-span-5 sm:col-span-2`} {...r(`skills.${i}.yearsOfExperience`, { valueAsNumber: true })} />
            </div>
          )} />

          <ListSection title="Work experience" control={control} name="workExperience" empty={{ title: '', company: '', startDate: '', endDate: '', current: false, description: '' }} render={(i) => (
            <div className="grid sm:grid-cols-2 gap-3">
              <input aria-label="Role" placeholder="Role" className={fieldClass} {...r(`workExperience.${i}.title`)} />
              <input aria-label="Company" placeholder="Company" className={fieldClass} {...r(`workExperience.${i}.company`)} />
              <input aria-label="Start date" type="date" className={fieldClass} {...r(`workExperience.${i}.startDate`)} />
              <input aria-label="End date" type="date" className={fieldClass} {...r(`workExperience.${i}.endDate`)} />
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" {...r(`workExperience.${i}.current`)} /> I work here now</label>
              <textarea aria-label="Description" rows={2} placeholder="What you did" className={`${fieldClass} sm:col-span-2`} {...r(`workExperience.${i}.description`)} />
            </div>
          )} />

          <ListSection title="Fixed-price packages" hint="Offer clear deliverables at a set price next to your hourly rate." control={control} name="milestonePricing" empty={{ title: '', description: '', price: 0, deliveryDays: 7 }} render={(i) => (
            <div className="grid grid-cols-12 gap-3">
              <input aria-label="Package title" placeholder="e.g. Landing page" className={`${fieldClass} col-span-12 sm:col-span-6`} {...r(`milestonePricing.${i}.title`)} />
              <input aria-label="Price" type="number" min={0} placeholder="₹ price" className={`${fieldClass} col-span-6 sm:col-span-3`} {...r(`milestonePricing.${i}.price`, { valueAsNumber: true })} />
              <input aria-label="Delivery days" type="number" min={1} placeholder="Days" className={`${fieldClass} col-span-6 sm:col-span-3`} {...r(`milestonePricing.${i}.deliveryDays`, { valueAsNumber: true })} />
              <input aria-label="Package description" placeholder="What's included" className={`${fieldClass} col-span-12`} {...r(`milestonePricing.${i}.description`)} />
            </div>
          )} />

          <ListSection title="Certifications" control={control} name="certifications" empty={{ name: '', issuer: '', issueDate: '', credentialUrl: '' }} render={(i) => (
            <div className="grid sm:grid-cols-2 gap-3">
              <input aria-label="Certification" placeholder="Certification" className={fieldClass} {...r(`certifications.${i}.name`)} />
              <input aria-label="Issuer" placeholder="Issuer" className={fieldClass} {...r(`certifications.${i}.issuer`)} />
              <input aria-label="Issue date" type="date" className={fieldClass} {...r(`certifications.${i}.issueDate`)} />
              <input aria-label="Credential URL" placeholder="Credential URL" className={fieldClass} {...r(`certifications.${i}.credentialUrl`)} />
            </div>
          )} />

          <ListSection title="Education" control={control} name="education" empty={{ degree: '', institution: '', year: new Date().getFullYear() }} render={(i) => (
            <div className="grid grid-cols-12 gap-3">
              <input aria-label="Degree" placeholder="Degree" className={`${fieldClass} col-span-12 sm:col-span-5`} {...r(`education.${i}.degree`)} />
              <input aria-label="Institution" placeholder="Institution" className={`${fieldClass} col-span-8 sm:col-span-5`} {...r(`education.${i}.institution`)} />
              <input aria-label="Year" type="number" className={`${fieldClass} col-span-4 sm:col-span-2`} {...r(`education.${i}.year`, { valueAsNumber: true })} />
            </div>
          )} />

          <ListSection title="Languages" control={control} name="languages" empty={{ language: '', proficiency: 'fluent' }} render={(i) => (
            <div className="grid grid-cols-2 gap-3">
              <input aria-label="Language" placeholder="Language" className={fieldClass} {...r(`languages.${i}.language`)} />
              <select aria-label="Level" className={fieldClass} {...r(`languages.${i}.proficiency`)}>
                <option value="basic">Basic</option>
                <option value="conversational">Conversational</option>
                <option value="fluent">Fluent</option>
                <option value="native">Native</option>
              </select>
            </div>
          )} />

          <section className="space-y-3 border-t border-slate-800 pt-6">
            <h2 className="text-lg font-semibold text-white">Links</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input label="GitHub" type="url" placeholder="https://github.com/…" {...r('github')} />
              <Input label="LinkedIn" type="url" placeholder="https://linkedin.com/in/…" {...r('linkedin')} />
              <Input label="Website" type="url" placeholder="https://" {...r('website')} />
            </div>
          </section>

          <div className="flex justify-end gap-3 border-t border-slate-800 pt-6">
            <Button type="button" variant="ghost" onClick={() => navigate('/freelancer/profile')}>Cancel</Button>
            <Button type="submit" isLoading={updateMe.isPending || updateProfile.isPending}>Save profile</Button>
          </div>
        </form>
      </QueryState>
    </div>
  );
}
