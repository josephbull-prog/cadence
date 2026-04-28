# Cadence — Teacher Planner

A responsive, offline-capable Progressive Web App for managing your timetable,
lesson planning, Schemes of Work, cover slips, homework, and class admin.

## Features

- **A/B cyclical timetable** aware of school holidays
- **Push Forward** — cascade lessons when one is missed
- **SoW autocomplete** — ghost text suggestions from your Scheme of Work
- **Milestone markers** — assessments and deadlines in the class timeline
- **Cover slip generator** with clean print output
- **Homework tracker** across all classes
- **Book Brilliant** marking flag (per half term, per class)
- **Class notes** and general freeform notes
- **Test Mode** — run entirely in localStorage, no account needed

## Quick Start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase credentials, OR set VITE_TEST_MODE=true
npm run dev
```

## Setup

- **Test Mode** (no account): click "Try in Test Mode" on the login page
- **Full setup with Supabase**: see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React |
| Styling | Tailwind CSS |
| Data | TanStack Query |
| Backend | Supabase (Postgres + Auth + RLS) |
| Auth | Google OAuth via Supabase |
| PWA | Vite PWA Plugin |
| Hosting | Netlify |
# cadence
