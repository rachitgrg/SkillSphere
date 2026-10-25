import React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useSubmitProposal } from '../../hooks/queries/useProposals';
import type { Gig } from '../../types';
import { formatBudget, formatCurrency, getErrorMessage } from '../../utils/helpers';

const schema = z
  .object({
    coverLetter: z.string().trim().min(30, 'Write at least a few sentences (30+ characters)').max(3000),
    proposedAmount: z.number({ message: 'Enter your bid' }).positive('Bid must be more than 0'),
    durationValue: z.number({ message: 'Enter a duration' }).int().min(1),
    durationUnit: z.enum(['days', 'weeks', 'months']),
    milestones: z.array(
      z.object({
        title: z.string().trim().min(1, 'Title required'),
        description: z.string().trim().min(1, 'Description required'),
        amount: z.number({ message: 'Amount required' }).positive(),
        dueDate: z.string().min(1, 'Due date required'),
      })
    ),
  })
  .refine((v) => v.milestones.length === 0 || v.milestones.reduce((s, m) => s + m.amount, 0) === v.proposedAmount, {
    message: 'Milestone amounts must add up to your bid',
    path: ['milestones'],
  });

type FormValues = z.infer<typeof schema>;

interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  gig: Gig;
}

const fieldClass =
  'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500';

export const ApplyModal: React.FC<ApplyModalProps> = ({ isOpen, onClose, gig }) => {
  const submit = useSubmitProposal();
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { coverLetter: '', durationUnit: 'weeks', milestones: [] },
  });
  const milestones = useFieldArray({ control, name: 'milestones' });
  const milestoneTotal = (watch('milestones') ?? []).reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  const onSubmit = async (values: FormValues) => {
    try {
      await submit.mutateAsync({
        gigId: gig._id,
        coverLetter: values.coverLetter,
        proposedAmount: values.proposedAmount,
        estimatedDuration: `${values.durationValue} ${values.durationUnit}`,
        milestones: values.milestones.length ? values.milestones : undefined,
      });
      toast.success('Proposal submitted');
      reset();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not submit your proposal'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Submit a proposal" size="lg">
      <p className="text-sm text-slate-400 -mt-3 mb-5">
        <span className="text-white font-medium">{gig.title}</span> · client budget {formatBudget(gig)}
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="cover-letter" className="block text-sm font-medium text-slate-300 mb-1">
            Cover letter
          </label>
          <textarea
            id="cover-letter"
            rows={5}
            className={fieldClass}
            placeholder="Why are you a good fit? Mention similar work and how you'd approach this project."
            aria-invalid={Boolean(errors.coverLetter) || undefined}
            {...register('coverLetter')}
          />
          {errors.coverLetter && <p className="mt-1 text-xs text-error-500">{errors.coverLetter.message}</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label={gig.budgetType === 'hourly' ? 'Your hourly rate (₹)' : 'Your bid (₹)'}
            type="number"
            min={1}
            error={errors.proposedAmount?.message}
            {...register('proposedAmount', { valueAsNumber: true })}
          />
          <div>
            <label htmlFor="duration-value" className="block text-sm font-medium text-dark-300 mb-1.5">
              Estimated time
            </label>
            <div className="flex gap-2">
              <input id="duration-value" type="number" min={1} className={`${fieldClass} w-1/2`} {...register('durationValue', { valueAsNumber: true })} />
              <select aria-label="Duration unit" className={`${fieldClass} w-1/2`} {...register('durationUnit')}>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
            {errors.durationValue && <p className="mt-1 text-xs text-error-500">{errors.durationValue.message}</p>}
          </div>
        </div>

        <fieldset className="rounded-xl border border-slate-800 p-4">
          <legend className="px-1 text-sm font-medium text-slate-300">Milestones (optional)</legend>
          <p className="text-xs text-slate-500 mb-3">
            Split your bid into deliverables. Used for the project if the client hasn&apos;t defined milestones.
          </p>
          <div className="space-y-3">
            {milestones.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                <input aria-label={`Milestone ${index + 1} title`} placeholder="Title" className={`${fieldClass} col-span-12 sm:col-span-4`} {...register(`milestones.${index}.title`)} />
                <input aria-label={`Milestone ${index + 1} description`} placeholder="What you'll deliver" className={`${fieldClass} col-span-12 sm:col-span-4`} {...register(`milestones.${index}.description`)} />
                <input aria-label={`Milestone ${index + 1} amount`} type="number" min={1} placeholder="₹" className={`${fieldClass} col-span-5 sm:col-span-2`} {...register(`milestones.${index}.amount`, { valueAsNumber: true })} />
                <input aria-label={`Milestone ${index + 1} due date`} type="date" className={`${fieldClass} col-span-5 sm:col-span-2 sm:col-start-auto`} {...register(`milestones.${index}.dueDate`)} />
                <button
                  type="button"
                  onClick={() => milestones.remove(index)}
                  aria-label={`Remove milestone ${index + 1}`}
                  className="col-span-2 sm:col-span-12 sm:justify-self-end p-2 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={() => milestones.append({ title: '', description: '', amount: NaN, dueDate: '' })}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add milestone
            </button>
            {milestones.fields.length > 0 && <span className="text-xs text-slate-400">Total {formatCurrency(milestoneTotal)}</span>}
          </div>
          {errors.milestones?.message && <p className="mt-2 text-xs text-error-500">{errors.milestones.message}</p>}
          {errors.milestones?.root?.message && <p className="mt-2 text-xs text-error-500">{errors.milestones.root.message}</p>}
        </fieldset>

        <div className="pt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button" disabled={submit.isPending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={submit.isPending}>
            Submit proposal
          </Button>
        </div>
      </form>
    </Modal>
  );
};
