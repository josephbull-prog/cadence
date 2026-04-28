# Cadence — Supabase Setup Guide

This document walks you through setting up Supabase for Cadence from scratch, including
all tables, RLS policies, and Google OAuth. It takes about 15–20 minutes.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New project**.
3. Choose your organisation, give the project a name (e.g. `cadence`), set a database password, and choose a region close to you.
4. Click **Create new project** and wait ~2 minutes for provisioning.

---

## 2. Get Your API Keys

1. In your project, go to **Settings → API**.
2. Copy:
   - **Project URL** → this becomes `VITE_SUPABASE_URL`
   - **anon / public** key → this becomes `VITE_SUPABASE_ANON_KEY`
3. Create a `.env.local` file in the Cadence project root:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_TEST_MODE=false
```

---

## 3. Run the Database Schema

Go to **SQL Editor** in Supabase and run the following SQL in one go:

```sql
-- ============================================================
-- CADENCE DATABASE SCHEMA
-- Run this entire block in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  timetable_type  text default '2_week' check (timetable_type in ('1_week','2_week')),
  cycle_start_date date
);

-- ─── holidays ────────────────────────────────────────────────
create table public.holidays (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  label       text not null
);

-- ─── classes ─────────────────────────────────────────────────
create table public.classes (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  name                    text not null,
  room                    text,
  color_code              text,
  sow_id                  uuid,  -- FK added after schemes_of_work is created below
  book_brilliant_done     boolean default false,
  book_brilliant_reset_date date
);

-- ─── timetable_slots ─────────────────────────────────────────
create table public.timetable_slots (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  class_id      uuid not null references public.classes(id) on delete cascade,
  day_of_week   integer not null check (day_of_week between 1 and 5),
  period_number integer not null check (period_number between 1 and 6),
  cycle_week    integer not null default 1 check (cycle_week in (1, 2))
);

-- ─── schemes_of_work ─────────────────────────────────────────
create table public.schemes_of_work (
  id      uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title   text not null,
  lessons text[] not null default '{}'
);

-- Now add the FK from classes to schemes_of_work
alter table public.classes
  add constraint classes_sow_id_fkey
  foreign key (sow_id) references public.schemes_of_work(id) on delete set null;

-- ─── lesson_plans ─────────────────────────────────────────────
create table public.lesson_plans (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  class_id      uuid not null references public.classes(id) on delete cascade,
  date          date,
  period_number integer,
  plan_content  text,
  notes         text,
  sow_index     integer,
  is_off_piste  boolean default false
);

-- ─── milestones ──────────────────────────────────────────────
create table public.milestones (
  id       uuid primary key default uuid_generate_v4(),
  user_id  uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  date     date not null,
  label    text not null,
  type     text not null default 'other' check (type in ('assessment','deadline','other'))
);

-- ─── cover_slips ─────────────────────────────────────────────
create table public.cover_slips (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  class_id        uuid not null references public.classes(id) on delete cascade,
  date            date,
  period_number   integer,
  room            text,
  teacher_name    text,
  key_question    text,
  task_instructions text,
  buddy_room      text,
  lesson_plan_id  uuid references public.lesson_plans(id) on delete set null
);

-- ─── homework ────────────────────────────────────────────────
create table public.homework (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  date_set    date not null,
  date_due    date not null,
  description text not null
);

-- ─── class_notes ─────────────────────────────────────────────
create table public.class_notes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  content    text
);

-- ─── general_notes ───────────────────────────────────────────
create table public.general_notes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  title      text,
  content    text
);
```

---

## 4. Enable Row Level Security (RLS)

Run this SQL block to enable RLS on every table and add policies:

```sql
-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles         enable row level security;
alter table public.holidays         enable row level security;
alter table public.classes          enable row level security;
alter table public.timetable_slots  enable row level security;
alter table public.schemes_of_work  enable row level security;
alter table public.lesson_plans     enable row level security;
alter table public.milestones       enable row level security;
alter table public.cover_slips      enable row level security;
alter table public.homework         enable row level security;
alter table public.class_notes      enable row level security;
alter table public.general_notes    enable row level security;

