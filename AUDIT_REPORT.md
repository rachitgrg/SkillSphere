# SkillSphere — Project Audit Report

**Audited:** 25 Oct 2026 · **Repo:** `D:\Nayoda` (branch `main`, commit `0047175`)
**Measured against:** *Nayoda Full Stack Development Internship – Project Details* (15 modules + tech stack + 4‑week timeline)

**How this was checked**
- Read every tracked source file in `server/` and `client/`.
- Ran `tsc --noEmit` on both apps.
- Ran `npm audit` on both apps.
- Started the real API against a throwaway local MongoDB and ran an end‑to‑end script: register, gig, proposal, payment, review, search, sockets.

Every item marked **✅ Verified** below was reproduced at runtime. The rest come from reading the code.

---

## 1. Bottom line

The **backend is a reasonable skeleton**:
- All 11 required collections are modelled well, with indexes.
- There are routes for auth, gigs, proposals, chat, payments, reviews, disputes, admin, search and analytics.
- Security middleware is in place: helmet, mongo‑sanitize, rate limiting.

But it has **several show‑stopper bugs** and a lot of code that is **written but never connected**.

The **frontend is mostly a UI mock‑up**. Only these screens talk to the server:
- login
- register
- "Post a Gig"
- the AI Career Coach

Everything else shows hardcoded data or a "goes here" placeholder: the gig marketplace, gig details, applying, chat, dashboards, admin, profiles, payments, reviews and notifications. A gig a client posts **never appears** in the marketplace.

Neither app compiles under its own build command:
- server: 63 TypeScript errors
- client: 4 TypeScript errors

> For a resume this matters. An interviewer who clones the repo or asks "show me a client hiring a freelancer end to end" will hit these gaps within minutes. Fix the critical items in §3 and wire the core flow (§7) before you list it.

---

## 2. Spec vs. reality — module by module

Legend: 🟢 done · 🟡 partial / backend only · 🔴 missing or fake

| # | Module (from PDF) | Backend | Frontend | Notes |
|---|---|---|---|---|
| 1 | Multi‑role auth | 🟡 | 🟡 | JWT + RBAC work (with serious bugs, §3). **Google OAuth, email verification, password reset, 2FA: missing.** `passport.ts`, `sendEmail.ts`, `otplib`/`qrcode` are installed or written but never wired. The forgot/reset/2FA pages are static shells, and the Google button does nothing. |
| 2 | AI job matching (Hugging Face) | 🟡 | 🔴 | `GET /search/matches/:gigId` is a **rule‑based score with no Hugging Face call**, and it crashes on skills like `C++`. No UI uses it. **Trending skills** and **"near the location"** are missing. The extra Resume "Career Coach" does call HF, but on any error it silently returns canned text (see §4). |
| 3 | Freelancer profiles | 🟡 | 🔴 | The schema has skills + proficiency, portfolio, certifications, work experience, availability slots and hourly rate. **Missing:** resume upload, verification badge, milestone pricing. The profile page is hardcoded ("Alex Developer"), and **Edit Profile links to a route that doesn't exist**. |
| 4 | Gig marketplace | 🟡 | 🔴 | Create works end to end. List and detail are **hardcoded** (`INITIAL_GIGS`, a fixed "React Native" detail page). **Missing:** milestones UI, attachments, invite freelancers, track progress, "My gigs". |
| 5 | Proposals & bidding | 🟡 | 🔴 | Submit, accept and reject exist in the API. **Negotiate price: missing**, though `negotiationHistory` exists in the schema. "Apply Now" is **fake**: it shows a success toast after 800 ms and never calls the API. There is no "My proposals" endpoint. |
| 6 | Real‑time chat | 🟡 | 🔴 | REST endpoints and socket events exist, but the chat page is entirely static. File sharing, read receipts and video: missing. The socket layer is **insecure** (§3). |
| 7 | Secure payments (Razorpay) | 🟡 | 🔴 | Order, verify and release code exists but is **broken at runtime** (§3). Refund logic exists in `paymentService.ts` but has no route. Automatic payout: missing. The payment pages are placeholders and not routed. |
| 8 | Reputation & reviews | 🟡 | 🔴 | A weighted rating is computed in a model hook, but **every review save crashes** (§3). Fraud detection (`reputationService.detectFraudulentReview`) is written but **never called**. Nothing ever marks a gig `completed` legitimately, so reviews can't be created through a normal flow. |
| 9 | Admin dashboard | 🟡 | 🔴 | Counts, list users, ban/unban. **Missing:** verify freelancers, approve gigs (gigs go straight to `open`), payment monitoring, fraud detection, revenue / top categories / success‑rate analytics. All admin UI is hardcoded; 5 of 7 sidebar links are dead. |
| 10 | Advanced search | 🟡 | 🔴 | Gig text/skills/budget search exists. Freelancer search **crashes** with `q`. **Missing:** location, rating and experience filters, and Atlas Search/Elasticsearch. The UI filters the hardcoded array in the browser. |
| 11 | Notifications | 🔴 | 🔴 | The model and CRUD routes exist, but `notificationService` is **never called**, emits to the wrong room, and uses a socket instance that is never initialised. No emails are sent. The page is a placeholder. |
| 12 | Availability scheduler | 🔴 | 🔴 | Only an `availabilitySlots` field. No booking model or API. The page is not routed. |
| 13 | Disputes | 🟡 | 🔴 | Create, list and resolve exist, with **no ownership checks** and no evidence upload. Admins can't list all disputes. The UI is a placeholder and not routed. |
| 14 | Progress tracker | 🔴 | 🔴 | Milestone status exists in the schema. No API for completion %, progress logs, file uploads or deadline reminders. The page is hardcoded and not routed. |
| 15 | Freelancer analytics | 🟡 | 🔴 | Only a monthly‑earnings aggregation. No profile views, application counts or feedback analytics. The page is a placeholder and not routed; the dashboard numbers are fake. |

