# SkillSphere — Implementation Plan for Claude Code

> **Instruction to Claude Code:** This file is your work order. Read it fully, then read `AUDIT_REPORT.md` (same folder) for the evidence behind each bug. Execute the phases **in order**. This plan is the persistent memory for a multi‑session job. **Tick the checkboxes in this file as you finish each task and commit** so a later session can resume. Do not skip ahead to features while Phase 0–1 items are open.

---

## 0. Ground rules (read first)

### 0.1 Project facts
- Monorepo: `client/` (React 19 + Vite 6 + TS + Tailwind 4 + Redux Toolkit + React Query + socket.io‑client) and `server/` (Express 4 + TS + Mongoose 9 + Socket.IO 4).
- Root `.env` is read by the server (`server/src/server.ts` → `../../.env`). The client has no env yet.
- Dev: run `npm run dev` from the root. The server runs on `:5000`; Vite runs on `:5173` and proxies `/api` and `/socket.io` to `:5000` (`client/vite.config.ts`).
- Response shape used everywhere: `{ success: boolean, message: string, data?: T, pagination?: {...} }`. **Keep it.**
- Controllers use `async (req, res) => { try {…} catch {…} }`. You may introduce an `asyncHandler` plus the central `errorHandler`; if you do, convert files consistently.
- The UI design language is the existing dark "glass" style (`glass-card`, `btn-primary`, `btn-secondary`, `btn-ghost`, `focus-ring`, slate/indigo palette in `client/src/index.css`). **Reuse existing components** in `client/src/components/**` (Button, Input, Modal, Avatar, Badge, Tabs, Pagination, EmptyState, Spinner, StarRating, FileUpload, GigCard, ProposalCard, ReviewCard, MilestoneTimeline, TransactionCard, StatCard…) instead of writing new ones.

### 0.2 Safety rules
1. **Never commit `.env`** or any real key. `.env.example` must list every variable, with placeholders.
2. **Never point tests, seeds or experiments at the real `MONGO_URI` in `.env`** (it is MongoDB Atlas). For manual testing, override it: `MONGO_URI=mongodb://127.0.0.1:27017/skillsphere_dev`. A local `mongod` exists at `C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe`. For automated tests, use `mongodb-memory-server`.
3. Payments: **Razorpay test mode only**. Never use live keys.
4. External keys the user must supply: Razorpay test keys, Cloudinary, Google OAuth client, SMTP, and Hugging Face token. **Do not fabricate them.** Build every integration to **degrade gracefully** when its key is missing:
   - return HTTP 503 with a clear message
   - show a disabled state in the UI
   - log one warning at boot
   
   For email in development, use **Ethereal** (`nodemailer.createTestAccount()`) when SMTP is not configured, and log the preview URL.
5. The JWT secrets in the local `.env` are still the public placeholders. Generate strong random values (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), write them into the local `.env` only, and tell the user.
6. Do not run `server/scripts/seed-admin.js` as it is: it deletes every user. Replace it (Phase 1).

### 0.3 Workflow per task
1. Make the change.
2. Run `npx tsc --noEmit` in the package you touched. After Phase 0, also run `npm run lint` and `npm test`.
3. For backend behaviour, add or extend a Jest + Supertest test (infrastructure in Phase 1.0).
4. Commit with a Conventional Commit message, e.g. `fix(auth): block admin self-registration`. Use one commit per task, not one giant commit.
5. Tick the box here.

### 0.4 Definition of done (whole project)
- `npm run build` passes in `client/` and `server/`.
- `npm run lint` and `npm test` pass.
- The **end‑to‑end demo script in §9** works in the browser with no hardcoded/mock data left in pages.
- Every module in §1 is implemented, or explicitly marked optional and documented in the README.

---

## 1. Target specification (from the Nayoda internship PDF)

**Project:** *SkillSphere – Intelligent Hyperlocal Freelance Ecosystem*. A MERN platform connecting clients with **verified local** freelancers, with AI job matching, milestone payments, reputation scoring, real‑time collaboration, and admin analytics.

| # | Module | Required features |
|---|---|---|
| 1 | Multi‑role auth | Roles: Client, Freelancer, Admin. JWT auth · RBAC · Google OAuth login · Email verification · Password reset with token · Two‑Factor Auth (2FA) |
| 2 | AI job matching | AI matching algorithm for gigs (**Hugging Face**) · Skill similarity scoring · Personalized freelancer recommendations · Trending skills detection. *Example:* client posts "React Developer" → system recommends top freelancers **near the location**, best match by **rating + skill similarity** |
| 3 | Freelancer profiles | Skills with proficiency · Portfolio gallery · Resume upload · Certifications · Work experience timeline · Availability calendar · Hourly & milestone pricing · Verification badge system |
| 4 | Gig marketplace | Clients: create gigs with budget ranges, define milestones, attach documents, invite freelancers, track progress. Freelancers: apply, submit proposals, track application status |
| 5 | Proposals & bidding | Freelancer submits description, bid amount, estimated completion time. Client can accept, **negotiate price**, reject |
| 6 | Real‑time chat (Socket.IO) | Instant messaging · File sharing · Typing indicators · Read receipts · Video call (WebRTC, optional) |
| 7 | Secure payments (Razorpay/Stripe) | Escrow · Milestone payments · Automatic freelancer payout · Refund management · Transaction history |
| 8 | Reputation & reviews | Weighted reputation score · Verified reviews · Fraud detection for fake reviews · Review analytics |
| 9 | Admin dashboard | Manage users · Suspend accounts · Verify freelancers · Approve gigs · Payment monitoring · Fraud detection. Analytics: platform revenue, active freelancers, top categories, job success rate |
| 10 | Advanced search | Location‑based · Skill‑based · Price range · Rating · Experience filters. MongoDB Atlas Search (or Elasticsearch as an advanced option) |
| 11 | Notifications | Real‑time. Types: new gig posted, proposal accepted, payment received, review added. Socket.IO + email |
| 12 | Availability scheduler | Availability slots · Booking system · Automatic scheduling |
| 13 | Disputes | Dispute request · Admin mediation · Evidence upload · Resolution system |
| 14 | Progress tracker | Task completion % · File uploads · Progress logs · Deadline reminders |
| 15 | Freelancer analytics | Profile views · Gig applications · Earnings stats · Monthly revenue chart · Client feedback analytics |

**Stack:**
- React, Redux Toolkit, Tailwind, **React Query**, Socket.IO client
- Node, Express, MongoDB Atlas, Socket.IO, JWT
- Razorpay, **Cloudinary**, **Nodemailer**
- Redis (optional)

**Collections:** Users, Freelancers, Clients, Gigs, Proposals, Reviews, Messages, Payments, Notifications, Disputes, AdminLogs. All already exist; extend them, don't rename them.

---

## Phase 0 — Build health and tooling

