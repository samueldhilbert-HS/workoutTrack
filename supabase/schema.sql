-- ============================================================
-- FITNESS TRACKER — FULL SUPABASE SCHEMA
-- Correct order: extensions → tables → functions/triggers → seed → RLS
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================
-- 2. TABLES (dependency order — no forward references)
-- ============================================================

-- profiles (depends only on auth.users)
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  full_name           text,
  username            text unique not null,
  avatar_url          text,
  calorie_goal        integer default 2000 check (calorie_goal > 0),
  protein_goal        integer default 150  check (protein_goal > 0),
  target_weight       decimal(6,2),
  weight_unit         text default 'lbs' check (weight_unit in ('lbs', 'kg')),
  privacy             text default 'friends_only' check (privacy in ('public', 'friends_only', 'private')),
  is_admin            boolean default false not null,
  is_suspended        boolean default false not null,
  onboarding_complete boolean default false not null,
  streak_count        integer default 0,
  last_workout_date   date,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- friendships (depends on profiles)
create table public.friendships (
  id           uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint no_self_friend check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create index friendships_addressee_idx on public.friendships(addressee_id);
create index friendships_status_idx    on public.friendships(status);

-- exercises (global library + user custom; depends on profiles)
create table public.exercises (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  muscle_group text,
  equipment    text,
  is_custom    boolean default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz default now()
);

create index exercises_muscle_idx on public.exercises(muscle_group);

-- workouts (depends on profiles)
create table public.workouts (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  name             text,
  notes            text,
  started_at       timestamptz default now(),
  ended_at         timestamptz,
  duration_minutes integer,
  total_volume     decimal(10,2),
  created_at       timestamptz default now()
);

create index workouts_user_id_idx    on public.workouts(user_id);
create index workouts_started_at_idx on public.workouts(started_at desc);

-- workout_exercises (depends on workouts, exercises)
create table public.workout_exercises (
  id             uuid primary key default uuid_generate_v4(),
  workout_id     uuid not null references public.workouts(id) on delete cascade,
  exercise_id    uuid not null references public.exercises(id),
  exercise_order integer not null,
  notes          text,
  created_at     timestamptz default now()
);

create index workout_exercises_workout_idx on public.workout_exercises(workout_id);

-- sets (depends on workout_exercises)
create table public.sets (
  id                  uuid primary key default uuid_generate_v4(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number          integer not null,
  reps                integer check (reps >= 0),
  weight              decimal(7,2) check (weight >= 0),
  weight_unit         text default 'lbs' check (weight_unit in ('lbs', 'kg')),
  rpe                 decimal(3,1) check (rpe between 1 and 10),
  is_pr               boolean default false,
  created_at          timestamptz default now()
);

create index sets_workout_exercise_idx on public.sets(workout_exercise_id);

-- personal_records (depends on profiles, exercises, workouts)
create table public.personal_records (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  weight      decimal(7,2) not null,
  reps        integer not null,
  weight_unit text default 'lbs' check (weight_unit in ('lbs', 'kg')),
  achieved_at timestamptz default now(),
  workout_id  uuid references public.workouts(id) on delete set null,
  unique (user_id, exercise_id)
);

create index personal_records_user_idx     on public.personal_records(user_id);
create index personal_records_exercise_idx on public.personal_records(exercise_id);

-- workout_plans (depends on profiles)
create table public.workout_plans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  is_public   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index workout_plans_user_idx on public.workout_plans(user_id);

-- workout_plan_days (depends on workout_plans)
create table public.workout_plan_days (
  id          uuid primary key default uuid_generate_v4(),
  plan_id     uuid not null references public.workout_plans(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  name        text,
  created_at  timestamptz default now()
);

create index workout_plan_days_plan_idx on public.workout_plan_days(plan_id);

-- workout_plan_day_exercises (depends on workout_plan_days, exercises)
create table public.workout_plan_day_exercises (
  id             uuid primary key default uuid_generate_v4(),
  plan_day_id    uuid not null references public.workout_plan_days(id) on delete cascade,
  exercise_id    uuid not null references public.exercises(id),
  exercise_order integer not null,
  target_sets    integer,
  target_reps    text,
  target_weight  decimal(7,2),
  notes          text
);

-- nutrition_logs (depends on profiles)
create table public.nutrition_logs (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  log_date       date not null default current_date,
  total_calories integer default 0,
  total_protein  decimal(7,2) default 0,
  total_carbs    decimal(7,2) default 0,
  total_fat      decimal(7,2) default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (user_id, log_date)
);

create index nutrition_logs_user_date_idx on public.nutrition_logs(user_id, log_date desc);

-- nutrition_entries (depends on nutrition_logs)
create table public.nutrition_entries (
  id               uuid primary key default uuid_generate_v4(),
  nutrition_log_id uuid not null references public.nutrition_logs(id) on delete cascade,
  raw_text         text not null,
  food_items       jsonb,
  calories         integer,
  protein          decimal(7,2),
  carbs            decimal(7,2),
  fat              decimal(7,2),
  meal_type        text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at       timestamptz default now()
);

create index nutrition_entries_log_idx on public.nutrition_entries(nutrition_log_id);

-- weight_logs (depends on profiles)
create table public.weight_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  weight      decimal(6,2) not null check (weight > 0),
  weight_unit text default 'lbs' check (weight_unit in ('lbs', 'kg')),
  log_date    date not null default current_date,
  notes       text,
  created_at  timestamptz default now(),
  unique (user_id, log_date)
);

create index weight_logs_user_date_idx on public.weight_logs(user_id, log_date desc);

-- achievements (no external deps)
create table public.achievements (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  description text,
  icon        text,
  badge_color text default '#6366f1',
  type        text check (type in ('streak', 'pr', 'weight', 'social', 'nutrition')),
  criteria    jsonb,
  created_at  timestamptz default now()
);

-- user_achievements (depends on profiles, achievements)
create table public.user_achievements (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id),
  achieved_at    timestamptz default now(),
  unique (user_id, achievement_id)
);

create index user_achievements_user_idx on public.user_achievements(user_id);

-- reactions (depends on profiles, workouts)
create table public.reactions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, workout_id)
);