**Tech stack checklist:**
- React ✅
- Redux Toolkit ✅ (auth only)
- Tailwind ✅
- React Query ⚠️ installed, never used
- Socket.IO client ⚠️ connects, no listeners used
- Express / MongoDB / Socket.IO / JWT ✅
- Cloudinary ⚠️ configured, never used — **no upload endpoint exists anywhere**
- Nodemailer ⚠️ written, never used
- Redis ❌ (optional)

**Collections:** all 11 from the PDF exist, plus `Conversation` ✅.

**Timeline note:** the PDF review date was **22 July 2026**, and all three commits are dated **23 July 2026**. If you're polishing for your resume now, the plan in §7 is what turns this into something you can demo confidently.

---

## 3. Critical bugs (break core features or are serious security holes)

### C1. Anyone can register as **admin** — ✅ Verified
`server/src/controllers/authController.ts:13-31` copies `role` from the request body straight into the user. `POST /auth/register {"role":"admin"}` → **201, role = admin**.
**Fix:** allow only `client|freelancer`. Wire `registerSchema` from `utils/validators.ts` through the existing `validate` middleware.

### C2. Password hash and refresh token returned to the browser — ✅ Verified
Register (`authController.ts:75-79`) and login (`:112-116`, which uses `.select('+password')`) return the full user document. The response contains `"password":"$2a$12…"` and `refreshToken`.
**Fix:** delete these fields in a `toJSON` transform on the User schema, or build a safe user object before responding.

### C3. Every Payment and Review save crashes: `next is not a function` — ✅ Verified
Mongoose 9 (you have 9.7.4) no longer passes `next` to `pre` hooks. Affected:
- `server/src/models/Payment.ts:74-81`
- `server/src/models/Review.ts:64-78`

As a result:
- **No payment record can ever be created.**
- **No review can be created or replied to.**

`User.ts` and `Gig.ts` already use the correct style.
**Fix:** remove the `next` parameter and the `next()` call (or make the hook `async`).

### C4. `.env` is loaded *after* the app is imported — ✅ Verified
`server/src/server.ts:5` imports `./app` before `dotenv.config()` runs at line 11. Every value read at import time sees an empty environment:
- **CORS origin falls back to `http://localhost:3000`** (`app.ts:31-34`). Verified: the API answers `Access-Control-Allow-Origin: http://localhost:3000`, while your frontend runs on 5173. It only works now because the Vite proxy hides it; a real deployment will break.
- **Razorpay is always `null`**, even with real keys (`config/razorpay.ts:23`), because the instance is created at import.

**Fix:** put `import 'dotenv/config'`, or a tiny `env.ts` that calls `dotenv.config`, as the **first import** in `server.ts`.

### C5. Payment intent crashes, and anyone can create payments for any gig — ✅ Verified
- `paymentController.ts:28` calls `razorpay.orders.create` on `null`, which returns 500 `Cannot read properties of null (reading 'orders')`. The comment in `razorpay.ts` promises a 503.
- `createPaymentIntent` (`:8-50`) never checks that the caller owns the gig. It also trusts `freelancerId` and `amount` from the body.
- `verifyPayment` (`:52-80`) doesn't check ownership either, and uses a non‑constant‑time comparison.

