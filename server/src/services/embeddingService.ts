import { InferenceClient } from '@huggingface/inference';
import { Types } from 'mongoose';
import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import { env } from '../config/env';
import { IGig, IFreelancerProfile } from '../types';

/** 384-dim sentence embeddings, served by the hf-inference provider. */
export const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

/** After a failed call, skip Hugging Face for this long so requests don't keep paying the timeout. */
const FAILURE_COOLDOWN_MS = 10 * 60 * 1000;

export type SimilaritySource = 'ai' | 'fallback';

type GigText = Pick<IGig, 'title' | 'description' | 'skills'> & { category?: string };
type ProfileText = Pick<IFreelancerProfile, 'title' | 'headline' | 'skills'>;

/** Lower-cases and strips punctuation so "Node.js", "nodejs" and "NodeJS" compare equal. */
export const normalizeSkill = (skill: string): string => skill.toLowerCase().replace(/[^a-z0-9+#]/g, '');

/** Jaccard similarity of two skill lists after normalisation (0–1). */
export const jaccard = (a: string[], b: string[]): number => {
  const setA = new Set(a.map(normalizeSkill).filter(Boolean));
  const setB = new Set(b.map(normalizeSkill).filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const s of setA) if (setB.has(s)) shared += 1;
  return shared / (setA.size + setB.size - shared);
};

/** Fraction of `required` skills covered by `offered` (0–1); matching is normalised and substring-tolerant. */
export const skillCoverage = (required: string[], offered: string[]): { ratio: number; matched: string[] } => {
  const have = offered.map(normalizeSkill).filter(Boolean);
  const matched = required.filter((r) => {
    const n = normalizeSkill(r);
    return n && have.some((h) => h === n || (n.length > 2 && h.length > 2 && (h.includes(n) || n.includes(h))));
  });
  return { ratio: required.length ? matched.length / required.length : 0, matched };
};

export const cosine = (a: number[], b: number[]): number => {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

export const gigEmbeddingText = (gig: GigText): string =>
  [gig.title, gig.category, `Skills: ${gig.skills.join(', ')}`, gig.description.slice(0, 1000)].filter(Boolean).join('. ');

export const profileEmbeddingText = (profile: ProfileText): string =>
  [profile.title, profile.headline, `Skills: ${(profile.skills ?? []).map((s) => s.name).join(', ')}`].filter(Boolean).join('. ');

class EmbeddingService {
  private client: InferenceClient | null = null;
  private disabledUntil = 0;

  get available(): boolean {
    return Boolean(env.HF_ACCESS_TOKEN) && Date.now() >= this.disabledUntil;
  }

  /** Embeds `text`, or returns null when Hugging Face is not configured or failing. Never throws. */
  async embed(text: string): Promise<number[] | null> {
    if (!this.available || !text.trim()) return null;
    try {
      this.client ??= new InferenceClient(env.HF_ACCESS_TOKEN);
      const output = await this.client.featureExtraction({ model: EMBEDDING_MODEL, inputs: text, provider: 'hf-inference' });
      // Sentence-transformers return one pooled vector; some deployments wrap it in another array.
      const vector = (Array.isArray(output[0]) ? output[0] : output) as number[];
      if (!vector.length || typeof vector[0] !== 'number') throw new Error('Unexpected embedding shape');
      return vector;
    } catch (error) {
      this.disabledUntil = Date.now() + FAILURE_COOLDOWN_MS;
      console.warn(`⚠️  Embedding request failed (${(error as Error).message}); using skill-overlap fallback for 10 min.`);
      return null;
    }
  }

  /** Recomputes and stores a gig's embedding. Errors are logged, never thrown. */
  async refreshGig(gigId: Types.ObjectId | string): Promise<void> {
    try {
      const gig = await Gig.findById(gigId).select('title description skills category').lean();
      if (!gig) return;
      const embedding = await this.embed(gigEmbeddingText(gig));
      await Gig.updateOne({ _id: gigId }, embedding ? { $set: { embedding } } : { $unset: { embedding: 1 } });
    } catch (error) {
      console.error('Gig embedding refresh failed:', error);
    }
  }

  /** Recomputes and stores a freelancer profile's embedding. Errors are logged, never thrown. */
  async refreshProfile(userId: Types.ObjectId | string): Promise<void> {
    try {
      const profile = await FreelancerProfile.findOne({ user: userId }).select('title headline skills').lean();
      if (!profile) return;
      const embedding = await this.embed(profileEmbeddingText(profile));
      await FreelancerProfile.updateOne({ user: userId }, embedding ? { $set: { embedding } } : { $unset: { embedding: 1 } });
    } catch (error) {
      console.error('Profile embedding refresh failed:', error);
    }
  }

  /** Runs a refresh in the background so the HTTP response is not delayed by Hugging Face. */
  queue(task: () => Promise<void>): void {
    if (env.NODE_ENV === 'test' || !env.HF_ACCESS_TOKEN) return;
    setImmediate(() => void task());
  }

  /**
   * Skill similarity between a gig and a profile (0–1).
   * Uses the cosine of cached embeddings when both exist (`source: 'ai'`), otherwise the
   * normalised skill coverage of the gig's skills, blended with Jaccard (`source: 'fallback'`).
   */
  similarity(
    gig: GigText & { embedding?: number[] },
    profile: ProfileText & { embedding?: number[] }
  ): { value: number; matched: string[]; source: SimilaritySource } {
    const offered = (profile.skills ?? []).map((s) => s.name);
    const { ratio, matched } = skillCoverage(gig.skills, offered);
    if (gig.embedding?.length && profile.embedding?.length) {
      // MiniLM cosines for related texts sit around 0.2–0.8; rescale so unrelated ≈ 0 and close ≈ 1.
      const semantic = Math.min(1, Math.max(0, (cosine(gig.embedding, profile.embedding) - 0.15) / 0.6));
      return { value: 0.7 * semantic + 0.3 * ratio, matched, source: 'ai' };
    }
    return { value: 0.8 * ratio + 0.2 * jaccard(gig.skills, offered), matched, source: 'fallback' };
  }

  /** Embeds gigs and profiles that have no embedding yet (e.g. seeded data). Runs at boot when HF is configured. */
  async backfillMissing(batch = 200): Promise<void> {
    if (!this.available) return;
    const [gigs, profiles] = await Promise.all([
      Gig.find({ embedding: { $exists: false } }).select('_id').limit(batch).lean(),
      FreelancerProfile.find({ embedding: { $exists: false } }).select('user').limit(batch).lean(),
    ]);
    for (const g of gigs) {
      if (!this.available) return;
      await this.refreshGig(g._id);
    }
    for (const p of profiles) {
      if (!this.available) return;
      await this.refreshProfile(p.user);
    }
    if (gigs.length || profiles.length) console.log(`Embedded ${gigs.length} gigs and ${profiles.length} profiles.`);
  }

  /** Test helper. */
  reset(): void {
    this.client = null;
    this.disabledUntil = 0;
  }
}

export default new EmbeddingService();