create index reactions_workout_idx on public.reactions(workout_id);

-- invite_links (depends on profiles)
create table public.invite_links (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text unique not null default encode(gen_random_bytes(12), 'hex'),
  used_by    uuid references public.profiles(id),
  used_at    timestamptz,
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);

create index invite_links_token_idx on public.invite_links(token);

-- notifications (depends on profiles)
create table public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('friend_request','friend_accepted','reaction','pr','achievement','milestone')),
  title      text not null,
  body       text,
  data       jsonb,
  read       boolean default false,
  created_at timestamptz default now()
);

create index notifications_user_read_idx on public.notifications(user_id, read, created_at desc);

-- ============================================================
-- 3. FUNCTIONS & TRIGGERS (tables now exist)
-- ============================================================

-- Generic updated_at setter
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger friendships_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

create trigger workout_plans_updated_at
  before update on public.workout_plans
  for each row execute function public.set_updated_at();

create trigger nutrition_logs_updated_at
  before update on public.nutrition_logs
  for each row execute function public.set_updated_at();

-- Auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, username, is_admin)
  values (
    new.id,
    new.email,
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '_', 'g')),
    new.email = 'samueldhilbert@gmail.com'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-recalculate nutrition_logs totals when entries change
create or replace function public.recalculate_nutrition_log()
returns trigger
language plpgsql
security definer
as $$
declare
  log_id uuid;
begin
  if TG_OP = 'DELETE' then
    log_id := old.nutrition_log_id;
  else
    log_id := new.nutrition_log_id;
  end if;

  update public.nutrition_logs
  set
    total_calories = coalesce((select sum(calories) from public.nutrition_entries where nutrition_log_id = log_id), 0),
    total_protein  = coalesce((select sum(protein)  from public.nutrition_entries where nutrition_log_id = log_id), 0),
    total_carbs    = coalesce((select sum(carbs)    from public.nutrition_entries where nutrition_log_id = log_id), 0),
    total_fat      = coalesce((select sum(fat)      from public.nutrition_entries where nutrition_log_id = log_id), 0)
  where id = log_id;

  return null;