### C6. Token refresh can never succeed — ✅ Verified
`authController.ts:156` loads the user without `+refreshToken` (the field is `select: false`). So `user.refreshToken !== token` is always true, and the endpoint always returns **403**. If that were fixed, line 163 calls `generateToken`, which doesn't exist (a ReferenceError and a TS error).

Separately, the client never stores the refresh token and logs users out on any 401 (`client/src/api/axiosInstance.ts:31-35`). With `JWT_EXPIRES_IN=15m`, **every user is kicked to /login after 15 minutes**.

### C7. Socket.IO lets any user read and spoof other users' rooms — ✅ Verified
In `server/src/sockets/chatSocket.ts:27-43`:
- `join_conversation` lets a socket join **any room id**, including another user's personal room.
- `send_message` rebroadcasts **any client‑supplied message object** without persisting it or checking membership.

Verified: a freelancer joined a client's room, eavesdropped on it, and injected `{"sender":"admin","content":"Your account is locked, send OTP"}`, which the victim received.
**Fix:**
- Check the conversation exists and the user is a participant before `join`.
- Create messages server‑side and emit the saved document.
- Never let clients join raw user‑id rooms.

### C8. Mass assignment: users can edit fields they should never control — ✅ Verified
- `userController.ts:56-60` and `:86-90` pass `$set: req.body`. Verified: a freelancer set their own `averageRating: 5`, `totalReviews: 999`, `totalEarnings: 10,000,000`. **This defeats the whole reputation system.**
- `gigController.ts:113`: the gig owner can set `status`, `views`, `selectedFreelancer`, even `client`. Verified: `{status:"completed", views:123456}` was accepted.
- `gigController.ts:13-20`: `...req.body` on create.

**Fix:** whitelist fields (pick only allowed keys) or use zod schemas.

### C9. AI matching crashes on common skill names — ✅ Verified
`aiMatchingService.ts:21` and `:338` build `new RegExp(skill)` from raw text. A gig with skill `C++` returns **500 "Invalid regular expression: /C++/i"**. The fallback has the same bug, so it fails too. This is also a ReDoS vector.
**Fix:** escape the input (`s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`) or compare lowercased strings.

### C10. Freelancer search crashes whenever a query is typed — ✅ Verified
`searchController.ts:45` uses `$text` on `FreelancerProfile`, but that model has **no text index**. Result: 500 "text index required for $text query".

### C11. Seeded gigs can't be opened — ✅ Verified
`server/scripts/seed-gigs.js` uses `type:` instead of `budgetType:` and adds a `budget` field the schema doesn't have. `getGigById` saves the doc to increment `views` (`gigController.ts:91-92`), and validation fails with **500 "budgetType is required"**.
**Fix:**
- Rename the field in the seed.
- Increment views with `Gig.updateOne({_id}, {$inc:{views:1}})` instead of `save()`.

### C12. Neither app builds
- `server`: `npm run build` (tsc) fails with **63 errors**:
  - most are route‑handler typing: `AuthRequest` vs `Request`, and `@types/express@5` installed with `express@4`
  - plus the real bugs in C3 and C6
  - so `npm start` (which runs `dist/`) cannot work; only `npm run dev` with `--transpile-only` runs.
- `client`: `npm run build` (`tsc -b && vite build`) fails with **4 errors**: `budget: '8000'` passed as a string in `ClientDashboard.tsx:27-28` and `client/ProfilePage.tsx:27-28`.

---

## 4. High‑priority bugs and logic flaws

**Auth & security**
1. **JWT secrets in `.env` are still the public placeholders** (`your_jwt_secret_key_here`). Anyone who reads `.env.example` can forge an admin token. The code also falls back to `'secret'` / `'refresh-secret'` when unset (`middleware/auth.ts:30`, `utils/generateToken.ts`). Fail fast at startup instead.
2. **No input validation anywhere.** `utils/validators.ts` (316 lines of zod schemas) and `middleware/validate.ts` are never used. Verified: password `aaaaaaaa` is accepted.
3. `authLimiter` is defined but not applied to `/auth/login` or `/auth/register`, so brute‑force protection is only the general 60 req/min.
4. Login doesn't check `isActive`.
5. Logout in the UI (`Navbar.tsx` `handleLogout`) never calls `/auth/logout`, so the refresh token stays valid server‑side.
6. The access token is stored in `localStorage` (`authSlice.ts`), which XSS can read. Consider httpOnly cookies; `protect` already reads `req.cookies.accessToken`.
7. `config/socket.ts` (with auth middleware) is dead code. `server.ts` creates its own `io`, and both `chatSocket` and `notificationSocket` register auth middleware, so every connection does 2× JWT verify + 2× DB lookups.

