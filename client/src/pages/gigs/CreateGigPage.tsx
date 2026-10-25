import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { LocateFixed, Plus, Trash2, X } from 'lucide-react';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { PageHeader } from '../../components/common/PageHeader';
import { useCreateGig } from '../../hooks/queries/useDashboard';
import type { GigInput } from '../../types';
import { CITIES, GIG_CATEGORIES, nearestCity } from '../../utils/constants';
import { formatCurrency, getErrorMessage } from '../../utils/helpers';

const today = () => new Date().toISOString().slice(0, 10);

const schema = z
  .object({
    title: z.string().trim().min(10, 'Use at least 10 characters').max(200),
    category: z.string().min(1, 'Pick a category'),
    description: z.string().trim().min(50, 'Describe the work in at least 50 characters').max(5000),
    experienceLevel: z.enum(['entry', 'intermediate', 'expert']),
    budgetType: z.enum(['fixed', 'hourly']),
    budgetMin: z.number({ message: 'Required' }).positive('Must be more than 0'),
    budgetMax: z.number({ message: 'Required' }).positive('Must be more than 0'),
    durationValue: z.number({ message: 'Required' }).int().min(1),
    durationUnit: z.enum(['days', 'weeks', 'months']),
    skills: z.array(z.string()).min(1, 'Add at least one skill').max(20),
    deadline: z.string().optional(),
    locationType: z.enum(['remote', 'onsite', 'hybrid']),
    city: z.string().optional(),
    visibility: z.enum(['public', 'private']),
    milestones: z.array(
      z.object({
        title: z.string().trim().min(1, 'Title required'),
        description: z.string().trim().min(1, 'Description required'),
        amount: z.number({ message: 'Amount required' }).positive(),
        dueDate: z.string().min(1, 'Due date required'),
      })
    ),
  })
  .refine((v) => v.budgetMax >= v.budgetMin, { message: 'Maximum must be at least the minimum', path: ['budgetMax'] })
  .refine((v) => v.locationType === 'remote' || Boolean(v.city), { message: 'Choose a city for on-site or hybrid work', path: ['city'] })
  .refine((v) => v.milestones.reduce((s, m) => s + (m.amount || 0), 0) <= v.budgetMax, {
    message: 'Milestones add up to more than your maximum budget',
    path: ['milestones'],
  });

type FormValues = z.infer<typeof schema>;

const fieldClass =
  'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500';
const Label = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-dark-300 mb-1.5">
    {children}
  </label>
);
const FieldError = ({ message }: { message?: string }) => (message ? <p className="mt-1 text-xs text-error-500">{message}</p> : null);