end;
$$;

create trigger nutrition_entry_changed
  after insert or update or delete on public.nutrition_entries
  for each row execute function public.recalculate_nutrition_log();

-- Helper: check if two users are friends
create or replace function public.are_friends(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = user_a and addressee_id = user_b)
        or
        (requester_id = user_b and addressee_id = user_a)
      )
  );
$$;

-- Helper: check if the current user is an admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Helper: check if the current user can view a given profile
create or replace function public.can_view_profile(target_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select
    target_user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles
      where id = target_user_id
        and privacy = 'public'
        and not is_suspended
    )
    or (
      exists (
        select 1 from public.profiles
        where id = target_user_id
          and privacy = 'friends_only'
          and not is_suspended
      )
      and public.are_friends(auth.uid(), target_user_id)
    );
$$;

-- ============================================================
-- 4. SEED DATA
-- ============================================================

insert into public.achievements (name, description, icon, badge_color, type, criteria) values
  ('First Workout',    'Logged your very first workout',         '🏋️', '#6366f1', 'streak',    '{"workouts": 1}'),
  ('7-Day Streak',     'Worked out 7 days in a row',             '🔥', '#f59e0b', 'streak',    '{"streak_days": 7}'),
  ('30-Day Streak',    'Worked out 30 days in a row',            '⚡', '#ef4444', 'streak',    '{"streak_days": 30}'),
  ('First PR',         'Set your first personal record',         '🏆', '#f59e0b', 'pr',        '{"prs": 1}'),
  ('PR Machine',       'Set 10 personal records',                '💪', '#10b981', 'pr',        '{"prs": 10}'),
  ('First Checkin',    'Logged your first body weight',          '⚖️',  '#6366f1', 'weight',    '{"weigh_ins": 1}'),
  ('Goal Reached',     'Hit your target weight goal',            '🎯', '#10b981', 'weight',    '{}'),
  ('First Friend',     'Added your first friend',                '🤝', '#3b82f6', 'social',    '{"friends": 1}'),
  ('Social Butterfly', 'Added 5 friends',                        '🦋', '#ec4899', 'social',    '{"friends": 5}'),
  ('Calorie Crusher',  'Hit your calorie goal 7 days in a row',  '🥗', '#10b981', 'nutrition', '{"calorie_goal_days": 7}'),
  ('Protein Pro',      'Hit your protein goal 7 days in a row',  '🥩', '#f59e0b', 'nutrition', '{"protein_goal_days": 7}')
on conflict (name) do nothing;