**Business logic**

8. **Reviews:** `reviewController.ts:8-43`:
   - doesn't check that the reviewer is the gig's client or hired freelancer, so anyone can review any completed gig about anyone
   - doesn't prevent self‑review
   - computes a simple average (line 30) while the model hook overwrites it with a weighted one, so profile averages and review ratings disagree.
9. **Proposals:** `proposalController.ts`:
   - you can apply to gigs that are closed or in progress (no `status === 'open'` check)
   - accepting one proposal doesn't reject the others, and a second proposal can also be accepted, so there can be multiple "selected" freelancers
   - `status` isn't validated
   - routes allow ADMIN but the controllers reject admins
   - freelancers can't withdraw.
10. **Disputes:** `disputeController.ts:6-25`:
    - any logged‑in user can open a dispute on any gig against anyone, and **flip any payment to `disputed`**, freezing other people's money
    - resolving with "refund" only changes a status and never calls Razorpay's refund (the service method exists but is unused).
11. **Gig lifecycle:** there is no endpoint to complete a milestone, complete a gig, or release per‑milestone payments. Releasing a payment doesn't update `totalEarnings`, `completedGigs` or milestone status.
12. **Deleting a gig** (`gigController.ts:120-138`) leaves orphan proposals and payments and can delete a gig with money in escrow. `updateGig` route allows admin but the controller blocks admin.
13. **Notifications:**
    - `notificationService` emits to `` `user:${id}` `` but sockets join the bare `userId` room
    - `getIO()` is never initialised, so it throws and the error is silently swallowed
    - none of the `notify*` methods are called from any controller.
14. **AI Career Coach honesty:** `aiMatchingService.ts:244-330` returns hand‑written "dynamic" text whenever the HF call fails (missing token, model unavailable on `hf-inference`, bad JSON). The user is told "Career analysis complete!" either way. Return a `source: 'ai' | 'fallback'` flag and show it in the UI. An interviewer will ask how the AI works.
15. **Marketplace requires login:** `GET /gigs` and `GET /gigs/:id` are behind `protect` (`gigRoutes.ts:9,11`). Verified 401. A public marketplace should use `optionalAuth`, which exists but is unused.
16. `getGigs` returns drafts and cancelled gigs of all clients, and `limit` is unbounded.
17. `express.json({ limit: '10kb' })` (`app.ts:38`) is small. A long resume pasted into the Career Coach, or a gig with many milestones, will fail with 413.
18. `searchGigs` filters budget only on `budgetMin`. It also crashes if `skills` is passed twice (array → `.split` is not a function).

**Frontend**

19. **The API layer doesn't match the server.** Most `client/src/api/*.ts` functions call endpoints that don't exist (verified):
    - `/chat/conversations` → 404
    - `/admin/stats` → 404 (the server has `/admin/dashboard`)
    - `/users/profile` GET → 500 CastError
    - `/proposals/my-proposals` → 500
    - `/gigs/my-gigs` → 500
    - `/auth/forgot-password` → 404
    - `POST /payments` (the server has `/payments/intent`)
    - `/proposals/gig/:id` POST (the server has `POST /proposals`)
    - `reviews/:id/respond` (the server has `/reply`, with body key `response` vs `comment`)

    Today this is hidden only because the pages don't call them.
20. **Dead navigation** — they fall through `*` and redirect to `/`:
    - Client sidebar "Post a Gig" → `/gigs/create`; the real route is `/client/gigs/new`. **Clients can't reach the post‑gig form from the sidebar.**
    - Freelancer sidebar: Proposals, Projects, Earnings, Reviews, Analytics, Schedule are all dead.
    - Admin sidebar: Gigs, Payments, Disputes, Analytics, Settings are all dead.
    - "Edit Profile" → `/freelancer/profile/edit` is not routed.
    - Footer: 13 links (`/pricing`, `/terms`, `/privacy`, `/freelancers`…) go nowhere.
    - Dashboard buttons "Post New Gig" and "Find Work" have no handlers.