- [x] **0.1 Fix `server/package.json`.**
  - Remove the duplicate keys: `morgan`, `express-mongo-sanitize` and `compression` in dependencies; `@types/morgan`, `@types/compression` and `@types/express-mongo-sanitize` in devDependencies.
  - Move `@types/cookie-parser` to devDependencies.
  - Replace `@types/express@^5` with `@types/express@^4.17.21` (runtime is Express 4).
  - Reinstall.
- [x] **0.2 Fix the server type errors (63).**
  - Root cause: `AuthRequest` handlers are not assignable to Express `RequestHandler`.
  - Preferred fix: augment Express globally in `server/src/types/express.d.ts` with `declare global { namespace Express { interface Request { user?: IUser } } }`, and make `AuthRequest` an alias of `Request` (or replace its usages).
  - Fix `adminController.ts:13-14` to use the `PaymentStatus` / `DisputeStatus` enums instead of string literals.
  - Fix `paymentController.ts:28` (null Razorpay; see 1.5).
  - Fix `authController.ts:163` (see 1.6).
  - Fix `models/Payment.ts` and `models/Review.ts` (see 1.3).
  - Check `utils/generateToken.ts`, `services/searchService.ts:*` and `services/aiMatchingService.ts:*` typing.
  - Goal: `npx tsc --noEmit` = 0 errors, and `npm run build && npm start` boots.
- [x] **0.3 Fix the client type errors (4).** `client/src/pages/client/ClientDashboard.tsx:27-28` and `client/src/pages/client/ProfilePage.tsx:27-28` pass `budget` as a string. These pages get rewritten in Phase 3; for now pass numbers. Goal: `npm run build` in `client/` passes.
- [x] **0.4 ESLint.**
  - Add `client/eslint.config.js` (flat config: `@eslint/js`, `typescript-eslint`, `react-hooks`, `react-refresh`; all already in devDeps).
  - Add ESLint + `typescript-eslint` to `server/` with a flat config, and change its `lint` script to `eslint src`.
  - Fix or justify the warnings.
- [x] **0.5 Delete scratch files.** Delete `fix-imports.js`, `fix-ts-errors.js` and `fix-ts-errors-2.js` from the repo root.
- [x] **0.6 Dependencies.**
  - Run `npm audit fix` (non‑breaking) in both packages.
  - Upgrade `multer` to `^2` and `nodemailer` to the patched major, adapting the code.
  - Re‑run `npm audit --omit=dev` and record the remaining issues in the README.
- [x] **0.7 Env loading and validation (fixes audit C4).**
  - Create `server/src/config/env.ts`. It loads `dotenv` from `path.resolve(__dirname, '../../../.env')`, validates with zod (required: `MONGO_URI`, `JWT_SECRET` ≥ 32 chars, `JWT_REFRESH_SECRET`, `CLIENT_URL`; the rest optional), and exports a typed `env` object.
  - Import it as the **very first line** of `server/src/server.ts`.
  - Replace scattered `process.env.X || 'fallback'` reads in security code with `env.X`. Remove the `'secret'` / `'refresh-secret'` fallbacks in `middleware/auth.ts`, `utils/generateToken.ts`, `sockets/*`, `config/socket.ts`.
  - Refuse to start when `NODE_ENV=production` and secrets equal the `.env.example` placeholders.
  - Generate real local secrets (rule 0.2.5).
  - Acceptance: a request with `Origin: http://localhost:5173` gets `Access-Control-Allow-Origin: http://localhost:5173`.
- [x] **0.8 Duplicate index warnings.** Remove the duplicate `schema.index()` calls for fields already `unique: true`: `User.email`, `ClientProfile.user`, `FreelancerProfile.user`. Make `User.googleId` `unique: true, sparse: true` and drop its extra index. Boot must print no Mongoose duplicate‑index warnings.

---

## Phase 1 — Fix bugs (security and correctness)

- [x] **1.0 Test harness (do this first).**
  - Add `jest`, `ts-jest`, `supertest`, `@types/jest`, `@types/supertest` and `mongodb-memory-server` to `server/` devDeps.
  - Add `jest.config.ts` and `server/tests/setup.ts` (start an in‑memory Mongo, connect mongoose, clear collections between tests).
  - Export `app` without listening (already the case in `app.ts`).
  - Add `npm test`.
  - **Every fix below gets a regression test.**

- [x] **1.1 Block admin self‑registration (C1).** Wire `validate(registerSchema)` from `utils/validators.ts` onto `POST /auth/register`. The schema already restricts `role` to `freelancer|client`. Also wire `loginSchema`. Wire the other schemas in `validators.ts` onto their routes as those routes are touched.
  - Test: `role:'admin'` → 400; weak password → 400.
- [x] **1.2 Never return secrets (C2).** In `models/User.ts`, add a `toJSON` transform that deletes `password`, `refreshToken`, `twoFactorSecret`, `passwordResetToken`, `passwordResetExpires`, `emailVerificationToken`, `emailVerificationExpires` and `__v`.
  - Test: register/login responses contain none of these keys.
- [x] **1.3 Mongoose 9 hooks (C3).** In `models/Payment.ts:74-81` and `models/Review.ts:64-78`, drop the `next` parameter and the `next()` call. In `Review.ts`, also make `rating` not `required` (the hook computes it) and compute it in `pre('validate')` so validation passes.
  - Test: create a Payment and a Review → saved; review rating equals the weighted formula.
- [x] **1.4 Razorpay module.**
  - Make `config/razorpay.ts` lazy: a `getRazorpay()` that reads `env` at call time and returns `null` if not configured.
  - Every payment route returns **503 "Payments not configured"** when it is null.
  - Remove the duplicated fee math in `paymentController.ts` (the model hook already computes `platformFee` / `freelancerAmount`).
  - Move payment logic into `services/paymentService.ts`, which already exists, and have controllers call it.
- [x] **1.5 Payment authorization (C5).**
  - `createPaymentIntent`: caller must be the gig's `client`; `freelancerId` must equal `gig.selectedFreelancer`; amount must equal the milestone amount (when `milestoneId` is given) or be within the accepted proposal amount; reject if a non‑refunded payment already exists for that milestone.
  - `verifyPayment`: payment must belong to the caller; compare signatures with `crypto.timingSafeEqual`.
  - Tests for each rejection.
- [x] **1.6 Refresh tokens (C6).**
  - Server: `refreshToken` must load the user with `.select('+refreshToken')` and use `generateAccessToken`. Rotate the refresh token on each refresh and store a **hash** of it, not the raw value.
  - Preferred: set the refresh token as an httpOnly, `sameSite=lax`, `secure`‑in‑prod cookie scoped to `/api/v1/auth`. The access token stays in memory/Redux, not `localStorage`.
  - Client `axiosInstance.ts`: on 401 (excluding `/auth/*`), call `/auth/refresh` once (single‑flight queue), retry the original request, and only log out if refresh fails.
  - `logout` must call `POST /auth/logout` and clear the cookie.
  - Test: refresh works; reuse of an old refresh token fails.
