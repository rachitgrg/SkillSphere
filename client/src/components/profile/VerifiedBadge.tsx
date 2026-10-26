import { ShieldCheck } from 'lucide-react';

/** Shown on cards, profiles and search results for admin-verified freelancers. */
export function VerifiedBadge({ status, compact = false }: { status?: string; compact?: boolean }) {
  if (status !== 'verified') return null;
  return (
    <span
      title="Identity and portfolio verified by SkillSphere"
      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {compact ? <span className="sr-only">Verified</span> : 'Verified'}
    </span>
  );
}