21. **11 page components exist but aren't routed:** `AnalyticsPage`, `SchedulerPage`, `EditProfilePage`, `PaymentPage`, `TransactionHistoryPage`, `ReviewPage`, `WriteReviewPage`, `CreateDisputePage`, `DisputeDetailPage`, `ProjectProgressPage`, `ProposalSubmitPage`, `SearchResultsPage`, and the admin `GigApproval` / `PaymentMonitoring` / `DisputeManagement` / `AnalyticsPage`.
22. **Currency mismatch:** the gig form defaults to `currency: 'USD'` and the UI shows `$`, but Razorpay and the backend default to **INR**.
23. `LoginPage.tsx:25` and `RegisterPage.tsx:125` call `.unwrap()` without try/catch, so every failed login is an unhandled promise rejection in the console.
24. `CreateGigPage` has no milestone editor, attachment upload or location, all of which are spec requirements. After posting, it navigates to `/gigs`, which shows the hardcoded list, so the client never sees their gig.

---

## 5. Medium / low issues and cleanup

- **Duplicate keys in `server/package.json`:** `morgan`, `express-mongo-sanitize`, `compression` (lines 38‑40) and three `@types/*` (57‑59). JSON keeps the last value, which silently downgrades versions. `@types/cookie-parser` is in `dependencies`.
- **`@types/express@5` with `express@4`** causes most of the 63 type errors. Pin `@types/express@^4`.
- **Duplicate Mongoose indexes** (warnings at every boot): `email`, `googleId` on User; `user` on ClientProfile and FreelancerProfile. Remove the extra `schema.index()` calls. `googleId` has `sparse` without `unique`, which is pointless.
- **`npm run lint` fails** in both apps: no ESLint config, and no ESLint at all in `server/`.
- **`npm audit`:**
  - server: 12 vulnerabilities (1 critical, 8 high), including nodemailer, axios, body‑parser, compression, engine.io, qs
  - client: 5 high
  - `multer` 1.x is also deprecated; move to 2.x.
- **Scratch codemod scripts committed at the root:** `fix-imports.js`, `fix-ts-errors.js`, `fix-ts-errors-2.js`. These regex rewrites signal "patched until it compiled" to a reviewer. Delete them.
- `server/scripts/seed-admin.js` **deletes every user**, hardcodes `Admin@1234` with your real name, and prints the password. Make it non‑destructive (upsert) and read credentials from env.
- `seed-gigs.js` assigns gigs to the admin (not a client) and prints "seeded into MongoDB Atlas" even for local DBs.
- `server.ts` has an `unhandledRejection` handler that shuts the whole server down on any stray rejection. That's acceptable, but add graceful Mongo disconnect.
- `uploadToCloudinary` is never called, and `configureCloudinary()` is never invoked.
- `Review` requires `rating` but the hook computes it. Validation runs before the hook, so clients must send a rating that's then thrown away.
- The `Notification` TTL index deletes notifications after 90 days. That's fine; just document it.
- `SocketContext` listens for `onlineUsers` / `userOnline` / `userOffline`, which the server never emits. The "Online" dots are fake.
- `ProtectedRoute` lets admins into client/freelancer routes. That's probably intended, but those pages assume a profile that admins don't have.

---

## 6. Things you may have forgotten (beyond the spec)

| Area | What's missing | Why it matters for a resume project |
|---|---|---|
| **README.md** | None at all | It's the first thing a recruiter sees. Add: overview, screenshots/GIF, architecture diagram, features, tech stack, setup steps, env vars, demo credentials, known limitations. |
| **Live demo** | No deployment config | Deploy: client on Vercel/Netlify, API on Render/Railway, DB on Atlas. A link on your resume is worth more than any bullet. Requires fixing C4 (CORS) and C12 (build). |
| **Tests** | Zero tests | Add a few Jest + Supertest API tests (auth, RBAC, proposal flow) and one Playwright e2e. "Tested with Jest/Supertest" is a strong resume line. |
| **CI** | None | A GitHub Actions workflow running `tsc`, lint and tests on each push. |
| **API docs** | None | A Swagger/OpenAPI page or a Postman collection. |
| **File uploads** | No upload route anywhere | Avatars, portfolio, resume, gig attachments, chat files and dispute evidence all depend on this. Cloudinary is already set up. |
| **Error/loading/empty states** | Pages are static | Real data needs loading skeletons, empty states and error toasts. |
| **Pagination** | Users, messages, reviews and proposals return everything | Fine for a demo, but mention it or add it. |
| **Graceful env check** | Server boots with placeholder secrets | Validate env with zod at startup and refuse to start in production with defaults. |
| **`.env` location** | Root `.env` is read by the server only | The client has no `VITE_API_URL`; production needs it (or a same‑origin deploy). |
| **Git hygiene** | 3 commits, all on one day | Commit in small, meaningful steps from now on (e.g. `fix(auth): block admin self-registration`). Reviewers read history. |

