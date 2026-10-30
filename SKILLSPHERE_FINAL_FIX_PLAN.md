# SkillSphere — Final Fix & Finish Plan (for Claude Code)

> **Instruction to Claude Code:** This file is your work order for the last stretch of the project. It
> supersedes the open items in `CLAUDE_CODE_PLAN.md` (Phases 0–4 there are done; only Phase 5 is open).
> Read §0 first, then work through §3 **in priority order** (P0 → P4). Tick each checkbox and commit
> as you finish it, so a later session can resume. Every finding below was checked against the code on
> 2026‑10‑29; file:line references are from that snapshot and may drift slightly as you edit.

---

## 0. Ground rules

### 0.1 Project facts
- Monorepo: `client/` (React 19, Vite 6, TS, Tailwind 4, Redux Toolkit, React Query, socket.io-client) and
  `server/` (Express 4, TS, Mongoose 9, Socket.IO 4, zod 4). The root `.env` is read by the server.
- Dev: `npm run dev` at the root → API on `:5000`, Vite on `:5173` (proxies `/api` and `/socket.io`).
- Response shape everywhere: `{ success, message, data?, pagination? }`. Keep it.
- Controllers: `async (req, res, next) => { try {…} catch (e) { next(e) } }`, services throw `HttpError`.
- **When you add a route:** add a case to `server/tests/routes.smoke.test.ts` and an entry in
  `server/src/docs/openapi.ts` (tests enforce both). RBAC changes also go in `tests/rbac.matrix.test.ts`.
- UI language: the dark "glass" style in `client/src/index.css`; reuse components in `client/src/components/**`.

### 0.2 Safety rules
1. Never commit `.env` or any real key. Never print `.env` values into the transcript.
2. Never point tests, seeds or experiments at the Atlas `MONGO_URI` in `.env`. For manual runs use
   `MONGO_URI=mongodb://127.0.0.1:27017/skillsphere_dev`. Automated tests use `mongodb-memory-server`.
3. Razorpay **test mode** only. Do not fabricate any API key; everything must degrade gracefully (503 +
   disabled UI + one boot warning) when a key is missing.
4. Do not push, deploy, or create cloud accounts without the user's explicit go-ahead (see §3 P4).

### 0.3 Workflow per item
1. Make the change. 2. Run, in the package(s) you touched: `npm run lint`, `npm run typecheck`,
`npm test`. 3. Add or extend a test for every behaviour change (server: Jest + Supertest; client: Vitest).
4. One Conventional Commit per item (`fix(payments): …`). 5. Tick the box here.

### 0.4 Definition of done
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass in **both** packages, and
  `npm run e2e` passes in `client/`. CI on GitHub is green.
- Every P0–P2 item below is fixed with a test; P3 cleanup is done; P4 is done or explicitly handed back
  to the user (keys, deploy accounts).
- The §9 demo script in `CLAUDE_CODE_PLAN.md` works in a browser on a fresh local DB **and** the live demo.

---

## 1. Where the project stands

### 1.1 Health check (run 2026‑10‑29 on the working tree, including uncommitted changes)

| Check | Server | Client |
|---|---|---|
| `typecheck` | ✅ 0 errors | ✅ 0 errors |
| `lint` | ✅ clean | ❌ **1 error** (`e2e/helpers.ts:30`, see P0‑1) + 4 warnings |
| `test` | ✅ 35 suites / 446 tests | ✅ 5 files / 24 tests |
| `build` | ✅ | ✅ (warning: main chunk 631 kB, see P3‑9) |
| e2e (last run on disk) | — | ✅ passed (`client/test-results/.last-run.json`, 2026‑10‑27) |

Git: `main` is **67 commits ahead of `origin/main`** (github.com/rachitgrg/SkillSphere) and has an
**uncommitted security pass** (CSP, `COOKIE_SAMESITE`, CSRF origin check, `VITE_API_URL`,
`server/tests/security.test.ts`). The public GitHub repo therefore shows a much older, broken version.

### 1.2 Spec coverage (Nayoda PDF → code)

Legend: ✅ done · 🔑 done but runs in fallback mode until the user supplies a key · ⚠️ done with a bug
listed in §3 · ⬜ not done