- [x] **1.7 Socket security (C7).**
  - Create one `io` instance in `config/socket.ts` (`initializeSocket(server)`) with a single auth middleware that rejects banned/inactive users. Use it from `server.ts` and delete the duplicate `io.use` in `sockets/chatSocket.ts` and `sockets/notificationSocket.ts`.
  - Personal room name is `user:<id>`, matching `notificationService`. Never let a client join it by event.
  - `join_conversation`: verify `Conversation.exists({_id, participants: userId})`, else emit an error.
  - `send_message`: payload `{conversationId, content, type?, fileUrl?, fileName?}`. Verify membership, **persist** via `Message.create`, update `conversation.lastMessage/lastMessageAt`, emit the saved, populated message to `conv:<id>`, and notify other participants on `user:<id>`.
  - Validate payloads with zod.
  - Test with `socket.io-client`: a non‑participant cannot join or receive.
- [x] **1.8 Mass assignment (C8).** Add a `pick(obj, allowedKeys)` helper (check `server/src/utils/helpers.ts` first).
  - `updateFreelancerProfile`: allow only `title, headline, skills, portfolio, certifications, workExperience, education, hourlyRate, availability, availabilitySlots, languages, socialLinks, location, milestonePricing` (new field, Phase 4).
  - `updateClientProfile`: allow only `companyName, companyWebsite, companySize, industry, description`.
  - `createGig` / `updateGig`: allow only `title, description, category, subCategory, skills, budgetType, budgetMin, budgetMax, duration, experienceLevel, milestones, attachments, location, locationType, visibility, tags, deadline`. `updateGig` is allowed only while status is `draft|pending_approval|open`.
  - `updateProfile` (user): also validate `location` as GeoJSON.
  - Tests: rating, earnings, status and views cannot be set by users.
- [x] **1.9 Regex crash (C9).** Add `escapeRegex()` to `utils/helpers.ts` and use it in `aiMatchingService.ts:21` and `:338`, and anywhere else `new RegExp(userInput)` appears.
  - Test: a gig with skills `["C++", "C#", "Node.js"]` returns 200.
- [x] **1.10 Freelancer text search (C10).** Add a text index on `FreelancerProfile` (`title`, `headline`, `skills.name`) or switch to an aggregate with `$lookup` to users plus a regex on the escaped query. Test `?q=react` → 200.
- [x] **1.11 Gig views and seeds (C11).**
  - `getGigById`: use `Gig.updateOne({_id}, {$inc:{views:1}})`, then fetch with `.lean()`.
  - Replace `server/scripts/seed-admin.js` and `seed-gigs.js` with one **non‑destructive** `server/scripts/seed.ts` (`npm run seed`). It:
    - refuses to run unless `MONGO_URI` points to localhost or `--force` is passed
    - upserts by email
    - takes credentials from env, with demo defaults documented in the README
    - creates 1 admin, 3 clients and 8 freelancers with real skills, proficiency, hourly rates and **GeoJSON locations** in a few Indian cities
    - creates ~16 gigs (move the content of `client/src/pages/gigs/GigListPage.tsx` `INITIAL_GIGS` here, with correct `budgetType` and owners = clients)
    - creates some proposals, one in‑progress gig with milestones, one completed gig with reviews, and payments in each state.
- [x] **1.12 Proposal logic.** In `createProposal`:
  - Gig must be `open`.
  - The freelancer is not the gig owner.
  - Duplicate submissions → 409 (catch E11000).

  In `updateProposalStatus`:
  - Validate `status ∈ {accepted, rejected, negotiating}`.
  - On accept, use a transaction or guarded update: only if `gig.selectedFreelancer` is empty. Set the gig `in_progress`, set `selectedFreelancer`, copy proposal milestones into the gig if the gig has none, auto‑reject the other pending proposals, and fire notifications.
  - Allow admin where the route allows admin, or remove admin from the route.
- [x] **1.13 Review rules.**
  - Reviewer must be the gig's `client` or `selectedFreelancer`.
  - Reviewee must be the *other* party; no self‑review.
  - The gig must be `completed`.
  - Run `reputationService.detectFraudulentReview` before saving. If it is suspicious, save with `isFlagged=true, isVisible=false` and log it for admin.
  - After saving, call `reputationService.updateUserReputation(revieweeId)` instead of the ad‑hoc average in `reviewController.ts:45-60`.
  - Fix the reply endpoint field name (`response`).
- [x] **1.14 Dispute rules.**
  - The creator must be the gig client or the selected freelancer; `against` is derived as the other party, not taken from the body.
  - `paymentId` must belong to that gig.
  - Admin `GET /disputes` returns all, with filters.
  - Resolve with `paymentAction: 'refund' | 'release' | 'split'`, calling `paymentService.refundPayment` / `releasePayment` (real Razorpay refund in test mode).
  - Write an `AdminLog` entry and notify both parties.
- [x] **1.15 Gig deletion.** Only `draft|open` gigs with no escrowed payments can be deleted. Cascade‑delete their proposals; otherwise return 409 and suggest cancelling. Add a `PUT /gigs/:id/cancel` endpoint.
- [x] **1.16 Misc.**
  - Apply `authLimiter` to login, register, forgot‑password, reset and 2FA.
  - Login rejects `isActive=false`.
  - Raise `express.json` limit to `1mb`.
  - Make `GET /gigs` and `GET /gigs/:id` public via `optionalAuth`. Public listing shows only `status=open, visibility=public`. Cap `limit` at 50.
  - Make `searchGigs` accept `skills` as an array or a comma string, and apply `budgetMin ≤ max && budgetMax ≥ min` overlap logic.
  - Wrap `LoginPage.tsx:25` / `RegisterPage.tsx:125` `.unwrap()` in try/catch.
  - Make currency **INR (₹)** everywhere in the UI. The gig form default `currency: 'USD'` and the `$` labels are wrong.
- [x] **1.17 Phase‑1 gate.** `npm test` green; tests exist for C1–C11 + 1.12–1.15. Commit.

---

## Phase 2 — Canonical API contract

Make the server expose exactly this API (paths relative to `/api/v1`), then rewrite every file in `client/src/api/*.ts` to match it. **Delete client API functions that have no server route** rather than leaving dead calls. Put shared request/response types in `client/src/types/index.ts`.

