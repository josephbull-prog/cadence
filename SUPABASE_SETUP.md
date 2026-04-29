# Cadence — Complete Supabase & Google OAuth Setup Guide

Estimated time: 20–30 minutes. No prior Supabase experience needed.

---

## Part 1 — Create your Supabase project

### 1.1 Sign up / sign in

1. Go to **[supabase.com](https://supabase.com)** and click **Start your project**.
2. Sign in with GitHub (recommended) or create an account with email.

### 1.2 Create a new project

1. Click **New project**.
2. Select your organisation (or create a personal one).
3. Fill in:
   - **Name** — e.g. `cadence`
   - **Database password** — use the generator, then **save it somewhere safe**
   - **Region** — pick the one closest to you (e.g. `eu-west-2` for UK)
4. Click **Create new project** and wait ~2 minutes for provisioning.

---

## Part 2 — Get your API keys

1. In your project dashboard, click **Settings** (cog icon, bottom-left).
2. Click **API** in the sidebar.
3. Note down:
   - **Project URL** — looks like `https://abcdefghijkl.supabase.co`
   - **anon / public** key — a long string starting with `eyJ…`

4. In your Cadence project folder, copy the example env file and fill it in:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...your-anon-key...
VITE_TEST_MODE=false
```

---

## Part 3 — Run the database schema

Go to your Supabase project → **SQL Editor** (left sidebar, looks like `</>`).

Click **New query**, paste the entire block below, and click **Run**.

```sql
-- ============================================================
-- CADENCE — Full database schema
-- Paste this entire block and run it once.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────
create table public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  display_name                text,
  timetable_type              text default '2_week'
                              check (timetable_type in ('1_week','2_week')),
  cycle_start_date            date,
  cover_standard_instructions text
);

-- ─── holidays ────────────────────────────────────────────────
create table public.holidays (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  label      text not null
);

-- ─── schemes_of_work ─────────────────────────────────────────
-- Created before classes so classes can FK to it
create table public.schemes_of_work (
  id      uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title   text not null,
  lessons text[] not null default '{}'
);