| # | Module | Spec feature | Status | Where / note |
|---|---|---|---|---|
| 1 | Auth | Roles client / freelancer / admin | ✅ | `types/index.ts` `UserRole`; admin can't self-register |
| | | JWT auth (access + rotating refresh cookie) | ⚠️ | P1‑3 (one session per user, refresh race) |
| | | RBAC | ✅ | `middleware/rbac.ts`, `tests/rbac.matrix.test.ts` |
| | | Google OAuth | 🔑⚠️ | `config/passport.ts`; P0‑3 (2FA bypass), P2‑9 |
| | | Email verification | ✅ | `accountService.ts`; Ethereal inbox in dev |
| | | Password reset with token | ✅ | hashed 1 h token |
| | | 2FA (TOTP + backup codes) | ⚠️ | P0‑3, P2‑10 |
| 2 | AI matching | Hugging Face matching | 🔑 | `aiMatchingService.ts`, `embeddingService.ts` (MiniLM); HF token rejected → fallback |
| | | Skill similarity scoring | ✅ | weighted score, README table |
| | | Personalised recommendations | ✅ | `/ai/recommendations` |
| | | Trending skills | ✅ | `/search/trending-skills` |
| | | "Top freelancers near the location" | ✅ | `$nearSphere` candidates, proximity weight |
| 3 | Profiles | Skills + proficiency, portfolio, resume, certifications, work timeline, availability calendar, hourly & milestone pricing, verification badge | ✅ / 🔑 | uploads need Cloudinary; portfolio accepts image URLs as fallback |
| 4 | Marketplace | Budget ranges, milestones, attachments, invites, progress tracking; apply, proposals, application status | ⚠️ | P1‑5 (edit after approval) |
| 5 | Proposals | Description, bid, estimated time; accept / negotiate / reject | ⚠️ | P0‑4 (negotiated price never reaches milestones), P2‑4 |
| 6 | Chat | Instant messaging, file sharing, typing, read receipts, WebRTC video | ⚠️ | P1‑2 (socket dies after token expiry), P1‑7, P3‑11 (no TURN) |
| 7 | Payments | Escrow, milestone payments, automatic payout, refunds, history | 🔑⚠️ | `SIMULATE_PAYMENTS=true` without Razorpay keys; P1‑4, P2‑1…P2‑3. Payouts are simulated (no RazorpayX) — document it |
| 8 | Reputation | Weighted score, verified reviews, fake-review detection, analytics | ⚠️ | **P0‑2** (every real review hidden in dev/prod) |
| 9 | Admin | Users, suspend, verify, approve gigs, payment monitoring, fraud; revenue, active freelancers, top categories, job success | ⚠️ | P2‑5, P2‑6 |
| 10 | Search | Location, skill, price, rating, experience; Atlas Search option | ✅ | `searchService.ts`, `docs/atlas-search-index.json`. Elasticsearch (optional) ⬜ — leave as roadmap |
| 11 | Notifications | Socket.IO + email; new gig, proposal accepted, payment received, review added | ✅ | per-category preferences |
| 12 | Scheduler | Slots, bookings, auto-scheduling | ✅ | `scheduleService.ts` with locks |
| 13 | Disputes | Request, admin mediation, evidence upload, resolution | ✅ / 🔑 | evidence needs Cloudinary |
| 14 | Progress tracker | % complete, file uploads, logs, deadline reminders | ✅ | `projectService.ts`, cron in `jobs/scheduler.ts` |
| 15 | Freelancer analytics | Profile views, applications, earnings, monthly chart, feedback | ✅ | `analyticsController.ts` |
| — | Stack | React Query, Redux Toolkit, Tailwind, Socket.IO, Cloudinary, Nodemailer, Redis (opt.) | ✅ | Redis optional with in-memory fallback |
| — | Collections | Users, Freelancers, Clients, Gigs, Proposals, Reviews, Messages, Payments, Notifications, Disputes, AdminLogs | ✅ | plus Conversation, Booking, ProfileView, Lock |
| — | Phase 5 | Security pass | ⚠️ | uncommitted; finish with P0‑1, P1‑1 |
| — | Phase 5 | Deployment (Render/Railway + Vercel/Netlify) | ⬜ | P4‑2 |
| — | Phase 5 | Full README | ⬜ | P4‑3 (current README is a stub that says "written in Phase 5") |
| — | Phase 5 | `.env.example` complete | ⚠️ | P3‑1 |

**Bottom line:** the feature work is essentially complete and well tested. What is left is (a) a handful
of real logic bugs that would show up in a live demo, (b) production hardening for deployment, (c) dead
code cleanup, and (d) the resume packaging: push, deploy, README, screenshots.