insert into public.exercises (name, muscle_group, equipment, is_custom) values
  ('Barbell Bench Press',     'chest',     'barbell',    false),
  ('Incline Dumbbell Press',  'chest',     'dumbbell',   false),
  ('Cable Fly',               'chest',     'cable',      false),
  ('Push Up',                 'chest',     'bodyweight', false),
  ('Dumbbell Bench Press',    'chest',     'dumbbell',   false),
  ('Pull Up',                 'back',      'bodyweight', false),
  ('Barbell Row',             'back',      'barbell',    false),
  ('Lat Pulldown',            'back',      'machine',    false),
  ('Seated Cable Row',        'back',      'cable',      false),
  ('Deadlift',                'back',      'barbell',    false),
  ('Romanian Deadlift',       'back',      'barbell',    false),
  ('Overhead Press',          'shoulders', 'barbell',    false),
  ('Dumbbell Lateral Raise',  'shoulders', 'dumbbell',   false),
  ('Dumbbell Shoulder Press', 'shoulders', 'dumbbell',   false),
  ('Face Pull',               'shoulders', 'cable',      false),
  ('Barbell Curl',            'arms',      'barbell',    false),
  ('Dumbbell Curl',           'arms',      'dumbbell',   false),
  ('Tricep Pushdown',         'arms',      'cable',      false),
  ('Skull Crusher',           'arms',      'barbell',    false),
  ('Hammer Curl',             'arms',      'dumbbell',   false),
  ('Barbell Squat',           'legs',      'barbell',    false),
  ('Leg Press',               'legs',      'machine',    false),
  ('Leg Curl',                'legs',      'machine',    false),
  ('Leg Extension',           'legs',      'machine',    false),
  ('Lunge',                   'legs',      'bodyweight', false),
  ('Hip Thrust',              'legs',      'barbell',    false),
  ('Calf Raise',              'legs',      'machine',    false),
  ('Plank',                   'core',      'bodyweight', false),
  ('Ab Wheel Rollout',        'core',      'other',      false),
  ('Cable Crunch',            'core',      'cable',      false),
  ('Running',                 'cardio',    'other',      false),
  ('Cycling',                 'cardio',    'machine',    false),
  ('Jump Rope',               'cardio',    'other',      false)
on conflict do nothing;

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================

alter table public.profiles                   enable row level security;
alter table public.friendships                enable row level security;
alter table public.exercises                  enable row level security;
alter table public.workouts                   enable row level security;
alter table public.workout_exercises          enable row level security;
alter table public.sets                       enable row level security;
alter table public.personal_records           enable row level security;
alter table public.workout_plans              enable row level security;
alter table public.workout_plan_days          enable row level security;
alter table public.workout_plan_day_exercises enable row level security;
alter table public.nutrition_logs             enable row level security;
alter table public.nutrition_entries          enable row level security;
alter table public.weight_logs                enable row level security;
alter table public.achievements               enable row level security;
alter table public.user_achievements          enable row level security;
alter table public.reactions                  enable row level security;
alter table public.invite_links               enable row level security;
alter table public.notifications              enable row level security;

-- ============================================================
-- 6. RLS POLICIES (all tables and helper functions exist now)
-- ============================================================

-- profiles
create policy "profiles: read own + viewable"
  on public.profiles for select
  using (public.can_view_profile(id));

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles: admin all"
  on public.profiles for all
  using (public.is_admin());

-- friendships
create policy "friendships: parties can view"
  on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin());

create policy "friendships: requester can insert"
  on public.friendships for insert
  with check (requester_id = auth.uid());

create policy "friendships: parties can update"
  on public.friendships for update
  using (addressee_id = auth.uid() or requester_id = auth.uid() or public.is_admin());

create policy "friendships: parties can delete"
  on public.friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin());

-- exercises
create policy "exercises: read global or own custom"
  on public.exercises for select
  using (not is_custom or created_by = auth.uid() or public.is_admin());

create policy "exercises: insert custom"
  on public.exercises for insert
  with check (is_custom = true and created_by = auth.uid());

create policy "exercises: update own custom"
  on public.exercises for update
  using (created_by = auth.uid() or public.is_admin());

create policy "exercises: delete own custom"
  on public.exercises for delete
  using (created_by = auth.uid() or public.is_admin());

-- workouts
create policy "workouts: owner full access"
  on public.workouts for all
  using (user_id = auth.uid() or public.is_admin());

create policy "workouts: viewable by friends"
  on public.workouts for select
  using (user_id = auth.uid() or public.is_admin() or public.can_view_profile(user_id));

-- workout_exercises
create policy "workout_exercises: owner access"
  on public.workout_exercises for all
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and (w.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "workout_exercises: viewable"
  on public.workout_exercises for select
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and public.can_view_profile(w.user_id)
    )
  );

-- sets
create policy "sets: owner access"
  on public.sets for all
  using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and (w.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "sets: viewable"
  on public.sets for select
  using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and public.can_view_profile(w.user_id)
    )
  );

-- personal_records
create policy "personal_records: owner full access"
  on public.personal_records for all
  using (user_id = auth.uid() or public.is_admin());