---

## 7. Recommended fix order

**Phase 1 — make it safe and buildable (about 1 day)**
1. C1 role whitelist, C2 strip secrets from responses, and real JWT secrets.
2. C3 Mongoose hooks, C4 dotenv first, C6 refresh flow (server + axios interceptor).
3. C8 field whitelists, C9 regex escaping, C10 text index, C11 seed + `$inc`.
4. C12: pin `@types/express@4`, fix the handler types, fix the 4 client errors. Get `npm run build` green in both apps.
5. Wire the zod validators and `authLimiter`. Delete the `fix-*.js` scripts. Fix the duplicate `package.json` keys.

**Phase 2 — one real end‑to‑end flow (this is what you demo)**
Client posts a gig → it shows in the **real** marketplace → freelancer opens the **real** detail page → **real** proposal → client accepts → chat between them (persisted, socket‑secured) → client funds a milestone in escrow (Razorpay **test mode**) → freelancer marks it done → client releases → both leave reviews → notifications fire at each step.

The steps:
- Use React Query for data fetching. You already have it installed.
- Align `client/src/api/*.ts` with the server routes.
- Delete `INITIAL_GIGS` and the hardcoded dashboards.

**Phase 3 — spec gaps that are cheap and impressive**
- Location search with the existing `2dsphere` index (`$near`). This is literally the "hyperlocal" in the project title.
- Admin: approve gigs (`pending_approval` status), verify freelancers (badge), real stats (revenue via the existing `paymentService.calculatePlatformRevenue`, top categories, success rate).
- Hugging Face embeddings for skill similarity (e.g. `sentence-transformers/all-MiniLM-L6-v2`), so module 2 is truly "AI‑powered", plus a trending‑skills aggregation.
- Cloudinary uploads (avatar, resume, attachments).
- Email verification + password reset (the code in `sendEmail.ts` is ready).
- Freelancer analytics page with Recharts (installed but unused).

**Phase 4 — polish**
README, deployment, tests, CI, Google OAuth, 2FA, scheduler, disputes UI, progress tracker.

---

## 8. Resume advice

Only claim what an interviewer can see working. Right now these are defensible:
- TypeScript MERN architecture with 12 Mongoose models
- JWT + RBAC
- Security middleware
- The Razorpay escrow **design**
- A Hugging Face–powered resume analyzer (once you add the fallback flag)

Once Phase 1–2 are done, a strong bullet could be:

> *Built SkillSphere, a hyperlocal freelance marketplace (React + TypeScript, Redux Toolkit, React Query, Node/Express, MongoDB, Socket.IO): role‑based JWT auth, gig → proposal → escrow (Razorpay) → review workflow, real‑time chat & notifications, geo‑search with 2dsphere indexes, and Hugging Face–based skill matching; deployed on Vercel/Render with CI and API tests.*

Avoid listing Google OAuth, 2FA, video calls, fraud detection or "AI matching" until they actually run.

---

### Appendix — runtime evidence (throwaway local DB, port 5099)

```
1.  register role=admin                    -> 201 role=admin
2.  register response                      -> contains password "$2a$..." and refreshToken
3.  login response                         -> contains password "$2a$..."
4.  POST /auth/refresh                     -> 403 "Invalid refresh token" (always)
5.  password "aaaaaaaa"                    -> 201 accepted
6.  PUT /users/freelancer {averageRating:5, totalEarnings:1e7} -> 200 accepted
8.  GET /search/matches/:gig (skill C++)   -> 500 Invalid regular expression: /C++/i
9.  GET /search/freelancers?q=react        -> 500 text index required for $text query
11. POST /payments/intent                  -> 500 Cannot read properties of null (reading 'orders')
12. PUT /gigs/:id {status:'completed', views:123456} -> 200 accepted
12. POST /reviews                          -> 500 next is not a function
14. GET /chat/conversations (client API)   -> 404 ; /users/profile -> 500 CastError
15. CORS allow-origin for :5173            -> http://localhost:3000
16. GET /gigs without login                -> 401
--  GET seeded gig detail                  -> 500 budgetType is required
--  socket: attacker joined victim room and injected a fake "admin" message -> delivered
tsc: server 63 errors, client 4 errors · npm audit: server 12 (1 critical), client 5 high
```
