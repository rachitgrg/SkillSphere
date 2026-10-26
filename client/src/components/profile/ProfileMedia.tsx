import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Download, FileText, ImagePlus, ShieldCheck, Trash2 } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { FileUpload } from '../common/FileUpload';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { PortfolioCard } from './PortfolioCard';
import { VerifiedBadge } from './VerifiedBadge';
import {
  useAddPortfolioItem,
  useDeletePortfolioItem,
  useDeleteResume,
  useRequestVerification,
  useUploadAvatar,
  useUploadResume,
} from '../../hooks/queries/useProfiles';
import type { FreelancerProfile, User } from '../../types';
import { formatDay, getErrorMessage } from '../../utils/helpers';

const fieldClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500';
const MB = 1024 * 1024;

const Panel = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="glass-card p-6 rounded-2xl border border-slate-800">
    <h2 className="text-lg font-semibold text-white">{title}</h2>
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const UploadsDisabled = () => (
  <p className="text-xs text-amber-300/90 rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2">
    File uploads are not configured on this server (Cloudinary keys missing).
  </p>
);

/** Hidden file input behind a button. */
function FilePickButton({ accept, label, icon, onPick, disabled, isLoading }: {
  accept: string;
  label: string;
  icon: React.ReactNode;
  onPick: (file: File) => void;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
      <Button size="sm" variant="secondary" icon={icon} onClick={() => input.current?.click()} disabled={disabled} isLoading={isLoading}>
        {label}
      </Button>
    </>
  );
}

