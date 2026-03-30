# Lifeboard

A personal productivity dashboard built on **Next.js** (App Router) and **React**. It combines task management, natural-language scheduling against **Google Calendar**, an **LLM-backed agent** for create-and-query flows, and lightweight home-screen widgets (clock, greeting, weather, quotes).

---

## What it does

- **Tasks** — Create, complete, and organize work items with a drag-and-drop friendly UI. Tasks can carry natural-language instructions used when asking the system to find time.
- **AI scheduling** — The app proposes time windows using calendar busy data, surfaces conflicts, and can persist the chosen slot back to the database and Calendar. State is modeled explicitly (e.g. new → processing → proposed → scheduled) so the UI and API stay in sync.
- **Scheduling agent** — A separate path interprets user text for both “book this” and “when am I free?” style requests. **LangGraph** is used so routing, parsing, calendar reads, and finalization are separate steps in a typed state machine rather than one opaque prompt.
- **Auth** — **NextAuth.js** with the **Prisma adapter** stores users, accounts, and sessions in PostgreSQL. Google is used for sign-in and for Calendar API access (OAuth tokens scoped for calendar use).
- **Widgets** — Weather and inspirational quotes are fetched through **first-party API routes** so third-party keys never ship to the browser.
- **Client resilience** — **IndexedDB** (via **Dexie**) holds a local task view and a **pending-operations queue** so scheduling attempts can be retried and reconciled with the server without losing the user’s intent.

---

## Technical stack (decisions, not internals)

| Area | Choice | Rationale |
|------|--------|-----------|
| Framework | Next.js App Router | Server components and route handlers colocate UI, APIs, and auth in one deployable unit. |
| Database | PostgreSQL + Prisma | Relational model for users, tasks, proposals, and NextAuth tables; migrations and type-safe access. |
| Connection strategy | `DATABASE_URL` + optional `DIRECT_URL` | Supports hosts that split pooled (app) vs direct (migrate) connections—common on serverless Postgres. |
| Calendar | Google Calendar API | Single vendor for both identity (OAuth) and authoritative busy/free data for scheduling. |
| LLM | OpenAI via LangChain | Structured outputs and graph composition; costs and abuse are bounded at the HTTP layer (see below). |
| Styling | Tailwind CSS v4, Radix primitives | Utility-first layout plus accessible overlays where needed. |
| Motion | Motion (Framer Motion lineage) | UI polish without owning a full animation system. |

---

## Security and abuse posture (high level)

- **Secrets** — All provider keys (OpenAI, Google, weather, quotes) are **server environment variables**. Widget data is proxied; nothing equivalent to `NEXT_PUBLIC_*` is required for those integrations.
- **Rate limiting** — Expensive and auth-adjacent surfaces use **per-IP and/or per-user limits** at the edge or in route handlers so brute force and runaway LLM usage are damped. Session polling endpoints stay exempt where they would harm UX.
- **Payload and input bounds** — JSON bodies and text fields are **size-capped** so a single request cannot dump megabytes into the model or DB.
- **HTTP headers** — **Content-Security-Policy** (tighter in production than in dev), **frame denial**, **MIME sniffing protection**, **Referrer-Policy**, and a restrictive **Permissions-Policy** reduce common web classes of bugs and embedding abuse.
- **Logging** — Verbose timing/debug logging is **environment-gated**; production logs avoid treating user content as structured log payloads.
- **Operational docs** — Deployment secrets, rotation, and checklist live in-repo docs; database privilege guidance is documented for production roles.

---

## Local development

**Requirements:** Node.js compatible with the pinned Next release, and a PostgreSQL instance.

1. Install dependencies: `npm ci` (or `npm install`).
2. Copy **`.env.example`** to **`.env.local`** and fill values (never commit real secrets).
3. Run Prisma migrations against your database (see Prisma docs for `migrate dev` / `migrate deploy`).
4. Start the app: `npm run dev` → [http://localhost:3000](http://localhost:3000).

`postinstall` runs **`prisma generate`** so the client matches the schema after installs.

---

## Quality and supply chain

- **ESLint** (`npm run lint`) is the primary static check for the app.
- A **GitHub Actions** workflow (at the repository root) runs install, lockfile integrity, lint, and a high-threshold **`npm audit`** on pushes/PRs—treat failures as deploy gates if you want stricter hygiene.

---

## Deployment notes

- **Vercel (or similar):** Set environment variables to match `.env.example` and your provider consoles. Production **must** use a canonical **`https://` `NEXTAUTH_URL`** and a strong **`NEXTAUTH_SECRET`**; Google OAuth redirect URIs must match the deployed origin.
- If this folder is not the Git repository root, configure the host’s **project root** to this directory so installs and builds run here.

For rotation, hosting-specific setup, and checklists, see **[docs/PRODUCTION_SECRETS.md](./docs/PRODUCTION_SECRETS.md)**. For database role hardening, see **[docs/DB_LEAST_PRIVILEGE.md](./docs/DB_LEAST_PRIVILEGE.md)**.

---

## License / contributing

Private project unless stated otherwise in the parent repository. Adjust this section if you open-source the codebase.
