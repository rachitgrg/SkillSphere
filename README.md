# SkillSphere — Intelligent Hyperlocal Freelance Ecosystem

A MERN (TypeScript) platform connecting clients with verified local freelancers.

> The full README (setup, architecture, features, demo accounts) is written in Phase 5 of
> `CLAUDE_CODE_PLAN.md`. This file currently records only the facts that later phases rely on.

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
