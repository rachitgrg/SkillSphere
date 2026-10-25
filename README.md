# SkillSphere — Intelligent Hyperlocal Freelance Ecosystem

A MERN (TypeScript) platform connecting clients with verified local freelancers.

> The full README (setup, architecture, features, demo accounts) is written in Phase 5 of
> `CLAUDE_CODE_PLAN.md`. This file currently records only the facts that later phases rely on.

## Dependency audit

Last checked: 2026-10-25 (`npm audit` and `npm audit --omit=dev` in `/`, `server/`, `client/`).

| Package | Result |
|---|---|
| root | 0 vulnerabilities |
| server | 0 vulnerabilities |
| client | 0 vulnerabilities |

Upgrades made to get there: `multer` 1.x → 2.x, `nodemailer` 6.x → 10.x, `zod` 3.x → 4.x
(both apps), plus non-breaking `npm audit fix`.