---

## 2. Keys and decisions only the user can provide

Ask the user for these; never invent them. Everything works without them in fallback mode.

| Need | Used by | Without it |
|---|---|---|
| Razorpay **test** key id + secret (+ webhook secret) | module 7 | `SIMULATE_PAYMENTS=true` (dev only) |
| Cloudinary cloud name / key / secret | resume, portfolio, attachments, chat files, evidence | upload routes 503, UI disabled |
| Google OAuth client id/secret + redirect `…/api/v1/auth/google/callback` | Google login | button hidden |
| Hugging Face **fine-grained** token with "Make calls to Inference Providers" | embeddings + career coach | keyword fallback, labelled `source: 'fallback'` |
| SMTP (optional) | real emails | Ethereal preview links in the server log |
| Hosting accounts (Render/Railway, Vercel/Netlify, Atlas network access) | P4‑2 | — |

---

## 3. Work items

### P0 — Blockers (CI red, security holes, demo-breaking bugs)

- [x] **P0‑1 Finish and commit the in-progress security pass; make client lint pass.**
  - `client/e2e/helpers.ts:30` — Playwright's fixture callback parameter `use` trips
    `react-hooks/rules-of-hooks`, so `npm run lint` fails and CI will be red. Fix by renaming the
    parameter (e.g. `async ({ context }, provide) => … await provide(context)`), or by scoping the
    react-hooks rule to `src/**` in `client/eslint.config.js`.
  - Also clear the 4 `react-refresh/only-export-components` warnings: move `currentOffer`, `lastOfferBy`,
    `useAcceptOffer` out of `components/proposals/Negotiation.tsx` into `components/proposals/negotiation.ts`,
    and the non-component export at `pages/auth/AuthFlowPages.tsx:25` into a small module.
  - Review the uncommitted diff (`git diff`), run all checks, and commit it as
    `feat(security): CSP, SameSite option, CSRF origin check, configurable API URL`.
  - Acceptance: `npm run lint` clean in both packages; `server/tests/security.test.ts` passes.

- [x] **P0‑2 Every genuine review is hidden as "fraud" (shared-IP signal).**
  - `server/src/services/reputationService.ts:159` treats "reviewer and reviewee share `lastLoginIp`"
    as a **strong** signal. Locally everyone logs in from `::1`/`127.0.0.1`; in production without
    `trust proxy` (P1‑1) `req.ip` is the load balancer's IP for everyone. Result: the review in §9 step 9
    is stored with `isVisible: false`, the reputation score never updates, and the admin fraud page
    lists every user as sharing one IP (`adminController.ts` `getFraudReport`).
  - Fix: ignore loopback, private (RFC 1918, `fc00::/7`), and link-local addresses for this signal
    (add `isPublicIp()` in `server/src/utils/`), and downgrade shared IP to a **weak** signal. Apply the
    same filter to the shared-IP section of `getFraudReport`.
  - Tests: two users who both logged in from `127.0.0.1` → review visible; two users on `203.0.113.9`
    plus a short comment → flagged.

- [x] **P0‑3 Google sign-in bypasses 2FA.**
  - `server/src/controllers/accountController.ts:172` (`googleCallback`) calls `startSession` even when
    `user.twoFactorEnabled`. A password account with 2FA that later links Google (passport links by
    email, `config/passport.ts:46`) can log in with Google and skip the second factor.
  - Fix: when `twoFactorEnabled`, issue `accountService.issueTwoFactorChallenge(user)` and redirect to
    `${CLIENT_URL}/2fa?tempToken=…` (use a short-lived one-time code in the URL rather than the raw
    token if you prefer; never put the access token in the URL). Update `OAuthCallbackPage`/`TwoFactorPage`.
  - Test: user with 2FA + googleId → callback redirects to `/2fa`, no refresh cookie set.
  - Done as: the challenge travels in a 5‑min httpOnly cookie scoped to `/api/v1/auth/2fa` (no token in
    the URL); the callback redirects to `/2fa?via=google`, and `/2fa/verify` takes `tempToken` from the
    body or that cookie (now behind `requireTrustedOrigin`).