-- ─── classes ─────────────────────────────────────────────────
create table public.classes (
  id                        uuid primary key default uuid_generate_v4(),
  user_id                   uuid not null references public.profiles(id) on delete cascade,
  name                      text not null,
  room                      text,
  color_code                text,
  sow_id                    uuid references public.schemes_of_work(id) on delete set null,
  book_brilliant_done       boolean default false,
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

-- ─── lesson_plans ─────────────────────────────────────────────
create table public.lesson_plans (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  class_id       uuid references public.classes(id) on delete cascade,
  date           date,
  period_number  integer,
  plan_content   text,
  notes          text,
  resource_url   text,
  resource_label text,
  sow_index      integer,
  sow_skipped    boolean default false,
  is_off_piste   boolean default false
);

-- ─── milestones ──────────────────────────────────────────────
create table public.milestones (
  id       uuid primary key default uuid_generate_v4(),
  user_id  uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  date     date not null,
  label    text not null,
  type     text not null default 'other'
           check (type in ('assessment','deadline','other'))
);

-- ─── cover_slips ─────────────────────────────────────────────
create table public.cover_slips (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  class_id          uuid not null references public.classes(id) on delete cascade,
  date              date,
  period_number     integer,
  room              text,
  teacher_name      text,
  key_question      text,
  task_instructions text,
  buddy_room        text,
  lesson_plan_id    uuid references public.lesson_plans(id) on delete set null
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

You should see **Success. No rows returned** in the results panel.

---

## Part 4 — Enable Row Level Security

In the SQL Editor, click **New query**, paste this block, and run it:

```sql
-- ============================================================
-- ROW LEVEL SECURITY
-- Every table is locked down to the owning user only.
-- ============================================================

alter table public.profiles         enable row level security;
alter table public.holidays         enable row level security;
alter table public.schemes_of_work  enable row level security;
alter table public.classes          enable row level security;
alter table public.timetable_slots  enable row level security;
alter table public.lesson_plans     enable row level security;
alter table public.milestones       enable row level security;
alter table public.cover_slips      enable row level security;
alter table public.homework         enable row level security;
alter table public.class_notes      enable row level security;
alter table public.general_notes    enable row level security;

-- profiles: each user owns only their own row
create policy "profiles_own_row"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- All other tables: user_id must match the logged-in user
create policy "holidays_own"       on public.holidays       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sow_own"            on public.schemes_of_work for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "classes_own"        on public.classes         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "slots_own"          on public.timetable_slots for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "plans_own"          on public.lesson_plans    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "milestones_own"     on public.milestones      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cover_slips_own"    on public.cover_slips     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "homework_own"       on public.homework        for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "class_notes_own"    on public.class_notes     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "general_notes_own"  on public.general_notes   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

---

## Part 5 — Auto-create profile on first login

In the SQL Editor, run this block. It creates a database trigger that automatically makes a `profiles` row the first time someone signs in:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop and recreate the trigger cleanly
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
```

---

## Part 6 — Set up Google OAuth

### 6.1 Create OAuth credentials in Google Cloud

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**.
2. Click the project selector at the top → **New project**.
   - Name it `Cadence` (or anything you like).
   - Click **Create**.
3. Make sure your new project is selected in the dropdown.
4. In the left menu: **APIs & Services → OAuth consent screen**.
   - User type: **External** → click **Create**.
   - Fill in:
     - **App name**: Cadence
     - **User support email**: your email
     - **Developer contact email**: your email
   - Click **Save and Continue** through the remaining steps (no scopes needed).
   - On the Summary page click **Back to Dashboard**.
5. In the left menu: **APIs & Services → Credentials**.
6. Click **+ Create Credentials → OAuth client ID**.
7. Application type: **Web application**.
8. Name: `Cadence Web`.
9. Under **Authorised redirect URIs**, click **+ Add URI** and add:
   ```
   https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
   ```
   Replace `YOUR-PROJECT-REF` with the subdomain from your Supabase URL (the part before `.supabase.co`).
10. Click **Create**.
11. A popup appears with your **Client ID** and **Client secret** — copy both.

### 6.2 Configure Supabase to use Google

1. In your Supabase project: **Authentication** (left sidebar, person icon).
2. Click **Providers**.
3. Find **Google** and toggle it **on**.
4. Paste in the **Client ID** and **Client secret** from Google.
5. Click **Save**.

### 6.3 Set your site URL

1. Still in **Authentication**, click **URL Configuration**.
2. Set **Site URL** to your production URL. If using Netlify it will be something like:
   ```
   https://cadence-yourname.netlify.app
   ```
   If you haven't deployed yet, come back and set this after deploying (Step 8).
3. Under **Redirect URLs**, add:
   ```
   http://localhost:5173/**
   ```
   This allows local development to work.
4. Click **Save**.

---

## Part 7 — Local development

```bash
# Install dependencies (run once)
npm install

# Start the dev server
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)**.

Click **Continue with Google** — you should be redirected to Google, and then back to Cadence.

If you get a redirect error, double-check:
- The redirect URI in Google Cloud Console matches your Supabase URL exactly
- `http://localhost:5173/**` is in Supabase's Redirect URLs list
- Your `.env.local` has the correct Supabase URL and anon key

---

## Part 8 — Deploy to Netlify

1. Push your project to a GitHub repository.
2. Go to **[app.netlify.com](https://app.netlify.com)** → **Add new site → Import an existing project**.
3. Connect GitHub and select your repo.
4. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Show advanced** → **New variable** and add:
   | Key | Value |
   |-----|-------|
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon key |
   | `VITE_TEST_MODE` | `false` |
6. Click **Deploy site**.
7. Once deployed, copy the `.netlify.app` URL.
8. Go back to **Supabase → Authentication → URL Configuration** and set **Site URL** to your Netlify URL.
9. Also add the Netlify URL to **Redirect URLs**:
   ```
   https://cadence-yourname.netlify.app/**
   ```
10. In Google Cloud Console → **Credentials** → your OAuth client → add another **Authorised redirect URI**:
    ```
    https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
    ```
    (This is already there if you added it in Step 6.1 — no change needed.)

---

## Part 9 — Test Mode (no account needed)

If you want to try Cadence without any setup at all:

1. Run `npm run dev`.
2. On the login page, click **Try in Test Mode**.
3. All data is stored in your browser's `localStorage` — nothing leaves your device.

To disable Test Mode later, go to **Settings → Developer → Test Mode** toggle.

> ⚠️ Test Mode data is not backed up. Clearing browser data will erase it.

---

## Part 10 — Troubleshooting

**"new row violates row-level security policy"**
You ran Part 4 but the trigger from Part 5 didn't fire (so no `profiles` row was created).
Run this in the SQL Editor to create your profile manually, replacing the UUID with your actual user ID:
```sql
-- Find your user ID first:
select id, email from auth.users;
-- Then insert:
insert into public.profiles (id) values ('your-user-uuid-here') on conflict do nothing;
```

**Google sign-in redirects to an error page**
- Check the Authorised redirect URI in Google Cloud Console is exactly `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` — no trailing slash, correct project ref.
- Check Supabase → Authentication → URL Configuration has your site URL set correctly.

**Blank page after Netlify deploy**
- Check the Netlify function log for errors.
- Most likely `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` environment variables are missing or have extra spaces.
- Make sure you deployed *after* adding the environment variables (redeploy if needed).

**"Invalid API key"**
You copied the `service_role` key instead of the `anon` key. The anon key is the shorter one under "anon / public" in Supabase → Settings → API.

**OAuth consent screen says "App not verified"**
For personal use this is fine — click **Advanced → Go to Cadence (unsafe)**. If you want to remove this warning you would need to complete Google's OAuth verification process (not necessary for a personal tool).

---

## Part 11 — Schema migrations (existing installations)

If you deployed an earlier version of Cadence and are updating, run this SQL to add new columns:

```sql
-- Added in v2: resource links on lesson plans, standard cover slip instructions
alter table public.lesson_plans
  add column if not exists resource_url    text,
  add column if not exists resource_label  text,
  add column if not exists sow_skipped     boolean default false;

alter table public.profiles
  add column if not exists cover_standard_instructions text;
```