| Area | Method & path | Who | Notes |
|---|---|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `POST /auth/refresh` · `GET /auth/me` | — | login may return `{ twoFactorRequired: true, tempToken }` |
| | `GET /auth/verify-email/:token` · `POST /auth/resend-verification` | — | |
| | `POST /auth/forgot-password` · `POST /auth/reset-password/:token` · `PUT /auth/change-password` | — | |
| | `POST /auth/2fa/setup` (returns QR) · `POST /auth/2fa/enable` · `POST /auth/2fa/disable` · `POST /auth/2fa/verify` | auth / temp | |
| | `GET /auth/google` · `GET /auth/google/callback` | — | redirects to `CLIENT_URL/oauth/callback` |
| Users | `GET /users/me` · `PUT /users/me` · `POST /users/me/avatar` | auth | |
| | `GET /users/freelancers/:userId` (public profile, counts a view) · `PUT /users/freelancers/me` | public / freelancer | |
| | `POST /users/freelancers/me/resume` · `POST /users/freelancers/me/portfolio` · `DELETE /users/freelancers/me/portfolio/:itemId` | freelancer | Cloudinary |
| | `POST /users/freelancers/me/verification-request` | freelancer | |
| | `GET /users/clients/:userId` · `PUT /users/clients/me` | public / client | |
| Gigs | `GET /gigs` (public, filters) · `GET /gigs/:id` · `GET /gigs/mine` | public / client | |
| | `POST /gigs` · `PUT /gigs/:id` · `PUT /gigs/:id/cancel` · `DELETE /gigs/:id` | client | new gigs → `pending_approval` |
| | `POST /gigs/:id/attachments` · `POST /gigs/:id/invite` | client | |
| | `GET /gigs/:id/progress` · `POST /gigs/:id/progress-logs` | parties | |
| | `PUT /gigs/:id/milestones/:mid/start` · `…/submit` (freelancer, with files) · `…/approve` (client → release) · `…/request-changes` | parties | |
| | `PUT /gigs/:id/complete` | client | |
| Proposals | `POST /proposals` · `GET /proposals/mine` · `GET /proposals/gig/:gigId` · `GET /proposals/:id` | | |
| | `PUT /proposals/:id/status` (accept/reject) · `POST /proposals/:id/negotiate` (counter offer) · `PUT /proposals/:id/withdraw` | | |
| Chat | `GET /chat/conversations` · `POST /chat/conversations` `{participantId, gigId?}` · `GET /chat/conversations/:id/messages?before=&limit=` | auth | |
| | `POST /chat/conversations/:id/files` | participant | upload, then message via socket |
| Payments | `POST /payments/orders` · `POST /payments/verify` · `POST /payments/:id/release` · `POST /payments/:id/refund` | client | |
| | `GET /payments` (history, filters) · `GET /payments/summary` | auth | |
| | `POST /payments/webhook` | Razorpay | raw body, signature check |
| Reviews | `POST /reviews` · `GET /reviews/user/:userId` · `GET /reviews/user/:userId/breakdown` · `POST /reviews/:id/reply` · `POST /reviews/:id/report` | | |
| Notifications | `GET /notifications` · `GET /notifications/unread-count` · `PUT /notifications/:id/read` · `PUT /notifications/read-all` · `DELETE /notifications/:id` | auth | |
| Search | `GET /search/gigs` · `GET /search/freelancers` (q, skills, minRate, maxRate, minRating, experience, lat, lng, radiusKm, sort) | public | |
| | `GET /search/trending-skills` · `GET /search/suggestions?q=` | public | |
| AI | `GET /ai/gigs/:gigId/matches` (client) · `GET /ai/recommendations` (freelancer: gigs for me) · `POST /ai/career-analysis` | | move `analyze-career` here |
| Schedule | `GET /schedule/:freelancerId/availability?from=&to=` · `PUT /schedule/me/slots` · `POST /schedule/bookings` · `GET /schedule/bookings` · `PUT /schedule/bookings/:id` · `POST /schedule/auto-schedule` | | |
| Disputes | `POST /disputes` · `GET /disputes` · `GET /disputes/:id` · `POST /disputes/:id/evidence` · `POST /disputes/:id/messages` · `PUT /disputes/:id/resolve` (admin) | | |
| Analytics | `GET /analytics/freelancer?period=` · `GET /analytics/client?period=` | | |
| Admin | `GET /admin/stats` · `GET /admin/analytics?period=` | admin | |
| | `GET /admin/users` (search/role/status/page) · `PUT /admin/users/:id/suspend` · `PUT /admin/users/:id/unsuspend` | admin | |
| | `GET /admin/verifications` · `PUT /admin/freelancers/:id/verify` · `PUT /admin/freelancers/:id/reject-verification` | admin | |
| | `GET /admin/gigs/pending` · `PUT /admin/gigs/:id/approve` · `PUT /admin/gigs/:id/reject` | admin | |
| | `GET /admin/payments` · `GET /admin/fraud` (flagged reviews + suspicious users) · `PUT /admin/reviews/:id/visibility` · `GET /admin/logs` | admin | |

- [x] **2.1** Restructure the server routes/controllers to the table. Keep RBAC via `authorize()`. Every admin mutation writes an `AdminLog`.
  - *Scope note (session 1):* routes whose behaviour is a Phase‑4 feature are added with that task and to the smoke test then: 2FA/Google/email verification/password reset (4.1), uploads — avatar, resume, portfolio, gig attachments, chat files, dispute evidence (4.3/4.4/4.6/4.13), verification request + admin verification queue (4.3), invite/progress/milestone actions/complete (4.4/4.14), negotiate (4.5), payment webhook (4.7), schedule (4.12), dispute messages (4.13).
- [x] **2.2** Rewrite `client/src/api/*.ts` to the table, with types.
- [x] **2.3** Add a Supertest "route smoke test" that hits every route with the correct role and asserts no 404/500.
- [x] **2.4** Add **Swagger** (`swagger-jsdoc` + `swagger-ui-express`) at `/api/docs`, or commit a Postman collection in `docs/`.

---

## Phase 3 — Wire the frontend to real data (remove every mock)

Use **React Query** (`useQuery` / `useMutation`, `queryClient.invalidateQueries`) for all server data, keeping Redux for auth and UI only. Create hooks in `client/src/hooks/queries/` (e.g. `useGigs`, `useGig`, `useMyProposals`). Every page needs **loading** (Spinner/skeleton), **empty** (EmptyState) and **error** (toast + retry) states.

- [x] **3.1 Routing.** Rewrite `client/src/App.tsx`.
  - Route every existing page and every sidebar link in `client/src/components/layout/Sidebar.tsx`. Fix "Post a Gig" → `/client/gigs/new`.
  - Add the missing pages listed below.
  - Footer links: route `/terms`, `/privacy`, `/contact` to simple static pages, and remove links you won't build.
  - Add an `/oauth/callback` route and a 404 page instead of redirecting to `/`.
  - Lazy‑load route chunks with `React.lazy`.
- [x] **3.2 Marketplace.**
  - `GigListPage`: fetch `/gigs` with server‑side filters, pagination and sort. **Delete `INITIAL_GIGS`.**
  - `GigFilters`: get options from the API (categories and trending skills).
  - `GigDetailPage`: fetch by id, show real client info, milestones and attachments. Show "Apply" only to freelancers, "View proposals" to the owner, and "Already applied" when applicable.
  - `GigCard`: use real fields and `_id`.