- [x] **P0‑4 The negotiated price is never what the client pays.**
  - `proposalController.ts:163` copies the proposal's milestones only when the gig has none, and
    `paymentService.ts:102` charges `milestone.amount`. So when the gig was posted with milestones
    (the normal case, and §9 step 3), a counter-offer changes `finalAmount` but the client still pays
    the original milestone amounts. The lump-sum path (`paymentService.ts:~125`) does check
    `finalAmount`, so the two paths disagree.
  - Fix (pick one and document it in the README):
    1. On accept, if `finalAmount` ≠ sum of gig milestone amounts, **scale** the milestone amounts
       proportionally (round to 2 dp, put the rounding remainder on the last milestone); or
    2. On accept, if the proposal has its own milestones, **replace** the gig's pending milestones with
       them, and refuse to accept while the totals differ (the UI shows why).
  - Also enforce in `createOrder` that funded milestones + the new amount never exceed the agreed amount.
  - Tests: gig with 2 × ₹10 000 milestones, freelancer bids ₹16 000, accept → milestones total ₹16 000
    and `createOrder` charges the new amounts.
  - Done as option 1 (scale), fixed-price gigs only (an hourly bid is a rate). Documented in the README
    ("Negotiated price and milestones"); the hire dialog tells the client when milestones will be scaled.

### P1 — Real bugs (wrong behaviour in normal use)

- [x] **P1‑1 Production behind a proxy: `trust proxy`, rate limits, IPs.**
  - `server/src/app.ts:36` never sets `app.set('trust proxy', …)`. On Render/Railway, `req.ip` is the
    proxy, so **all users share one rate-limit bucket** (`apiLimiter` = 60 req/min,
    `rateLimiter.ts:33`) and the site 429s with a handful of users; express-rate-limit also logs
    `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`; `lastLoginIp`, profile-view dedup and admin logs record the proxy IP.
  - Fix: `TRUST_PROXY` env (number of hops, default `0` in dev, `1` in production docs); set it before
    the limiters. Raise `apiLimiter` to something an SPA survives (e.g. 300/min per IP) and keep the
    strict `authLimiter`.
  - Client side of the same problem: `client/src/main.tsx:16` uses `new QueryClient()` defaults
    (`staleTime: 0`, refetch on focus, 3 retries even on 4xx). Set
    `defaultOptions.queries = { staleTime: 30_000, retry: (n, e) => n < 2 && !(status 4xx) }`.
  - Test: with `TRUST_PROXY=1`, two different `X-Forwarded-For` values get separate limits.

- [x] **P1‑2 Real-time dies after the access token expires.**
  - `client/src/contexts/SocketContext.tsx` passes the in-memory access token (15 min) in the handshake.
    After any disconnect (laptop sleep, Wi-Fi blip, server restart) more than 15 min after the last API
    call, the server middleware (`server/src/config/socket.ts` `io.use`) rejects the stale token with
    `Invalid token`, and socket.io does **not** retry middleware rejections. Chat, notifications and
    calls stop until a full page reload. There is no `connect_error` handler.
  - Fix: on `connect_error` with an auth message, `await refreshAccessToken()` then `s.connect()`
    (cap retries; on refresh failure dispatch logout). Server: also disconnect sockets of users whose
    token expired is optional; at minimum keep the ban check.
  - Test (Vitest): mock socket emits `connect_error('Invalid token')` → refresh called → `connect()` called.

- [x] **P1‑3 Only one session per user, and parallel refreshes log the user out.**
  - `User.refreshToken` (`models/User.ts:141`) is a single hash. Logging in on a phone silently
    invalidates the laptop's session; and the reuse check (`authController.ts:159`) treats an
    already-rotated token as theft and wipes the session. Two tabs refreshing at the same moment
    (both open on load, or both hitting a 401 at the 15‑min mark) → one rotates, the other presents
    the old cookie → both tabs are logged out.
  - Fix: store sessions as an array `refreshSessions: [{ hash, family, expiresAt, userAgent, createdAt }]`
    (cap ~10, drop expired). Reuse of a rotated token revokes **that family only**, and accept the
    previous token for a ~30 s grace window after rotation (return the current pair instead of revoking).
    Logout removes the current session; change-password / reset-password / suspend revoke all.
    Add a `db:migrate` step that drops the old field.
  - Tests: login on two "devices" → both refresh; two concurrent refreshes with the same cookie → both 200;
    replay of a token rotated > 30 s ago → only that family revoked.
  - Done in `services/sessionService.ts`. In the grace window the server returns an access token and
    sets no cookie (the browser already holds the newer one). `chooseRole` now issues only an access
    token. Run `npm run db:migrate` once per database (drops `User.refreshToken`; signs users out once).

