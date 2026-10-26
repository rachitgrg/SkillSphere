import { useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { Check, MailPlus, Paperclip, Sparkles, Trash2, Upload } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { FileUpload } from '../common/FileUpload';
import { VerifiedBadge } from '../profile/VerifiedBadge';
import {
  useAddAttachments,
  useDeclineInvitation,
  useGigMatches,
  useInviteFreelancer,
  useRemoveAttachment,
} from '../../hooks/queries/useMarketplace';
import type { Gig, MatchBreakdown } from '../../types';
import { formatCurrency, fullName, getErrorMessage } from '../../utils/helpers';

const MB = 1024 * 1024;
const MAX_ATTACHMENTS = 10;

const formatSize = (bytes?: number) => (bytes === undefined ? '' : bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / MB).toFixed(1)} MB`);

/** Attachment list; the owner can add (when uploads are configured) and remove files before work starts. */
export function GigAttachments({ gig, canEdit, uploadsEnabled }: { gig: Gig; canEdit: boolean; uploadsEnabled: boolean }) {
  const add = useAddAttachments();
  const remove = useRemoveAttachment();
  const [files, setFiles] = useState<File[]>([]);
  const [picking, setPicking] = useState(false);

  const upload = async () => {
    if (!files.length) return;
    if (gig.attachments.length + files.length > MAX_ATTACHMENTS) return toast.error(`A gig can have at most ${MAX_ATTACHMENTS} attachments`);
    try {
      for (let i = 0; i < files.length; i += 5) await add.mutateAsync({ gigId: gig._id, files: files.slice(i, i + 5) });
      toast.success('Attachments added');
      setFiles([]);
      setPicking(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!gig.attachments.length && !(canEdit && uploadsEnabled)) return null;

  return (
    <section className="border-t border-slate-800 pt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Attachments</h2>
        {canEdit && uploadsEnabled && !picking && gig.attachments.length < MAX_ATTACHMENTS && (
          <button type="button" onClick={() => setPicking(true)} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <Upload className="w-4 h-4" /> Add files
          </button>
        )}
      </div>
      {gig.attachments.length > 0 ? (
        <ul className="space-y-2">
          {gig.attachments.map((a) => (
            <li key={a._id} className="flex items-center gap-2">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-400 hover:underline min-w-0">
                <Paperclip className="w-4 h-4 shrink-0" /> <span className="truncate">{a.name}</span>
              </a>
              <span className="text-xs text-slate-500">{formatSize(a.size)}</span>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutateAsync({ gigId: gig._id, attachmentId: a._id }).then(() => toast.success('Attachment removed'), (e) => toast.error(getErrorMessage(e)))
                  }
                  className="ml-auto text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !picking && <p className="text-sm text-slate-500">No files attached. Briefs, mockups or specs help freelancers quote accurately.</p>
      )}
      {picking && (
        <div className="mt-4 space-y-3">
          <FileUpload multiple accept=".pdf,.doc,.docx,.txt,.zip,image/*" maxSize={10 * MB} label="Briefs, specs, mockups (PDF, DOC, images, ZIP)" onFilesSelected={setFiles} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>Cancel</Button>
            <Button size="sm" onClick={upload} isLoading={add.isPending} disabled={!files.length}>Upload</Button>
          </div>
        </div>
      )}
    </section>
  );
}

const BREAKDOWN_LABELS: [keyof MatchBreakdown, string][] = [
  ['skill', 'Skills'],
  ['rating', 'Rating'],
  ['proximity', 'Distance'],
  ['experience', 'Experience'],
  ['budget', 'Budget'],
  ['availability', 'Availability'],
];

/** Owner panel: AI-ranked freelancers for this gig with an Invite button. */
export function RecommendedFreelancers({ gig }: { gig: Gig }) {
  const matches = useGigMatches(gig._id, true, 8);
  const invite = useInviteFreelancer();
  const invited = new Set((gig.invitations ?? []).map((i) => i.freelancer));

  const send = (freelancerId: string) =>
    invite.mutate(
      { gigId: gig._id, freelancerId },
      {
        onSuccess: () => toast.success(gig.status === 'open' ? 'Invitation sent' : 'Invitation saved; it is sent when the gig is approved'),
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    );

  return (
    <section className="glass-card p-6 rounded-3xl border border-slate-800">
      <h2 className="font-semibold text-white flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-400" /> Recommended freelancers
      </h2>
      <p className="text-xs text-slate-500 mt-1 mb-4">
        Ranked by skill fit, rating, distance, experience, budget and availability
        {matches.data?.[0] && (matches.data[0].source === 'ai' ? ' · AI semantic match' : ' · skill-overlap match (AI unavailable)')}.
      </p>
      {matches.isLoading && <p className="text-sm text-slate-500">Finding matches…</p>}
      {matches.isError && <p className="text-sm text-red-300">{getErrorMessage(matches.error)}</p>}
      {matches.data?.length === 0 && <p className="text-sm text-slate-500">No matching freelancers yet. Try broader skills.</p>}
      <ul className="space-y-4">
        {matches.data?.map((m) => {
          const id = m.freelancerId._id;
          const isInvited = invited.has(id);
          return (
            <li key={id} className="border-b border-slate-800 last:border-0 pb-4 last:pb-0">
              <div className="flex items-start gap-3">
                <Avatar src={m.freelancerId.avatar} firstName={m.freelancerId.firstName} lastName={m.freelancerId.lastName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link to={`/freelancers/${id}`} className="font-medium text-white hover:text-indigo-400 text-sm">{fullName(m.freelancerId)}</Link>
                    <VerifiedBadge status={m.profile.verification?.status} compact />
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {m.profile.title}
                    {m.freelancerId.address?.city && ` · ${m.freelancerId.address.city}`}
                    {m.distanceKm !== undefined && gig.locationType !== 'remote' && ` · ${Math.round(m.distanceKm)} km`}
                    {m.profile.hourlyRate > 0 && ` · ${formatCurrency(m.profile.hourlyRate)}/hr`}
                  </p>
                  <p className="text-xs text-indigo-300 mt-1">
                    {Math.round(m.score)}% match{m.matchedSkills.length > 0 && ` · ${m.matchedSkills.join(', ')}`}
                  </p>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-500" aria-label="Score breakdown">
                    {BREAKDOWN_LABELS.map(([key, label]) => (
                      <span key={key}>{label} {Math.round(m.breakdown[key] * 100)}</span>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isInvited ? 'ghost' : 'secondary'}
                  icon={isInvited ? <Check className="w-4 h-4" /> : <MailPlus className="w-4 h-4" />}
                  disabled={isInvited || (invite.isPending && invite.variables?.freelancerId === id)}
                  onClick={() => send(id)}
                >
                  {isInvited ? 'Invited' : 'Invite'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Shown to a freelancer with a pending invitation to this gig. */
export function InvitationBanner({ gig }: { gig: Gig }) {
  const decline = useDeclineInvitation();
  const invitation = gig.invitations?.[0];
  if (!invitation || invitation.status !== 'pending') return null;
  return (
    <div className="mb-6 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100 flex flex-wrap items-center gap-3">
      <MailPlus className="w-4 h-4 text-indigo-300" />
      <span className="flex-1">The client invited you to apply to this gig.</span>
      <Button
        size="sm"
        variant="ghost"
        isLoading={decline.isPending}
        onClick={() => decline.mutateAsync(gig._id).then(() => toast.success('Invitation declined'), (e) => toast.error(getErrorMessage(e)))}
      >
        Decline
      </Button>
    </div>
  );
}