- [x] **3.3 Apply / proposals.**
  - `ApplyModal` calls `POST /proposals` (cover letter, bid, duration, optional milestones). **Remove the `setTimeout` fake.**
  - New page `/freelancer/proposals`: My proposals with status tabs, withdraw, respond to counter‑offers.
  - New page `/client/gigs/:id/proposals`: list with `ProposalCard`, accept / reject / counter‑offer modal, and links to freelancer profiles and AI match score.
- [x] **3.4 Client area.**
  - `/client/dashboard`: real stats from `/analytics/client`, active gigs and recent notifications.
  - `/client/gigs`: My gigs with status tabs.
  - `CreateGigPage`: add a milestones editor (title, description, amount, due date, and the sum must fit the budget), attachments upload, location (browser geolocation + city text) with `locationType`, and an invite‑freelancers picker. On success, navigate to the new gig.
  - `/client/payments`: transaction history.
  - `/client/profile`: real data + edit.
- [x] **3.5 Freelancer area.**
  - `/freelancer/dashboard`: real stats, active projects with `MilestoneTimeline`, AI "Recommended gigs for you" (`/ai/recommendations`), and the `ResumeMatcher`.
  - `/freelancer/projects`: active and completed.
  - `/freelancer/profile`: real data.
  - `/freelancer/profile/edit`: full form for all profile sections (skills + proficiency, portfolio gallery uploads, resume upload, certifications, work experience, education, hourly rate and milestone pricing, languages, socials, location).
  - Public profile `/freelancers/:id`.
- [x] **3.6 Chat.**
  - `ChatPage`: conversations from the API.
  - Messages paginate upward.
  - Send via socket `send_message`; receive `message:new`.
  - Typing indicator via `typing` / `stop_typing`.
  - Read receipts via a `messages_read` event (updates `readBy`, shows ✓✓).
  - Online presence: the server tracks connected user ids and emits `presence`.
  - Attachments: upload, then send a message with `fileUrl`.
  - A "Message" button on gig, proposal and profile pages creates or opens the conversation.
- [x] **3.7 Notifications.**
  - `NotificationDropdown` in `Navbar` shows the live unread count via the socket `notification` event.
  - `/notifications` page with paginated list, mark read / all read, delete; clicking navigates to `link`.
- [x] **3.8 Admin.** Real data for `/admin/dashboard`, `/admin/users` (search, filter, suspend/unsuspend, verify), `/admin/gigs` (approval queue), `/admin/payments`, `/admin/disputes`, `/admin/analytics` and `/admin/logs`. Remove `/admin/settings` from the sidebar unless you build it.
- [x] **3.9 Phase‑3 gate.** `grep` the client for hardcoded people and companies (`Alex Developer`, `TechCorp`, `Sarah Manager`, `pravatar`, `unsplash`, `INITIAL_GIGS`). Only the landing page may keep marketing copy. Click through every sidebar link for each role; none may redirect home.

---

## Phase 4 — Missing spec features (module by module)

### 4.1 Auth (module 1)
- [x] **Email verification.**
  - On register, generate a random token and store its **sha256 hash** plus a 24h expiry.
  - Email the link `CLIENT_URL/verify-email?token=…` using the existing `utils/sendEmail.ts` templates (`sendVerificationEmail`).
  - `GET /auth/verify-email/:token` sets `isVerified`.
  - Unverified users can log in, but posting gigs, applying and paying are blocked by a `requireVerified` middleware.
  - Add a "Resend" button.
  - Client `VerifyEmailPage` reads `?token`, calls the API, and shows the result.
- [x] **Password reset.**
  - `forgot-password` always returns 200 (no user enumeration), stores a hashed token with a 1h expiry, and emails the link.
  - `reset-password/:token` sets the new password, clears the token, and invalidates the refresh token.
  - Wire the `ForgotPasswordPage` / `ResetPasswordPage` forms with react‑hook‑form + zod.
- [x] **Google OAuth.**
  - Use the existing `config/passport.ts` with `session: false`.
  - The callback issues a refresh cookie and redirects to `CLIENT_URL/oauth/callback`. The client then calls `/auth/refresh` to get the access token.
  - New Google users must choose a role on first login: show a "choose role" screen if the role is unset. Add a `needsRoleSelection` flag; don't default them to freelancer silently.
  - The Login/Register Google buttons go to `/api/v1/auth/google`.
  - Show the button disabled if Google is not configured (expose `GET /auth/providers`).
- [x] **2FA (TOTP)** with `otplib` + `qrcode` (already installed).
  - `setup` generates and stores an *encrypted or pending* secret and returns a QR data URL.
  - `enable` verifies the first code.
  - Login for 2FA users returns `{twoFactorRequired, tempToken (5 min, purpose: '2fa')}`; `POST /auth/2fa/verify {tempToken, code}` returns real tokens.
  - Generate 8 hashed backup codes.
  - Wire `TwoFactorPage` (auto‑advance 6 inputs).
  - Add a settings page with enable/disable 2FA, change password and email verification status.

### 4.2 AI matching (module 2), with real Hugging Face use
- [x] Create `services/embeddingService.ts`.
  - Use `@huggingface/inference` `featureExtraction` with model `sentence-transformers/all-MiniLM-L6-v2` (384‑dim).
  - Cache embeddings in Mongo: `Gig.embedding: [Number]` (select:false) and `FreelancerProfile.embedding`, recomputed when skills, title or description change. Use a background job or recompute on save via service call, not a model hook that blocks the request.
  - If HF is unavailable, fall back to the Jaccard similarity of normalized skill sets and **flag `source: 'fallback'`**.
- [x] **Score** in `aiMatchingService` (document the weights in code and README):
  - `0.45·cosine(skillEmbedding)`
  - `0.20·rating/5` (Bayesian‑adjusted by review count)
  - `0.15·proximity` (for `onsite`/`hybrid` gigs: `1 - min(distKm, 50)/50`; for remote: 1)
  - `0.10·experience fit`
  - `0.05·budget fit`
  - `0.05·availability`

  Candidate set via `$geoNear` (when the gig has a location) + skill prefilter. Exclude banned, inactive and unverified users.
- [x] `GET /ai/gigs/:gigId/matches` (client owner): top N with score breakdown and reasons. UI: a "Recommended freelancers" panel on the client's gig page with an "Invite" button.
- [x] `GET /ai/recommendations` (freelancer): gigs ranked for this freelancer. UI: a dashboard widget.
- [x] **Trending skills:** aggregation over gigs created in the last 30 days vs the previous 30 (`$unwind skills`, counts, growth %). Cache for 1h (in‑memory, or Redis if `REDIS_URL` is set). UI: chips on the marketplace and landing page.
- [x] **Career analysis:** keep the endpoint. Response = `{ ...report, source: 'ai' | 'fallback' }`, and the UI shows a small "AI‑generated" or "Basic analysis (AI unavailable)" label. Verify the chosen chat model is actually served by HF Inference Providers. If not, switch to one that is and document it. Raise the body limit (done in 1.16).