- [x] **P1‑4 Same milestone can be funded twice.**
  - `paymentService.ts:105–118`: `Payment.findOne({ …status: { $in: [ESCROW, RELEASED, DISPUTED, PENDING] } })`
    returns *any* match. If a pending order exists next to an escrowed one, the check sees the pending one
    and lets checkout continue. Two concurrent "Fund" clicks also create two pending orders, both payable.
  - Fix: check active statuses separately from pending; add a partial unique index
    `{ gig: 1, milestone: 1 }` where `status ∈ {pending, escrow, disputed, released}` (put it in
    `scripts/lib/indexes.ts` + model), and catch E11000 to return the existing order. When a milestone is
    escrowed, mark other pending orders for it `failed`/`cancelled`.
  - Also: `cancelGig` (`gigController.ts`) should mark the gig's pending orders cancelled, and
    `markEscrowed` should refuse (and auto-refund) a capture that arrives for a cancelled gig.
  - Tests: concurrent `createOrder` for one milestone → one order; escrowed milestone → 409.
  - Done: new `PaymentStatus.CANCELLED` (P2‑2 can reuse it). A capture for a cancelled order/gig, or
    for a milestone already funded, is refunded automatically. On existing DBs run `npm run db:migrate`
    (cancels duplicate pending orders) **before** `npm run db:sync-indexes`.

- [x] **P1‑5 Approved gigs can be edited without re-approval.**
  - `gigController.ts:186` lets the client change title/description/skills/budget of an **open**
    (already approved) gig, and it stays public. Approval can be bypassed by posting something benign
    and editing it afterwards.
  - Fix: when content fields change on an `open` gig, move it back to `pending_approval` (notify the
    client and admins), or restrict open-gig edits to non-content fields (deadline, visibility). Also add
    `requireVerified` to the update route for consistency with create.
  - Test: edit title of an open gig → status `pending_approval`, hidden from `/gigs`.
  - Done: every editable field except `deadline`/`visibility` triggers re-approval (compared by value);
    re-approving an edited gig doesn't resend invitations or "new matching gig" notifications.

- [x] **P1‑6 Direct "release" leaves milestones inconsistent.**
  - `POST /payments/:id/release` (`paymentRoutes.ts:40`) releases a milestone's escrow regardless of the
    milestone's state, so the payment is `released` while the milestone stays `funded`/`in_progress`;
    the progress bar and auto-complete logic then disagree.
  - Fix: for payments with a `milestone`, route release through `projectService.approve` (or reject with
    409 "Approve the milestone instead"); keep direct release only for lump-sum payments.

- [x] **P1‑7 Any socket handler error kills the whole server.**
  - `server/src/server.ts:54` shuts the process down on `unhandledRejection`, and several async socket
    handlers have no `try/catch` (`sockets/chatSocket.ts:74` `messages_read`, `join_conversation`,
    every handler in `sockets/callSocket.ts`). One DB hiccup during a read receipt restarts the API and
    drops every connection.
  - Fix: wrap every socket handler with a `safeHandler(fn)` that catches, logs and acks
    `{ ok: false }`. Change `unhandledRejection` to log with stack and keep running (exit only on
    `uncaughtException`), and log `err.stack`, not just `name`/`message`.

### P2 — Logic flaws and correctness (visible in analytics, edge cases)

- [x] **P2‑1 Revenue counts money still in escrow.** `paymentService.ts:510` and `:545`
  (`calculatePlatformRevenue`, `getRevenueByMonth`) sum fees for `released` **and** `escrow`; escrow can
  still be refunded. Count `released` only, group by `releasedAt`. `getRevenueByMonth` is unused — delete
  it (P3‑3). Check the admin page that uses `calculatePlatformRevenue` (`adminController.ts:463`).
- [x] **P2‑2 Refunding a pending payment is recorded as "refunded".** `paymentService.ts:340` — a
  `pending` payment never captured money; mark it `cancelled` (add the status) so the refunded totals and
  CSV export are not inflated.
- [x] **P2‑3 `payment.captured` vs auto-capture.** `createOrder` doesn't pass `payment_capture`.
  If the Razorpay account is on manual capture, "verified" payments are only *authorized* and auto-refund
  after a few days. Either capture in `verifyAndEscrow`/webhook (`razorpay.payments.capture`) when the
  status is `authorized`, or document "enable auto-capture in the dashboard" in the README.
