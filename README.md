# Lifeboard

A personal productivity dashboard built on **Next.js** (App Router) and **React**. It combines task management, natural-language scheduling against **Google Calendar**, an **LLM-backed scheduling agent**, and lightweight home-screen widgets (clock, greeting, weather, quotes).

**UI Mockups (Figma):** [Lifeboard Design](https://www.figma.com/design/hWSTkY7dVyAbxoZVxs5phx/Lifeboard?node-id=0-1&t=Is7fH2M8o8JCQe41-1)

---

## Features
- **Natural Language Task Ingestion**: A single text field that uses LLM-based intent parsing to understand complex scheduling requests without manual date-picking.
- **Autonomous Conflict Resolution**: A LangGraph-powered agent that iteratively reasons through schedule overlaps by fetching Google Calendar events and proposing optimal gaps.
- **Human-in-the-Loop (HITL) Validation**: A "Safety First" workflow where the agent presents proposed schedule changes for user approval before modifying the Google Calendar via OAuth.
- **Hybrid Offline Persistence**: A robust data layer utilizing IndexedDB for immediate local capture and PostgreSQL (via Prisma) for cloud synchronization and agent processing.
- **Real-time Task Tracking**: A dynamic UI that updates with checkboxes and "Processing" states, ensuring users always know the status of their AI agent's reasoning.

---

## What it does technically

- **Tasks** - Create, complete, edit, and organize tasks with clear status transitions and conflict feedback.
- **AI scheduling** - Converts natural-language requests into schedule proposals, checks availability against Google Calendar, and saves approved outcomes.
- **State consistency** - Scheduling status is modeled explicitly (for example, new -> processing -> proposed -> scheduled) so UI state and persisted backend state remain aligned.
- **Scheduling architecture** - The agent layer is a single LangGraph workflow with intent-based branches (create task vs query availability), split into focused nodes for routing, structured extraction, calendar reads, availability computation, and final response shaping.
- **Auth + calendar access** - NextAuth with Google OAuth handles sign-in and calendar authorization, while Prisma persists users, sessions, and task data in PostgreSQL.
- **Private widget integrations** - Weather and quote widgets go through first-party API routes so third-party API keys stay server-side.
- **Resilience** - IndexedDB keeps a local task view plus a pending-operation queue for retry/sync behavior during network disruption.

---

## Technical decisions

| Area | Choice | Why |
|------|--------|-----|
| Framework | Next.js App Router | Unifies UI + server routes in one deployable app. |
| Data | PostgreSQL (Supabase) + Prisma | Strong relational model and type-safe access for task and auth entities. |
| Auth | NextAuth + Prisma Adapter | Standardized session/account flows with database-backed sessions. |
| AI orchestration | LangGraph + OpenAI | Better control and observability than single-shot prompts. |
| Calendar | Google Calendar API | Authoritative free/busy source for scheduling decisions. |
| Client persistence | IndexedDB (Dexie) | Local-first UX and operation replay when connectivity is unstable. |
| Security posture | Server-only secrets, rate limits, payload caps, security headers | Reduces abuse and accidental key exposure. |

---

## Tech stack

| Layer | Technologies |
|--------|----------------|
| **App & UI** | Next.js (App Router), React, TypeScript, Tailwind CSS v4 |
| **Components** | **shadcn/ui** (built on **Radix UI** primitives), class-variance-authority, Motion, Lucide |
| **APIs** | Next.js Route Handlers, `googleapis` (Google Calendar) |
| **Auth** | NextAuth.js, Google OAuth 2.0, `@next-auth/prisma-adapter` |
| **Data** | **PostgreSQL** (database hosted on **Supabase**), Prisma ORM; IndexedDB (Dexie) on the client |
| **Validation & schemas** | Zod (API payloads, structured LLM outputs, shared types) |
| **AI** | LangGraph + LangChain (`@langchain/openai`), OpenAI API |
| **Security** | Next.js **middleware** (auth-route throttling), **CSP** and HTTP security headers in `next.config`, request **payload caps** and **rate limits** in route handlers, server-only third-party keys; **ESLint** (`eslint-config-next`) + **`npm audit`** in GitHub Actions |
| **Deployment** | **Vercel** |
| **Tooling** | ESLint, Prisma Migrate, GitHub Actions (security CI) |

---

## Quick start

```bash
git clone https://github.com/nsaia/Lifeboard.git
cd Lifeboard/lifeboard
npm install
npm run dev
```

Create `lifeboard/.env.local` from `lifeboard/.env.example` and fill required values before running auth/scheduling flows.