-- profiles: user can only see and edit their own row
create policy "profiles: own row"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- Helper macro for the rest (user_id must equal auth.uid())
-- Repeat for each table:

create policy "holidays: own rows"
  on public.holidays for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "classes: own rows"
  on public.classes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "timetable_slots: own rows"
  on public.timetable_slots for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "schemes_of_work: own rows"
  on public.schemes_of_work for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lesson_plans: own rows"
  on public.lesson_plans for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "milestones: own rows"
  on public.milestones for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "cover_slips: own rows"
  on public.cover_slips for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "homework: own rows"
  on public.homework for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "class_notes: own rows"
  on public.class_notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "general_notes: own rows"
  on public.general_notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

---

## 5. Auto-create Profile on First Login

Run this SQL to create a database function + trigger that automatically creates a
`profiles` row when a user signs in for the first time:

```sql
-- Function to create a profile row on new user sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger: fire after a new auth user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 6. Set Up Google OAuth

### 6a. Create a Google OAuth App

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (or select an existing one).
3. Go to **APIs & Services → Credentials**.
4. Click **Create Credentials → OAuth client ID**.
5. Select **Web application**.
6. Add these **Authorised redirect URIs**:
   - `https://your-project-ref.supabase.co/auth/v1/callback`
   - `http://localhost:5173/` (for local dev)
7. Copy your **Client ID** and **Client Secret**.

### 6b. Configure Supabase

1. In Supabase, go to **Authentication → Providers**.
2. Find **Google** and enable it.
3. Paste in your **Client ID** and **Client Secret**.
4. Save.

### 6c. Add your site URL

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your production URL (e.g. `https://cadence.netlify.app`).
3. Add your local dev URL to **Redirect URLs**: `http://localhost:5173/**`

---

## 7. Deploy to Netlify

1. Push the project to GitHub.
2. In [Netlify](https://app.netlify.com), click **Add new site → Import an existing project**.
3. Connect your GitHub repo.
4. Set build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Add environment variables under **Site settings → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_TEST_MODE` = `false`
6. Deploy.
7. Copy the Netlify URL and add it to Supabase's **Authentication → URL Configuration → Site URL**.

---

## 8. Local Development

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

---

## 9. Test Mode (No Supabase Required)

If you just want to try Cadence without any setup:

1. Run `npm run dev`.
2. On the login page, click **"Try in Test Mode"**.
3. All data is stored in your browser's `localStorage`.
4. To switch back to Supabase mode: go to **Settings → Developer → Test Mode** toggle.

You can also set `VITE_TEST_MODE=true` in `.env.local` to always start in test mode.

> ⚠️ Test mode data is not synced anywhere. Clearing browser data will erase it.

---

## 10. Useful Supabase Queries

Check your data in the Supabase **Table Editor** or run these in the SQL Editor:

```sql
-- See all profiles
select * from profiles;

-- See a user's classes
select * from classes where user_id = 'your-user-uuid';

-- Check RLS is working (should return 0 rows when not logged in)
select count(*) from classes;
```

---

## Troubleshooting

**"new row violates row-level security policy"**
→ Make sure you ran the RLS policy SQL block in Step 4. Check that `user_id` is being
set correctly in your insert calls.

**Google OAuth redirect fails**
→ Double-check the redirect URI in Google Cloud Console exactly matches
`https://your-project-ref.supabase.co/auth/v1/callback`.

**Profile not created on login**
→ Check the trigger was created (Step 5). You can manually insert:
```sql
insert into profiles (id) values (auth.uid());
```

**Blank screen after deploy**
→ Check Netlify's function logs. Most likely the `VITE_SUPABASE_URL` or
`VITE_SUPABASE_ANON_KEY` env vars are missing.