### 4.3 Freelancer profiles (module 3)
- [x] **Uploads (shared infrastructure, needed by 4.4, 4.6, 4.13, 4.14).**
  - Add a `services/uploadService.ts` wrapping `middleware/upload.ts` → `uploadToCloudinary`. Call `configureCloudinary()` at boot.
  - Images go to `image` resources; PDF/DOC/ZIP go to `raw`.
  - Return `{url, publicId, name, size, mimeType}`.
  - 503 when Cloudinary is not configured.
  - Apply `uploadLimiter`.
- [x] **Resume upload:** `FreelancerProfile.resume: {url, publicId, name, uploadedAt}`. PDF/DOC only, 5 MB. Show a download button on the public profile. Also offer "Analyze my resume" (extract text from the PDF with `pdf-parse` → career analysis).
- [x] **Portfolio gallery** with multiple images per item and a lightbox. **Certifications** and **work‑experience timeline** use the existing `WorkTimeline` component. **Availability calendar** links to the scheduler (4.12).
- [x] **Hourly & milestone pricing:** `FreelancerProfile.milestonePricing: [{ title, description, price, deliveryDays }]` (packages). Show both on the profile.
- [x] **Verification badge:** `FreelancerProfile.verification: { status: 'none'|'pending'|'verified'|'rejected', documents: [url], requestedAt, reviewedAt, reviewedBy, note }`.
  - Freelancer requests with ID or portfolio proof; admin approves or rejects (4.9).
  - The badge (ShieldCheck icon) shows on cards, profiles and search results.
  - Verified freelancers get a small ranking boost in search.

### 4.4 Gig marketplace (module 4)
- [x] Gig status flow: `draft → pending_approval → open → in_progress → completed | cancelled` (add `PENDING_APPROVAL`, `REJECTED` to `GigStatus`). Only `open` gigs are public.
- [x] **Milestones** defined at creation (editor in 3.4); validate that the sum ≤ `budgetMax`.
- [x] **Attach documents:** `attachments: [{url, name, size, mimeType}]`. Migrate from `[String]`.
- [x] **Invite freelancers:** `Gig.invitations: [{ freelancer, invitedAt, status: 'pending'|'accepted'|'declined' }]`. `POST /gigs/:id/invite` notifies the freelancer (socket + email). `invite_only` gigs are visible only to invitees.
- [x] **Track progress:** see 4.14. **Track application status:** see 3.3.
- [x] **"New gig posted" notification:** when a gig is approved, notify the top‑20 matching freelancers (via 4.2).

### 4.5 Proposals & negotiation (module 5)
- [x] `POST /proposals/:id/negotiate {amount, message}`. Either party can counter; it appends to `negotiationHistory` and sets status `negotiating`. Accepting a negotiated proposal uses the **last agreed amount** (`proposal.finalAmount`).
- [x] UI: a negotiation thread inside the proposal detail (client and freelancer), with "Accept offer" / "Counter" / "Reject".
- [x] Freelancer withdraw (only while `pending|negotiating`).

### 4.6 Chat extras (module 6)
- [x] File sharing (images inline, other files as a download chip), typing, read receipts and presence (done in 3.6).
- [x] **Video call (optional):** WebRTC 1:1 using the existing socket for signaling (`call:offer`, `call:answer`, `call:ice`, `call:end`) and Google's public STUN. Use a `VideoCallModal` with the `Phone`/`Video` buttons already in the chat header. If you skip it, remove those buttons and mark it optional in the README.

### 4.7 Payments (module 7) — Razorpay test mode
- [x] **Escrow per milestone.** The client clicks "Fund milestone" and the server creates an order (`POST /payments/orders {gigId, milestoneId}`). The client opens Razorpay Checkout: load `https://checkout.razorpay.com/v1/checkout.js` dynamically, with `key_id` from `GET /payments/config`. Then `POST /payments/verify` → status `escrow`, the milestone becomes fundable/started, and the freelancer is notified.
- [x] **Release:** when the client approves a milestone (4.14), the payment becomes `released`. Update `FreelancerProfile.totalEarnings`, `ClientProfile.totalSpent` and notify both.
- [x] **Automatic freelancer payout:** add a `Payout` record (or a `payout` subdocument on Payment) `{status: 'queued'|'processed'|'failed', processedAt, reference}`. A `node-cron` job processes released payments every N minutes. In test mode this is a **simulated payout** (no real money movement; Razorpay Route/RazorpayX need KYC); document it clearly in the README. Also auto‑release escrow if the client doesn't respond **7 days** after a milestone is submitted (configurable).
- [x] **Refunds:** `POST /payments/:id/refund` (client before work started, or admin via dispute) uses the existing `paymentService.refundPayment` (real Razorpay test refund).
- [x] **Webhook:** `POST /payments/webhook`, mounted **before** `express.json` with `express.raw()`, verifies `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET`, and handles `payment.captured`, `payment.failed` and `refund.processed` idempotently.
- [x] **Transaction history** page for clients and freelancers using `TransactionCard`, with filters, a CSV export, and a summary (in escrow, released, refunded, fees).

### 4.8 Reputation & reviews (module 8)
- [x] **Weighted reputation score** (store as `reputationScore` 0–100 on both profiles, and document it):
  - Bayesian average rating (prior m=5 reviews at the platform mean)
  - category weights already in `Review` (quality 30 %, communication 20 %, timeliness 20 %, professionalism 15 %, value 15 %)
  - recency weighting (reviews older than 12 months count 50 %)
  - completion rate (completed / (completed + cancelled + lost disputes))
  - verified badge bonus
  
  Recalculate in `reputationService` after each review, dispute and completion.
- [x] **Verified reviews:** only gig participants after completion, shown with a "Verified hire" tag including the amount range.
- [x] **Fraud detection:** use `detectFraudulentReview` (already written), plus extra signals: same IP or device for reviewer and reviewee (store `lastLoginIp`), brand‑new account, very short or duplicate comment text, and rating outliers. Flagged reviews are hidden until an admin decides. Users can `POST /reviews/:id/report`.
- [x] **Review analytics:** `GET /reviews/user/:id/breakdown` (already in `reputationService.getReputationBreakdown`). UI: a star distribution bar chart and category averages on the profile page and the freelancer analytics page.
- [x] Write‑review modal on completed gigs for both parties, using the existing `StarRating` per category; show the reply.

### 4.9 Admin (module 9)
- [x] **Users:**
  - paginated search
  - suspend with reason and optional duration (`suspendedUntil`)
  - unsuspend
  - view details: gigs, payments, reviews, disputes
  
  Suspension must also kick live sockets (`io.in('user:'+id).disconnectSockets()`).