export const CreateGigPage: React.FC = () => {
  const navigate = useNavigate();
  const createGig = useCreateGig();
  const [skillInput, setSkillInput] = useState('');
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<[number, number] | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      category: GIG_CATEGORIES[0],
      description: '',
      experienceLevel: 'intermediate',
      budgetType: 'fixed',
      durationValue: 2,
      durationUnit: 'weeks',
      skills: [],
      locationType: 'remote',
      visibility: 'public',
      milestones: [],
    },
  });
  const milestones = useFieldArray({ control, name: 'milestones' });
  const skills = watch('skills');
  const budgetType = watch('budgetType');
  const locationType = watch('locationType');
  const budgetMax = watch('budgetMax');
  const milestoneTotal = (watch('milestones') ?? []).reduce((s, m) => s + (Number(m.amount) || 0), 0);

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !skills.includes(skill)) setValue('skills', [...skills, skill], { shouldValidate: true });
    setSkillInput('');
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error('Your browser does not support location');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setCoords(point);
        setValue('city', nearestCity(point).name, { shouldValidate: true });
        setLocating(false);
      },
      () => {
        toast.error('Could not get your location; pick a city instead');
        setLocating(false);
      },
      { timeout: 10_000 }
    );
  };

  const onSubmit = async (values: FormValues) => {
    const city = CITIES.find((c) => c.name === values.city);
    const point = coords ?? city?.coordinates;
    const input: GigInput = {
      title: values.title,
      description: values.description,
      category: values.category,
      skills: values.skills,
      budgetType: values.budgetType,
      budgetMin: values.budgetMin,
      budgetMax: values.budgetMax,
      duration: `${values.durationValue} ${values.durationUnit}`,
      experienceLevel: values.experienceLevel,
      locationType: values.locationType,
      visibility: values.visibility,
      deadline: values.deadline || undefined,
      milestones: values.milestones.length ? values.milestones : undefined,
      ...(values.locationType !== 'remote' && point && { location: { type: 'Point', coordinates: point } }),
    };
    try {
      const gig = await createGig.mutateAsync(input);
      toast.success('Gig submitted. It goes live once an admin approves it.');
      navigate(`/gigs/${gig._id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to post gig'));
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Post a gig" description="Describe the work; an admin reviews new gigs before they go live." />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">1. Basics</h2>
          <Input label="Title" placeholder="e.g. React developer for a booking dashboard" error={errors.title?.message} {...register('title')} />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <select id="category" className={fieldClass} {...register('category')}>
                {GIG_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="experience">Experience level</Label>
              <select id="experience" className={fieldClass} {...register('experienceLevel')}>
                <option value="entry">Entry level</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea id="description" rows={6} className={fieldClass} placeholder="Goals, deliverables, tech stack, how you'll review the work…" {...register('description')} />
            <FieldError message={errors.description?.message} />
          </div>
          <div>
            <Label htmlFor="skill-input">Skills</Label>
            <div className="flex gap-2">
              <input
                id="skill-input"
                className={fieldClass}
                placeholder="Type a skill and press Enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={addSkill}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {skills.map((skill) => (
                <span key={skill} className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded-full">
                  {skill}
                  <button
                    type="button"
                    aria-label={`Remove ${skill}`}
                    onClick={() => setValue('skills', skills.filter((s) => s !== skill), { shouldValidate: true })}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <FieldError message={errors.skills?.message} />
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-800 pt-6">
          <h2 className="text-lg font-semibold text-white">2. Budget & timeline</h2>
          <fieldset className="flex gap-6 text-sm text-slate-300">
            <legend className="sr-only">Budget type</legend>
            <label className="flex items-center gap-2">
              <input type="radio" value="fixed" {...register('budgetType')} /> Fixed price
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="hourly" {...register('budgetType')} /> Hourly
            </label>
          </fieldset>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label={budgetType === 'fixed' ? 'Budget from (₹)' : 'Min hourly rate (₹)'} type="number" min={1} error={errors.budgetMin?.message} {...register('budgetMin', { valueAsNumber: true })} />
            <Input label={budgetType === 'fixed' ? 'Budget up to (₹)' : 'Max hourly rate (₹)'} type="number" min={1} error={errors.budgetMax?.message} {...register('budgetMax', { valueAsNumber: true })} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Input label="Duration" type="number" min={1} error={errors.durationValue?.message} {...register('durationValue', { valueAsNumber: true })} />
            <div>
              <Label htmlFor="duration-unit">Unit</Label>
              <select id="duration-unit" className={fieldClass} {...register('durationUnit')}>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
            <Input label="Deadline (optional)" type="date" min={today()} {...register('deadline')} />
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-800 pt-6">
          <h2 className="text-lg font-semibold text-white">3. Location</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location-type">Where will the work happen?</Label>
              <select id="location-type" className={fieldClass} {...register('locationType')}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            {locationType !== 'remote' && (
              <div>
                <Label htmlFor="city">City</Label>
                <div className="flex gap-2">
                  <select id="city" className={fieldClass} {...register('city', { onChange: () => setCoords(null) })}>
                    <option value="">Choose a city</option>
                    {CITIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="secondary" onClick={useMyLocation} isLoading={locating} icon={<LocateFixed className="w-4 h-4" />} aria-label="Use my location">
                    <span className="sr-only">Use my location</span>
                  </Button>
                </div>
                <FieldError message={errors.city?.message} />
                <p className="text-[11px] text-slate-500 mt-1">Used to recommend freelancers near you.</p>
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="visibility">Visibility</Label>
            <select id="visibility" className={fieldClass} {...register('visibility')}>
              <option value="public">Public — listed in the marketplace</option>
              <option value="private">Private — only people you share it with</option>
            </select>
          </div>
        </section>

        <section className="space-y-3 border-t border-slate-800 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">4. Milestones (optional)</h2>
            {milestones.fields.length > 0 && (
              <span className={`text-xs ${budgetMax && milestoneTotal > budgetMax ? 'text-red-400' : 'text-slate-400'}`}>
                {formatCurrency(milestoneTotal)} of {budgetMax ? formatCurrency(budgetMax) : 'budget'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">Each milestone is funded into escrow separately and released when you approve it.</p>
          {milestones.fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-slate-800 p-4 grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6">
                <input aria-label={`Milestone ${index + 1} title`} placeholder="Title" className={fieldClass} {...register(`milestones.${index}.title`)} />
                <FieldError message={errors.milestones?.[index]?.title?.message} />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <input aria-label={`Milestone ${index + 1} amount`} type="number" min={1} placeholder="₹ amount" className={fieldClass} {...register(`milestones.${index}.amount`, { valueAsNumber: true })} />
                <FieldError message={errors.milestones?.[index]?.amount?.message} />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <input aria-label={`Milestone ${index + 1} due date`} type="date" min={today()} className={fieldClass} {...register(`milestones.${index}.dueDate`)} />
                <FieldError message={errors.milestones?.[index]?.dueDate?.message} />
              </div>
              <div className="col-span-11">
                <input aria-label={`Milestone ${index + 1} description`} placeholder="What will be delivered" className={fieldClass} {...register(`milestones.${index}.description`)} />
                <FieldError message={errors.milestones?.[index]?.description?.message} />
              </div>
              <button type="button" onClick={() => milestones.remove(index)} aria-label={`Remove milestone ${index + 1}`} className="col-span-1 justify-self-end text-slate-500 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <FieldError message={errors.milestones?.root?.message ?? errors.milestones?.message} />
          <button type="button" onClick={() => milestones.append({ title: '', description: '', amount: NaN, dueDate: '' })} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add milestone
          </button>
        </section>

        <div className="border-t border-slate-800 pt-6 flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createGig.isPending}>
            Submit for approval
          </Button>
        </div>
      </form>
    </div>
  );
};