create policy "personal_records: viewable by friends"
  on public.personal_records for select
  using (public.can_view_profile(user_id));

-- workout_plans
create policy "workout_plans: owner full access"
  on public.workout_plans for all
  using (user_id = auth.uid() or public.is_admin());

create policy "workout_plans: viewable public or friend plans"
  on public.workout_plans for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (is_public and public.can_view_profile(user_id))
  );

-- workout_plan_days
create policy "workout_plan_days: owner access"
  on public.workout_plan_days for all
  using (
    exists (
      select 1 from public.workout_plans p
      where p.id = plan_id
        and (p.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "workout_plan_days: viewable"
  on public.workout_plan_days for select
  using (
    exists (
      select 1 from public.workout_plans p
      where p.id = plan_id
        and (p.user_id = auth.uid() or p.is_public or public.is_admin())
    )
  );

-- workout_plan_day_exercises
create policy "plan_day_exercises: owner access"
  on public.workout_plan_day_exercises for all
  using (
    exists (
      select 1
      from public.workout_plan_days d
      join public.workout_plans p on p.id = d.plan_id
      where d.id = plan_day_id
        and (p.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "plan_day_exercises: viewable"
  on public.workout_plan_day_exercises for select
  using (
    exists (
      select 1
      from public.workout_plan_days d
      join public.workout_plans p on p.id = d.plan_id
      where d.id = plan_day_id
        and (p.user_id = auth.uid() or p.is_public or public.is_admin())
    )
  );

-- nutrition_logs
create policy "nutrition_logs: owner full access"
  on public.nutrition_logs for all
  using (user_id = auth.uid() or public.is_admin());

-- nutrition_entries
create policy "nutrition_entries: owner access"
  on public.nutrition_entries for all
  using (
    exists (
      select 1 from public.nutrition_logs l
      where l.id = nutrition_log_id
        and (l.user_id = auth.uid() or public.is_admin())
    )
  );

-- weight_logs
create policy "weight_logs: owner full access"
  on public.weight_logs for all
  using (user_id = auth.uid() or public.is_admin());

create policy "weight_logs: viewable by friends"
  on public.weight_logs for select
  using (public.can_view_profile(user_id));

-- achievements
create policy "achievements: anyone can read"
  on public.achievements for select
  using (true);

create policy "achievements: admin can manage"
  on public.achievements for all
  using (public.is_admin());

-- user_achievements
create policy "user_achievements: viewable by friends"
  on public.user_achievements for select
  using (public.can_view_profile(user_id));

create policy "user_achievements: insert own"
  on public.user_achievements for insert
  with check (user_id = auth.uid() or public.is_admin());

-- reactions
create policy "reactions: viewable if workout visible"
  on public.reactions for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and public.can_view_profile(w.user_id)
    )
  );

create policy "reactions: insert own"
  on public.reactions for insert
  with check (user_id = auth.uid());

create policy "reactions: delete own"
  on public.reactions for delete
  using (user_id = auth.uid() or public.is_admin());

-- invite_links
create policy "invite_links: owner can manage"
  on public.invite_links for all
  using (user_id = auth.uid() or public.is_admin());

create policy "invite_links: any authed user can read by token"
  on public.invite_links for select
  using (auth.uid() is not null);

-- notifications
create policy "notifications: owner only"
  on public.notifications for all
  using (user_id = auth.uid() or public.is_admin());

-- ============================================================
-- STORAGE BUCKET (run this block separately if needed)
-- Supabase dashboard → Storage → New bucket is easier.
-- Bucket name: avatars, Public: true, Max size: 2MB
-- Then uncomment and run these policies:
-- ============================================================
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp','image/gif']);
--
-- create policy "avatars: user uploads own"
--   on storage.objects for insert
--   with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "avatars: public read"
--   on storage.objects for select
--   using (bucket_id = 'avatars');
--
-- create policy "avatars: user deletes own"
--   on storage.objects for delete
--   using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