- [x] **Verify freelancers:** queue from 4.3.
- [x] **Approve gigs:** queue of `pending_approval` gigs with approve/reject + reason; notify the client.
- [x] **Payment monitoring:** table of all payments with status filters, escrow totals, failed payments, and refunds.
- [x] **Fraud detection:** flagged reviews, users with many disputes, accounts sharing an IP, abnormal payment patterns (many refunds). Actions: hide review, suspend user.
- [x] **Analytics** (Recharts, already installed):
  - platform revenue = sum of `platformFee` on released payments, by month (`paymentService.getRevenueByMonth` exists)
  - active freelancers = freelancers with activity in the last 30 days
  - top categories = gig counts and GMV by category
  - job success rate = completed / (completed + cancelled + disputed)
  - user growth
- [x] **Admin logs** viewer (`AdminLog`).

### 4.10 Advanced search (module 10)
- [x] Store GeoJSON `location` on `User` / `FreelancerProfile` and `Gig` (coordinates `[lng, lat]`).
  - In the UI, capture it with `navigator.geolocation` or a city dropdown with built‑in coordinates for major Indian cities. Avoid paid geocoding APIs; optionally use the OSM Nominatim free tier with a proper User‑Agent.
- [x] Freelancer search: `$geoNear` (`lat`, `lng`, `radiusKm`) + skills + hourly rate range + `minRating` + experience (max years in skills / proficiency) + verified only + availability. Sort by relevance, rating, rate or distance. Show the distance in results.
- [x] Gig search: text + category + skills + budget overlap + experience level + location type + near me.
- [x] Create a **`SearchResultsPage`** with tabs (Gigs / Freelancers) and URL‑synced filters (`useSearchParams`). Hook the Navbar search to it.
- [x] **Atlas Search (advanced option):** if `USE_ATLAS_SEARCH=true`, use a `$search` stage (fuzzy text + `near` geo). Otherwise fall back to `$text` / regex. Document the index JSON in `docs/atlas-search-index.json`.

### 4.11 Notifications (module 11)
- [x] Call the existing `notificationService.notify*` methods from controllers at every event:
  - gig approved/rejected
  - **new matching gig posted**
  - proposal received / **accepted** / rejected / countered
  - invited to gig
  - milestone funded / submitted / approved
  - **payment received** / released / refunded
  - **review added**
  - message received (only if the user is offline)
  - dispute opened/resolved
  - deadline reminder
- [x] Socket emit to `user:<id>` (fixed in 1.7) with an unread‑count update.
- [x] **Email notifications:** `emailService` (already written) for important events, respecting `User.notificationPreferences: { email: { proposals, payments, reviews, messages }, inApp: {...} }` with a settings UI.

### 4.12 Availability scheduler (module 12)
- [x] Use the `FreelancerProfile.availabilitySlots` weekly template (day, start, end) plus a new `timezone` field (default `Asia/Kolkata`).
- [x] New model `Booking { freelancer, client, gig?, start, end, title, notes, status: 'pending'|'confirmed'|'cancelled'|'completed', meetingLink? }`, indexed on `{freelancer, start}`.
- [x] Availability API: weekly slots minus existing bookings for a date range (30‑min granularity).
- [x] **Booking system:** a client books a slot on the freelancer's public profile; the freelancer confirms or declines (or auto‑confirms if enabled). Prevent overlap with a conflict check in a transaction. Notify both.
- [x] **Automatic scheduling:** `POST /schedule/auto-schedule {freelancerId, durationMinutes, earliest, latest}` returns the earliest common free slot. "Find next available" books it.
- [x] **UI:** a `SchedulerPage` (freelancer) to edit the weekly template and see bookings in a week/month calendar. Extend `AvailabilityCalendar`; build a simple grid rather than adding a heavy library. Add a booking widget on the public profile.

### 4.13 Disputes (module 13)
- [x] `CreateDisputePage` (from a gig or payment) with reason, description and **evidence upload** (multiple files via the upload service).
- [x] `Dispute.messages: [{sender, content, attachments, createdAt}]` gives a mediation thread between both parties and the admin. The status flow is `open → under_review → resolved | closed`.
- [x] Admin `DisputeManagement` page: review evidence and messages, then resolve with refund / release / split (calls payment service from 1.14) and notes. Notify both parties and write an `AdminLog`.

### 4.14 Project progress tracker (module 14)
- [x] Extend the milestone status flow: `pending → funded → in_progress → submitted → approved | changes_requested`.
- [x] Add `Gig.progressLogs: [{ author, message, attachments, milestone?, createdAt }]`. The freelancer posts updates with files; the client comments.
- [x] **Task completion %** = approved milestone amount / total, plus an optional per‑milestone `percent` the freelancer updates.
- [x] **Deadline reminders:** a daily `node-cron` job notifies (socket + email) for milestones due in 48h and for overdue ones. Store `remindersSent` to avoid duplicates.
- [x] **UI:** `ProjectProgressPage` at `/projects/:gigId` for both parties. It shows a progress bar, `MilestoneTimeline` with action buttons per role (fund, start, submit with files, approve or request changes), progress logs, files, and links to chat and dispute.
- [x] When the client approves the last milestone, the gig becomes `completed`, both parties are prompted to review, and counters are updated.

### 4.15 Freelancer analytics (module 15)
- [x] **Profile views:** a `ProfileView { freelancer, viewer?, date (day), count }` collection or a daily counter subdocument. Increment on public profile view (dedupe the same viewer per day).
- [x] `GET /analytics/freelancer?period=30d|90d|12m` returns:
  - profile views over time
  - proposals sent / accepted / acceptance rate
  - earnings total, pending (escrow) and released
  - **monthly revenue** (the existing aggregation)
  - client feedback analytics (category averages, rating distribution, recent comments)
  - top skills that won jobs
- [x] `AnalyticsPage` with Recharts: line chart for views, bar chart for monthly revenue, pie chart for proposal outcomes, radar or bar chart for feedback categories, and stat cards. Reuse `StatCard`.
- [x] Do the same (simpler) for clients: spending and hires.

### 4.16 Optional
- [x] Redis (`REDIS_URL`): cache trending skills, admin stats and search results. Use the Socket.IO Redis adapter. Skip gracefully if absent.

---

## Phase 5 — Quality, docs and deployment

- [x] **Tests:**
  - Server: unit tests for `reputationService`, `aiMatchingService` scoring and `paymentService`; integration tests for each route group (auth, RBAC matrix, proposal → escrow → release flow, disputes).
  - Client: **Vitest + React Testing Library** for key components and the auth slice.
  - **Playwright** e2e for the §9 demo flow (Razorpay mocked).