- [ ] **P2‑4 Freelancer "accepting" a counter is a fake counter.** `Negotiation.tsx:90` accepts by
  posting the same amount as a new counter-offer. Add an explicit `POST /proposals/:id/accept-offer`
  (freelancer only, last offer must be the client's) that records `agreedAt` and keeps status
  `negotiating`, and show "Freelancer agreed to ₹X — hire now" on the client side.
- [ ] **P2‑5 Job success rate double counts.** `adminController.ts:137` adds every gig that *ever* had a
  dispute to "unsuccessful", even when it was later completed (it is then in both buckets). Count a gig
  once by its final outcome (completed / cancelled / completed-after-lost-dispute).
- [ ] **P2‑6 Admin payment summary is empty.** `paymentController.ts:177` maps admin to the freelancer
  branch, so `/payments/summary` shows zeros for admins. Return platform-wide totals for admins.
- [ ] **P2‑7 Gig views are inflated.** `gigController.ts:148` increments `views` on every fetch,
  including the owner, admins and React Query refetches. Count only non-owner viewers, deduplicated per
  viewer per day (reuse `profileViewService`'s approach).
- [ ] **P2‑8 Proposal acceptance is not atomic.** `proposalController.ts` claims the gig
  (`in_progress`) before saving the proposal and rejecting the others; an error in between leaves a gig
  in progress with a pending proposal. Use a Mongo transaction (`session.withTransaction`) — Atlas and
  `mongodb-memory-server` replica-set mode support it — or reorder so the failure is recoverable.
- [ ] **P2‑9 Google account linking trusts any email.** `config/passport.ts:46` links Google to an
  existing account by email without checking `profile.emails[0].verified`; also there is no OAuth
  `state` (login CSRF). Require `verified === true` and pass `state: true` (or a signed nonce cookie).
  Delete the unused `serializeUser`/`deserializeUser` (sessions are disabled).
- [ ] **P2‑10 TOTP codes can be replayed.** `accountService.checkSecondFactor` accepts the same code
  again within the ±1 step window. Store the last used time-step on the user and reject reuse.
- [ ] **P2‑11 Presence leaks every online user id.** `config/socket.ts:60–61` broadcasts presence to
  everyone and sends the full online list on connect. Limit presence to users who share a conversation
  (emit to their `user:` rooms) or to the chat contacts list.
- [ ] **P2‑12 Gig skill filter is case-sensitive.** `services/gigQuery.ts` `filter.skills = { $in: skills }`
  while freelancer search is case-insensitive. Use anchored case-insensitive regexes like
  `searchService.ts`, or normalise skills to a canonical case on save.
- [ ] **P2‑13 Two sources of truth for location.** Both `User.location` and `FreelancerProfile.location`
  exist (`updateProfileSchema` and `updateFreelancerProfileSchema` both accept `location`). Matching/search
  use the profile. Pick one (profile for freelancers), make the other derived or remove it, and migrate.
- [ ] **P2‑14 Lost-dispute reputation ignores splits.** `reputationService.ts` counts only
  `refund`/`release`. Decide how a `split` counts (e.g. half a failure for both) and document the formula.

### P3 — Cleanup: dead code, unused files, config gaps

- [ ] **P3‑1 `.env.example` is incomplete / stale.** Missing: `COOKIE_SAMESITE`,
  `TWO_FACTOR_ENCRYPTION_KEY`, `TRUST_PROXY` (new), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
  `SEED_DEMO_PASSWORD`, and a client section with `VITE_API_URL` (create `client/.env.example`).
  `ADMIN_EMAIL` is declared in `server/src/config/env.ts:78` and the example but **never used** — remove
  it or use it (e.g. admin alert emails).
- [ ] **P3‑2 Dead server helpers.** Unused exports — delete them (and their tests if any):
  - `utils/helpers.ts`: `generateRandomToken`, `isValidObjectId`, `slugify`, `sanitizeInput`,
    `calculatePercentageChange`, `getDateRange`; also `parsePaginationParams` returns a `sort` built from
    an arbitrary `sortBy` query param — remove that field (nothing uses it, and it would allow sorting by
    any field).
  - `middleware/rateLimiter.ts`: `generalLimiter`. `middleware/rbac.ts`: `isOwnerOrAdmin`.
  - `middleware/auth.ts`: the `req.cookies.accessToken` branches (no such cookie is ever set).
  - `utils/validators.ts`: `idParamSchema`, `searchSchema`, `sendMessageSchema`
    (`sendMessageSchema` duplicates the socket schema), `loginSchema.twoFactorCode` (unused field).
  - `types/index.ts`: `ApiResponse`, `DashboardStats`, `SearchFilters`, `MatchScore` if unreferenced.
- [ ] **P3‑3 Dead payment-service methods.** `paymentService.getRevenueByMonth`, `getPaymentsForUser`,
  `getPaymentsByGig` are never called. Delete. `processPayouts` returns `queued.length` instead of the
  number actually processed — return the processed count.
- [ ] **P3‑4 Duplicate, unescaped email templates.** `services/emailService.ts` has six unused methods
  (`sendProposalNotification`, `sendProposalStatusEmail`, `sendPaymentNotification`,
  `sendDisputeNotification`, `sendReviewNotification`, `sendWelcomeEmail`) that interpolate user text
  into HTML **without escaping**; `utils/sendEmail.ts` has unused `sendGigNotificationEmail`. Delete
  them; keep `sendNotificationEmail` (escaped) and the verification/reset emails. Make sure the
  verification/reset templates escape `firstName` too.
- [ ] **P3‑5 Dead client state.** `store/slices/uiSlice.ts`: `sidebarOpen`, `theme`, `activeModal`,
  `modalData`, `searchQuery` and their actions (`toggleSidebar`, `setSidebarOpen`, `setTheme`,
  `openModal`, `closeModal`, `setSearchQuery`) are unused. `authSlice.ts`: `loadUser` thunk unused.
  Remove, and update `authSlice.test.ts`.
- [ ] **P3‑6 Unused client devDependencies.** `@testing-library/dom` (pulled in by RTL anyway) and
  `@types/node` are not imported — `@types/node` *is* needed by `vite.config.ts` (`path`, `__dirname`),
  so keep it; remove `@testing-library/dom` only if `npm test` still passes. Run `npx depcheck` in both
  packages and act on real findings.
- [ ] **P3‑7 Fake marketing content on the landing page.** `pages/public/LandingPage.tsx:35–47` shows
  invented numbers ("12,500+ freelancers", "10,000+ happy clients", "50,000+ projects") and a
  "trusted by" row (`:73–79`) that includes **a real company name (zomentum)**. For a portfolio project
  this reads as fabricated. Replace with live counts from a new public, cached endpoint
  (`GET /api/v1/config/stats`: open gigs, verified freelancers, completed projects, categories) or
  remove the section; drop the logo row.
- [ ] **P3‑8 Repo leftovers.** Ensure these stay untracked (they are ignored, just delete locally):
  `client/dist`, `server/dist`, `client/test-results`, `server/tsconfig.tsbuildinfo`; delete the empty
  `.agents/` folder. Root `package.json` only exists for `concurrently` — keep it, but add `"test"`,
  `"lint"`, `"build"` scripts that run both packages. Move `AUDIT_REPORT.md` and `CLAUDE_CODE_PLAN.md`
  (and this file, once finished) into `docs/dev-notes/` so the repo root is clean for recruiters.
- [ ] **P3‑9 Bundle size.** The main chunk is 631 kB (`npm run build` warning). Check what lands in it
  (`npx vite-bundle-visualizer`): likely `framer-motion` used on the landing page and `recharts` pulled
  into eagerly imported components. Lazy-load the landing animations and chart components, add
  `build.rollupOptions.output.manualChunks` for `react`, `recharts`, `framer-motion`. Target < 300 kB.
- [ ] **P3‑10 OG image must be absolute.** `client/index.html:14` uses `/og-image.png`; social crawlers
  need an absolute URL. Inject it at build time from `VITE_PUBLIC_URL` (or the deploy URL).
- [ ] **P3‑11 WebRTC needs TURN to work across networks.** `contexts/CallContext.tsx:10` has STUN only;
  calls fail behind symmetric NAT / mobile networks. Make ICE servers configurable
  (`VITE_TURN_URL/USERNAME/CREDENTIAL`) and document the limitation if no TURN is supplied.
- [ ] **P3‑12 Chat file URL check is too loose.** `sockets/chatSocket.ts` accepts any
  `https://res.cloudinary.com/…` URL; restrict to `https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/`.
- [ ] **P3‑13 Delete cleans up nothing.** `deleteGig` removes the gig and proposals but not its Cloudinary
  attachments, and does not decrement `ClientProfile.postedGigs`. Fix both.
- [ ] **P3‑14 Health check is shallow.** `/health` always says OK. Report `mongoose.connection.readyState`
  (503 when not connected) so the host restarts a broken instance.

### P4 — Ship it (resume packaging)

- [x] **P4‑1 Push the work.** After P0, ask the user before running `git push origin main` (67+ commits).
  Confirm the CI badge goes green on GitHub. Make sure no secrets are in history (`git log --all -- .env`
  is empty today; keep it that way).
  - Done 2026‑10‑29: pushed `0047175..c5ef92e` (72 commits) after stripping the Claude co-author
    trailers at the user's request; CI (client, server, e2e) green. Commits carry no attribution lines.
- [ ] **P4‑2 Deploy (needs the user's accounts — ask first, do not sign up for anything).**
  - API on Render or Railway: `render.yaml` (build `npm ci && npm run build`, start `npm start`,
    health check `/health`, `NODE_ENV=production`, `TRUST_PROXY=1`, `COOKIE_SAMESITE=none` when the SPA is
    on another site, `CLIENT_URL=<spa url>`). MongoDB Atlas network access for the host.
  - SPA on Vercel or Netlify: `vercel.json` / `netlify.toml` with SPA rewrites, `VITE_API_URL=<api url>`.
  - Seed the live DB with the demo data (`npm run seed` with the Atlas URI, only with the user's OK; the
    script refuses non-localhost URIs without `--force`).
  - Keep `SIMULATE_PAYMENTS` off in production (the server refuses it); use Razorpay **test** keys so the
    live demo can run checkout with test cards.
  - Smoke-test the §9 demo on the live URL and note anything that only fails there.
- [ ] **P4‑3 Write the real README** (the current one says "written in Phase 5"): one-paragraph pitch,
  live demo link + demo accounts, screenshots/GIF (capture with Playwright into `docs/screenshots/`),
  Mermaid architecture diagram, features mapped to the 15 modules, tech stack, local setup, env-var table
  (server + client), seed, testing (unit/integration/e2e counts), API docs link (`/api/docs`), AI matching
  and reputation formulas (already partly in README), payment/escrow flow diagram, known limitations
  (simulated payouts, STUN-only calls, fallback AI without a token, Elasticsearch not implemented),
  roadmap. Add CI and license badges.
- [ ] **P4‑4 Final verification.** Run the full §9 acceptance demo from `CLAUDE_CODE_PLAN.md` locally on a
  fresh DB and on the live deployment; run every check in §0.4; update the progress log; give the user a
  short summary with the live URL, demo accounts and anything still waiting on keys.

---

## 4. Things checked and found fine (don't "fix" these)

So you don't waste time re-auditing: escrow state machine and guarded transitions
(`projectService.ts`), auto-release / payout / reminder jobs (idempotent), Razorpay signature and webhook
verification (timing-safe, raw body), refund/split logic, mass-assignment whitelists (`pick(…EDITABLE)`),
regex escaping in search, socket membership checks, upload type/size checks and the
"multipart only when files are attached" behaviour (`api/request.ts` `withFiles` + `requireUploads`),
CSV export formula-injection guard, hashed refresh/reset/verification tokens, AES-GCM TOTP secrets,
seed safety, OpenAPI + route smoke tests, RBAC matrix, no mock data in pages, no stray `console.log` or
TODOs in `client/src`.

## 5. Progress log
*(Append one line per session: date, items done, what's next, blockers.)*

- 2026‑10‑29 — Plan written from a full audit. Nothing in §3 started yet.
- 2026‑10‑29 (session 1) — P0‑1…P0‑4 done (4 commits). Server 37 suites / 477 tests, client 6 files /
  27 tests, both lint/typecheck clean, e2e 7/7 on the production build with CSP checks. Next: P4‑1 push
  (waiting for the user's OK), then P1‑1.
- 2026‑10‑29 (session 1, cont.) — P1‑1…P1‑7 done; pushed through P1‑4 (CI green). Server 41 suites /
  498 tests, client 8 files / 34 tests, e2e 7/7. On any real DB run `npm run db:migrate` then
  `npm run db:sync-indexes` (P1‑3 session field, P1‑4 unique index). Next: P2‑1.
