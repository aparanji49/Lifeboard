# Lifeboard
All-in-one full stack productivity web application for busy lives and creative minds.

**UI Mockups (Figma):** https://www.figma.com/design/hWSTkY7dVyAbxoZVxs5phx/Lifeboard?node-id=0-1&t=Is7fH2M8o8JCQe41-1

## Features

- **Natural Language Task Ingestion**: A single text field that uses LLM-based intent parsing to understand complex scheduling requests without manual date-picking.
- **Autonomous Conflict Resolution**: A LangGraph-powered agent that iteratively reasons through schedule overlaps by fetching Google Calendar events and proposing optimal gaps.
- **Human-in-the-Loop (HITL) Validation**: A "Safety First" workflow where the agent presents proposed schedule changes for user approval before modifying the Google Calendar via OAuth.
- **Hybrid Offline Persistence**: A robust data layer utilizing IndexedDB for immediate local capture and PostgreSQL (via Prisma) for cloud synchronization and agent processing.
- **Real-time Task Tracking**: A dynamic UI that updates with checkboxes and "Processing" states, ensuring users always know the status of their AI agent's reasoning.

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS, Shadcn UI, TanStack Query
- **AI & Orchestration**: LangGraph (Stateful Agents), OpenAI API
- **Backend & Auth**: Next.js API Routes, Google OAuth 2.0, Supabase
- **Database & ORM**: PostgreSQL, Prisma ORM, IndexedDB

### Installation

```bash
git clone https://github.com/nsaia/Lifeboard.git
cd Lifeboard
npm install
npm run dev
```