- [x] **CI:** `.github/workflows/ci.yml` runs install, lint, typecheck, test and build for both packages on push/PR.
- [ ] **Frontend polish:**
  - responsive layouts (mobile sidebar)
  - skeleton loaders
  - accessible forms (labels, focus)
  - consistent toasts
  - a `ErrorBoundary`
  - `document.title` per page
  - favicon and OG tags
  - remove unused components and dependencies
- [ ] **Security pass:**
  - helmet CSP that allows Razorpay and Cloudinary
  - httpOnly cookies
  - CSRF consideration for cookie‑auth endpoints (`sameSite` + origin check)
  - sanitize HTML in user content (render as text)
  - rate limits
  - validation on all routes
  - re‑run `npm audit`
- [ ] **Deployment:**
  - API: Render or Railway (`npm run build && npm start`, health check `/health`).
  - Client: Vercel or Netlify with `VITE_API_URL`. Update `axiosInstance` `baseURL` and the socket URL to use it, with `/api/v1` as the dev default.
  - Set `CLIENT_URL` for CORS. MongoDB Atlas.
  - Add `render.yaml` / `vercel.json` (SPA rewrites).
  - Document the steps.
- [ ] **README.md** covering:
  - pitch
  - live demo link
  - screenshots/GIF
  - architecture diagram (Mermaid)
  - feature list mapped to the 15 modules
  - tech stack
  - local setup
  - env var table
  - seed + demo accounts
  - testing
  - API docs link
  - how AI matching and the reputation score work (formulas)
  - payment flow diagram
  - known limitations (simulated payouts, optional video)
  - roadmap
- [ ] Update `.env.example` with every variable (including `RAZORPAY_WEBHOOK_SECRET`, `REDIS_URL`, `USE_ATLAS_SEARCH`, `VITE_API_URL`). Remove `AUDIT_REPORT.md` and this plan from the published repo, or move them to `docs/`, as the user prefers.

---

## 9. Final acceptance demo (must work with seeded data and a fresh account)

1. A visitor browses `/gigs` without logging in, filters by skill and "near me", and opens a real gig.
2. A new client registers, verifies email (Ethereal link in the logs in dev), logs in, and enables 2FA (with a QR code).
3. The client posts a gig with 2 milestones, an attachment and a location → it appears in the admin approval queue → the admin approves → matching freelancers get a real‑time notification and an email.
4. The client opens the gig and sees **AI‑recommended nearby freelancers** with scores, then invites one.
5. The freelancer (Google login works if keys are present) sees the invite and the gig in "Recommended for you", applies with a bid. The client counters, the freelancer accepts the counter, and the client accepts the proposal → other proposals are auto‑rejected, and the freelancer is notified.
6. Both chat in real time: typing indicator, read receipts, file sharing.
7. The client funds milestone 1 via Razorpay **test** checkout → escrow → the freelancer starts, posts a progress log with a file, and submits → the client approves → payment released → simulated payout processed → transaction history updated for both.
8. Milestone 2: the client requests changes → the freelancer resubmits → the client raises a dispute with evidence instead → the admin mediates and resolves with a split or refund (Razorpay test refund).
9. Gig completed → both leave reviews → the reputation score updates. A fake review from an unrelated account is rejected or flagged and appears in admin fraud detection.
10. The client books a meeting slot on the freelancer's calendar via auto‑schedule.
11. The freelancer's analytics page shows profile views, applications, earnings, the monthly revenue chart and feedback analytics. The admin analytics page shows revenue, active freelancers, top categories and job success rate.
12. `npm run build`, `npm run lint` and `npm test` all pass; the CI badge is green; the README has a live demo link.

---

## 10. Progress log
*(Claude Code: append one line per working session: date, what was completed, what's next, blockers such as missing keys.)*

- 2026‑10‑25 — Plan created from the audit. Nothing implemented yet.
- 2026‑10‑25 (session 1) — Phase 0 and Phase 1 done: both apps build, lint clean, 108 server tests (Jest + Supertest + mongodb-memory-server) cover C1–C11 and 1.12–1.15. Seed: `MONGO_URI=mongodb://127.0.0.1:27017/skillsphere_dev npm run seed`. New local JWT secrets written to the root .env. Next: Phase 2 (canonical API contract). Blockers: none yet; Razorpay test keys, Cloudinary, SMTP and Google OAuth secret are still placeholders (features degrade to 503 / Ethereal).
- 2026‑10‑25 (session 1, cont.) — Phase 2 done: server routes follow the §Phase 2 table (Phase‑4 routes listed in the 2.1 scope note come with their tasks), typed client API layer, route smoke test + Swagger at /api/docs (128 tests). **When adding a route:** add a case to tests/routes.smoke.test.ts and an entry to server/src/docs/openapi.ts (tests enforce both). Next: Phase 3 (wire the frontend).
- 2026‑10‑26 (session 1, cont.) — Phase 3 done: every page uses React Query against the API (no mock data; gate grep is clean), sidebar links for all three roles load their own pages (checked in the browser), chat/notifications are real-time, admin area complete. Pulled forward: proposal negotiation endpoint (4.5 server part), freelancer analytics page (4.15 minus profile views), search results page (4.10 minus geo), FreelancerProfile.milestonePricing/location. Dev servers used for checks: API on :5000 with MONGO_URI=…/skillsphere_dev, Vite on :5174. Next: Phase 4.
- 2026‑10‑26 (session 1, cont.) — 4.1 done (email verification via Ethereal, password reset, TOTP 2FA with backup codes, Google OAuth + role choice; Google verified only in its disabled state). 143 server tests. **Blocked on keys before continuing 4.2+:** the HF token in .env is rejected ("insufficient permissions to call Inference Providers" — needs a fine-grained token with that permission); Razorpay test key id/secret (+ webhook secret) for 4.7; Cloudinary cloud name/key/secret for uploads (4.3/4.4/4.6/4.13); Google OAuth client secret (+ authorized redirect http://localhost:5000/api/v1/auth/google/callback) to verify Google sign-in. SMTP optional (Ethereal works). Next: 4.2.
- 2026‑10‑27 (session 2) — 4.2–4.7 and 4.14 done (196 server tests). AI matching uses MiniLM embeddings with a labelled skill-overlap fallback (HF token still rejected: needs the "Inference Providers" permission); uploads via Cloudinary service (all upload routes 503 without keys; portfolio accepts image URLs as fallback); invitations, verification badge, chat files, WebRTC calls; milestone escrow flow + payouts/auto-release/reminder cron jobs + Razorpay webhook. **No Razorpay keys yet:** set `SIMULATE_PAYMENTS=true` (dev only) to demo checkout in-app. New scripts: `npm run db:migrate` (idempotent data migrations). Next: 4.8 reviews/reputation, 4.9 admin, 4.10 search, 4.11 notification settings, 4.12 scheduler, 4.13 disputes, 4.15 analytics, then Phase 5.
