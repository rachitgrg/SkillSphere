# SkillSphere — Intelligent Hyperlocal Freelance Ecosystem

A MERN (TypeScript) platform connecting clients with verified local freelancers.

> The full README (setup, architecture, features, demo accounts) is written in Phase 5 of
> `docs/dev-notes/CLAUDE_CODE_PLAN.md`. This file currently records only the facts that later phases rely on.

## API docs

Interactive Swagger UI at **http://localhost:5000/api/docs** (raw spec: `/api/docs.json`). The OpenAPI
document is generated from `server/src/docs/openapi.ts` and request bodies come from the same zod schemas
that validate requests, so the docs cannot drift; a test fails if a route is undocumented.

## Seed data and demo accounts

`npm run seed` (in `server/`) creates demo data **without deleting anything** (it upserts by email,
gig title, …). Re-running refreshes demo content but keeps workflow state (hires, payments, statuses) made in the app.
On an existing database, run `npm run db:sync-indexes` once to apply index changes. It refuses to run unless `MONGO_URI` points at localhost, unless you pass `--force`.

```bash
cd server
MONGO_URI=mongodb://127.0.0.1:27017/skillsphere_dev npm run seed
# add -- --reset-passwords to reset existing demo users' passwords
```

| Role | Email | Password |
|---|---|---|
| Admin | `admin@skillsphere.dev` (`SEED_ADMIN_EMAIL`) | `Admin@12345` (`SEED_ADMIN_PASSWORD`) |
| Clients | `ananya@client.demo`, `rohan@client.demo`, `kavya@client.demo` | `Demo@12345` (`SEED_DEMO_PASSWORD`) |
| Freelancers | `arjun@`, `priya@`, `vikram@`, `sneha@`, `rahul@`, `meera@`, `karthik@`, `aisha@freelancer.demo` | `Demo@12345` |

It creates 1 admin, 3 clients and 8 freelancers (skills with proficiency, hourly rates and GeoJSON
locations in Bengaluru, Mumbai, Delhi, Pune, Hyderabad and Chennai), 16 open gigs, pending
proposals, an in-progress gig with milestones, a completed gig with reviews, a conversation, and
payments in every state (pending, escrow, released, refunded, disputed).

## Dependency audit

Last checked: 2026-10-25 (`npm audit` and `npm audit --omit=dev` in `/`, `server/`, `client/`).

| Package | Result |
|---|---|
| root | 0 vulnerabilities |
| server | 0 vulnerabilities |
| client | 0 vulnerabilities |

Upgrades made to get there: `multer` 1.x → 2.x, `nodemailer` 6.x → 10.x, `zod` 3.x → 4.x
(both apps), plus non-breaking `npm audit fix`.

## AI matching (module 2)

Code: `server/src/services/aiMatchingService.ts` (`MATCH_WEIGHTS`, `scoreMatch`) and
`server/src/services/embeddingService.ts`.

- **Embeddings:** `sentence-transformers/all-MiniLM-L6-v2` (384-dim) through Hugging Face
  `featureExtraction` on the `hf-inference` provider. Gigs embed *title + category + skills +
  description*; freelancer profiles embed *title + headline + skills*. Vectors are cached on
  `Gig.embedding` / `FreelancerProfile.embedding` (`select: false`), recomputed in the background
  when those fields change, and backfilled at boot for documents that have none.
- **Fallback:** without `HF_ACCESS_TOKEN`, or for 10 minutes after a failed call, skill similarity is
  the normalised skill coverage blended with Jaccard overlap, and responses carry `source: 'fallback'`.
- **Score (0–100):**

| Component | Weight | Value (0–1) |
|---|---|---|
| Skill similarity | 0.45 | 0.7 · rescaled embedding cosine + 0.3 · skill coverage (fallback: 0.8 · coverage + 0.2 · Jaccard) |
| Rating | 0.20 | Bayesian average / 5 — prior of 5 reviews at the platform mean rating |
| Proximity | 0.15 | onsite/hybrid: `1 − min(distanceKm, 50) / 50` (0 if the freelancer has no location); remote: 1 |
| Experience fit | 0.10 | average proficiency on the gig's skills ÷ level required (entry 1, intermediate 2.5, expert 3.5) |
| Budget fit | 0.05 | hourly rate (fixed gigs: cheapest package) ≤ `budgetMax` → 1, linear penalty above, 0.5 if unknown |
| Availability | 0.05 | available 1, busy 0.5 |

  Verified freelancers get +3 points. Candidates are profiles sharing a skill with the gig plus,
  for onsite/hybrid gigs, profiles within 50 km (`$nearSphere`); banned, inactive and (when
  `REQUIRE_EMAIL_VERIFICATION` is on) unverified accounts are excluded.
- **Career coach:** `Qwen/Qwen2.5-72B-Instruct` via HF Inference Providers with automatic provider
  routing (it is served by featherless-ai and deepinfra, not by `hf-inference`). Without a working
  token the keyword-based report is returned with `source: 'fallback'` and the UI labels it.
  The token must be a fine-grained token with the *Make calls to Inference Providers* permission.
- **Trending skills:** skill counts on gigs from the last 30 days vs the previous 30, with growth %,
  cached for an hour (`GET /search/trending-skills`).

## Negotiated price and milestones (module 5 → 7)

The amount the client pays is the **agreed price**: the last counter-offer, or the original bid.
When a fixed-price proposal is accepted and the gig's milestones add up to something else, each
milestone is scaled proportionally to the agreed price (rounded to the paisa, remainder on the last
milestone), so the client is never charged the originally posted amounts. Hourly bids are a rate,
not a total, so they leave milestones unchanged. Checkout (`POST /payments/orders`) also refuses any
milestone that would push the funded total past the agreed price.

## Reputation score (module 8)

Code: `server/src/services/reputationService.ts` (`REPUTATION`, `computeReputation`). Stored as
`reputationScore` (0–100) on freelancer and client profiles and recalculated after every review,
dispute resolution, gig completion/cancellation and verification change.

| Part | Formula |
|---|---|
| Rating | Bayesian mean of visible review ratings ÷ 5, with a prior of 5 reviews at the platform mean. Each rating is already category-weighted (quality 30 %, communication 20 %, timeliness 20 %, professionalism 15 %, value 15 %); reviews older than 12 months count 50 % |
| Completion | `(completed + 2 × 0.8) ÷ (completed + failed + 2)`: two pseudo-jobs at 80 % so new users aren't punished |
| Failed | cancelled gigs + lost disputes + 0.5 × split disputes. The freelancer loses a dispute resolved with a refund, the client one resolved with a release; a split counts as half a failure for both |
| Score | `100 × (0.75 × rating + 0.25 × completion)`, +5 for verified freelancers, capped at 100 |