export function AvatarUploader({ user, uploadsEnabled }: { user: User; uploadsEnabled: boolean }) {
  const upload = useUploadAvatar();
  const pick = async (file: File) => {
    if (file.size > 5 * MB) return toast.error('Images must be 5 MB or smaller');
    try {
      await upload.mutateAsync(file);
      toast.success('Photo updated');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
  return (
    <Panel title="Profile photo">
      <div className="flex items-center gap-4">
        <Avatar src={user.avatar} firstName={user.firstName} lastName={user.lastName} size="xl" className="rounded-full" />
        {uploadsEnabled ? (
          <FilePickButton accept="image/jpeg,image/png,image/webp,image/gif" label="Change photo" icon={<Camera className="w-4 h-4" />} onPick={pick} isLoading={upload.isPending} />
        ) : (
          <UploadsDisabled />
        )}
      </div>
    </Panel>
  );
}

export function ResumePanel({ profile, uploadsEnabled }: { profile: FreelancerProfile; uploadsEnabled: boolean }) {
  const upload = useUploadResume();
  const remove = useDeleteResume();
  const resume = profile.resume;

  const pick = async (file: File) => {
    if (file.size > 5 * MB) return toast.error('Resumes must be 5 MB or smaller');
    try {
      await upload.mutateAsync(file);
      toast.success('Resume uploaded');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Panel title="Resume" hint="PDF, DOC or DOCX up to 5 MB. Clients can download it from your public profile.">
      {resume ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 p-3">
          <FileText className="w-5 h-5 text-indigo-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{resume.name}</p>
            <p className="text-xs text-slate-500">{Math.round(resume.size / 1024)} KB · uploaded {formatDay(resume.uploadedAt)}</p>
          </div>
          <a href={resume.url} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1">
            <Download className="w-4 h-4" /> Download
          </a>
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="w-4 h-4" />}
            isLoading={remove.isPending}
            onClick={() => remove.mutateAsync(undefined).then(() => toast.success('Resume removed'), (e) => toast.error(getErrorMessage(e)))}
          >
            Remove
          </Button>
        </div>
      ) : (
        <p className="text-sm text-slate-500 mb-3">No resume uploaded yet.</p>
      )}
      <div className="mt-3">
        {uploadsEnabled ? (
          <FilePickButton
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            label={resume ? 'Replace resume' : 'Upload resume'}
            icon={<FileText className="w-4 h-4" />}
            onPick={pick}
            isLoading={upload.isPending}
          />
        ) : (
          <UploadsDisabled />
        )}
      </div>
    </Panel>
  );
}

function AddPortfolioModal({ isOpen, onClose, uploadsEnabled }: { isOpen: boolean; onClose: () => void; uploadsEnabled: boolean }) {
  const add = useAddPortfolioItem();
  const [form, setForm] = useState({ title: '', description: '', url: '', technologies: '', imageUrls: '' });
  const [images, setImages] = useState<File[]>([]);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length > 6) return toast.error('Up to 6 images per item');
    try {
      await add.mutateAsync({
        title: form.title,
        description: form.description,
        url: form.url || undefined,
        technologies: form.technologies.split(',').map((t) => t.trim()).filter(Boolean),
        images,
        imageUrls: form.imageUrls.split(/\s+/).filter(Boolean),
      });
      toast.success('Portfolio item added');
      setForm({ title: '', description: '', url: '', technologies: '', imageUrls: '' });
      setImages([]);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add portfolio item" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Title" required maxLength={120} value={form.title} onChange={set('title')} />
        <div>
          <label htmlFor="pf-description" className="block text-sm font-medium text-dark-300 mb-1.5">Description</label>
          <textarea id="pf-description" required rows={3} maxLength={2000} className={fieldClass} value={form.description} onChange={set('description')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Project link" type="url" placeholder="https://…" value={form.url} onChange={set('url')} />
          <Input label="Technologies" placeholder="React, Node.js" value={form.technologies} onChange={set('technologies')} />
        </div>
        {uploadsEnabled ? (
          <FileUpload multiple accept="image/jpeg,image/png,image/webp,image/gif" maxSize={5 * MB} label="Images (up to 6)" onFilesSelected={setImages} />
        ) : (
          <div>
            <label htmlFor="pf-images" className="block text-sm font-medium text-dark-300 mb-1.5">Image URLs</label>
            <textarea id="pf-images" rows={2} placeholder="One URL per line (uploads are not configured)" className={fieldClass} value={form.imageUrls} onChange={set('imageUrls')} />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={add.isPending}>Add item</Button>
        </div>
      </form>
    </Modal>
  );
}

export function PortfolioManager({ profile, uploadsEnabled }: { profile: FreelancerProfile; uploadsEnabled: boolean }) {
  const remove = useDeletePortfolioItem();
  const [adding, setAdding] = useState(false);
  return (
    <Panel title="Portfolio" hint="Show finished work with screenshots. Each item can hold up to 6 images.">
      <div className="grid sm:grid-cols-2 gap-4">
        {profile.portfolio.map((item) => (
          <div key={item._id} className="relative">
            <PortfolioCard item={item} />
            <button
              type="button"
              aria-label={`Delete ${item.title}`}
              disabled={remove.isPending}
              onClick={() => remove.mutateAsync(item._id!).then(() => toast.success('Item removed'), (e) => toast.error(getErrorMessage(e)))}
              className="absolute top-2 left-2 rounded-full bg-black/60 p-1.5 text-slate-200 hover:text-red-400 focus-ring"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      {profile.portfolio.length === 0 && <p className="text-sm text-slate-500">No portfolio items yet.</p>}
      <div className="mt-4">
        <Button size="sm" variant="secondary" icon={<ImagePlus className="w-4 h-4" />} onClick={() => setAdding(true)} disabled={profile.portfolio.length >= 30}>
          Add item
        </Button>
      </div>
      <AddPortfolioModal isOpen={adding} onClose={() => setAdding(false)} uploadsEnabled={uploadsEnabled} />
    </Panel>
  );
}

export function VerificationPanel({ profile, uploadsEnabled }: { profile: FreelancerProfile; uploadsEnabled: boolean }) {
  const request = useRequestVerification();
  const [documents, setDocuments] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const status = profile.verification?.status ?? 'none';

  const submit = async () => {
    if (!documents.length) return toast.error('Attach an ID or proof of your work');
    if (documents.length > 3) return toast.error('Attach at most 3 files');
    try {
      await request.mutateAsync({ documents, message: message || undefined });
      toast.success('Verification requested — an admin will review it');
      setDocuments([]);
      setMessage('');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Panel title="Verification badge" hint="Verified freelancers get a badge and rank a little higher in search and AI matching.">
      {status === 'verified' && (
        <p className="flex items-center gap-2 text-sm text-emerald-300">
          <VerifiedBadge status="verified" /> Verified {profile.verification?.reviewedAt && `on ${formatDay(profile.verification.reviewedAt)}`}
        </p>
      )}
      {status === 'pending' && (
        <p className="text-sm text-amber-300">
          Under review since {profile.verification?.requestedAt ? formatDay(profile.verification.requestedAt) : 'recently'}. We will notify you.
        </p>
      )}
      {(status === 'none' || status === 'rejected') && (
        <div className="space-y-3">
          {status === 'rejected' && (
            <p className="text-sm text-red-300">Your last request was not approved{profile.verification?.note ? `: ${profile.verification.note}` : '.'} You can try again.</p>
          )}
          {uploadsEnabled ? (
            <>
              <FileUpload multiple accept="image/jpeg,image/png,image/webp,application/pdf" maxSize={5 * MB} label="Government ID or proof of your work (up to 3 files)" onFilesSelected={setDocuments} />
              <label htmlFor="verify-message" className="sr-only">Note to the reviewer</label>
              <textarea id="verify-message" rows={2} maxLength={1000} placeholder="Optional note to the reviewer" className={fieldClass} value={message} onChange={(e) => setMessage(e.target.value)} />
              <p className="text-xs text-slate-500">Documents are only visible to SkillSphere admins.</p>
              <Button size="sm" icon={<ShieldCheck className="w-4 h-4" />} onClick={submit} isLoading={request.isPending}>
                Request verification
              </Button>
            </>
          ) : (
            <UploadsDisabled />
          )}
        </div>
      )}
    </Panel>
  );
}
