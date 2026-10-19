create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null unique check (char_length(name) between 2 and 24),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  raw text := btrim(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)));
  base text := case when char_length(raw) < 2 then 'Spieler' else left(raw, 20) end;
  candidate text := base;
  n int := 1;
begin
  while exists (select 1 from public.profiles where name = candidate) loop
    n := n + 1;
    candidate := base || n;
  end loop;
  insert into public.profiles (id, name) values (new.id, candidate);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  system text not null check (system in ('nds', 'gba', 'gb', 'gbc')),
  game_code text,
  title text not null,
  crc32 bigint not null,
  size bigint not null,
  provider text not null,
  path text not null,
  created_at timestamptz not null default now(),
  unique (user_id, crc32, provider)
);
create index library_user on public.library (user_id);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  system text not null check (system in ('nds', 'gba', 'gb', 'gbc')),
  game_code text not null,
  mode text not null default 'nuzlocke' check (mode in ('nuzlocke', 'soullocke', 'casual')),
  honor_mode boolean not null default true,
  rare_candies boolean not null default true,
  randomize text not null default 'none' check (randomize in ('none', 'shared', 'individual')),
  settings text,
  settings_name text,
  seed bigint,
  randomizer_version text,
  invite_code text not null unique default substr(md5(gen_random_uuid()::text), 1, 12),
  max_players int not null default 2 check (max_players between 1 and 8),
  created_by uuid references public.profiles on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  result text check (result in ('won', 'lost')),
  ended_by uuid references public.profiles on delete set null,
  archived_at timestamptz
);
create index runs_created_by on public.runs (created_by);
create index runs_ended_by on public.runs (ended_by);

create table public.run_players (
  run_id uuid not null references public.runs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  seed bigint,
  status text not null default 'waiting' check (status in ('waiting', 'randomizing', 'ready', 'failed')),
  error text,
  base_crc32 bigint,
  rom_crc32 bigint,
  patch_provider text,
  patch_path text,
  job text,
  joined_at timestamptz not null default now(),
  primary key (run_id, user_id)
);
create index run_players_user on public.run_players (user_id);

create table public.saves (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  kind text not null check (kind in ('sram', 'state')),
  provider text not null,
  path text not null,
  size integer,
  created_at timestamptz not null default now()
);
create index saves_lookup on public.saves (run_id, user_id, kind, created_at desc);
create index saves_user on public.saves (user_id);

create table public.save_summaries (
  run_id uuid not null references public.runs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  summary jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (run_id, user_id)
);
create index save_summaries_user on public.save_summaries (user_id);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  location text not null,
  species text,
  nickname text,
  status text not null default 'caught' check (status in ('caught', 'dead', 'missed')),
  in_party boolean not null default false,
  pid bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, user_id, location)
);
create index encounters_run on public.encounters (run_id);
create index encounters_user on public.encounters (user_id);

create table public.live_status (
  run_id uuid not null references public.runs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  party jsonb not null default '[]'::jsonb,
  map_id integer,
  pos_x integer,
  pos_y integer,
  updated_at timestamptz not null default now(),
  primary key (run_id, user_id)
);
create index live_status_user on public.live_status (user_id);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index chat_messages_run on public.chat_messages (run_id, created_at desc);
create index chat_messages_user on public.chat_messages (user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger encounters_touch before update on public.encounters
for each row execute function public.touch_updated_at();

-- soul link: stirbt einer, stirbt der partner am gleichen ort mit
create or replace function public.soul_link_death()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'dead' and old.status is distinct from 'dead' and exists (
    select 1 from public.runs r where r.id = new.run_id and r.mode = 'soullocke'
  ) then
    update public.encounters
      set status = 'dead', in_party = false
      where run_id = new.run_id and location = new.location
        and user_id <> new.user_id and status = 'caught';
  end if;
  return new;
end $$;

create trigger encounters_soul_link after update of status on public.encounters
for each row execute function public.soul_link_death();

-- run_id/user_id duerfen sich nie aendern, sonst kann man sich in fremde runs schieben
create or replace function public.keep_row_keys()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.run_id is distinct from old.run_id or new.user_id is distinct from old.user_id then
    raise exception 'run_id and user_id cannot be changed';
  end if;
  return new;
end $$;

create trigger run_players_keys before update on public.run_players for each row execute function public.keep_row_keys();
create trigger encounters_keys before update on public.encounters for each row execute function public.keep_row_keys();
create trigger saves_keys before update on public.saves for each row execute function public.keep_row_keys();
create trigger save_summaries_keys before update on public.save_summaries for each row execute function public.keep_row_keys();
create trigger live_status_keys before update on public.live_status for each row execute function public.keep_row_keys();

create or replace function public.guard_player_row()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and (new.seed is distinct from old.seed or new.joined_at is distinct from old.joined_at) then
    raise exception 'seed cannot be changed';
  end if;
  return new;
end $$;

create trigger run_players_guard before update on public.run_players for each row execute function public.guard_player_row();

create or replace function public.is_member(run uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.run_players where run_id = run and user_id = (select auth.uid()));
$$;

create or replace function public.shares_run(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.run_players a join public.run_players b on a.run_id = b.run_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

create or replace function public.create_run(payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rid uuid;
  mode_r text := coalesce(payload ->> 'randomize', 'none');
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.runs (name, system, game_code, mode, honor_mode, rare_candies, randomize, settings, settings_name, seed, randomizer_version, max_players, created_by)
  values (
    payload ->> 'name', payload ->> 'system', payload ->> 'game_code',
    coalesce(payload ->> 'mode', 'nuzlocke'),
    coalesce((payload ->> 'honor_mode')::boolean, true),
    coalesce((payload ->> 'rare_candies')::boolean, true),
    mode_r, payload ->> 'settings', payload ->> 'settings_name',
    case when mode_r = 'shared' then (floor(random() * 9007199254740991))::bigint end,
    payload ->> 'randomizer_version',
    coalesce((payload ->> 'max_players')::int, 2),
    uid
  ) returning id into rid;
  insert into public.run_players (run_id, user_id, seed, status)
  values (rid, uid, case when mode_r = 'individual' then (floor(random() * 9007199254740991))::bigint end, case when mode_r = 'none' then 'ready' else 'waiting' end);
  return rid;
end $$;

create or replace function public.run_preview(code text)
returns table (id uuid, name text, game_code text, mode text, randomize text, players int, max_players int, host text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name, r.game_code, r.mode, r.randomize,
    (select count(*)::int from public.run_players p where p.run_id = r.id), r.max_players,
    (select name from public.profiles where id = r.created_by)
  from public.runs r where r.invite_code = code and r.archived_at is null and r.ended_at is null;
$$;

-- for update, damit zwei gleichzeitige joins nicht ueber max_players kommen
create or replace function public.join_run(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.runs;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into r from public.runs where invite_code = code and archived_at is null and ended_at is null for update;
  if r.id is null then raise exception 'invite not found'; end if;
  if exists (select 1 from public.run_players where run_id = r.id and user_id = uid) then return r.id; end if;
  if (select count(*) from public.run_players where run_id = r.id) >= r.max_players then raise exception 'run is full'; end if;
  insert into public.run_players (run_id, user_id, seed, status)
  values (r.id, uid, case when r.randomize = 'individual' then (floor(random() * 9007199254740991))::bigint end, case when r.randomize = 'none' then 'ready' else 'waiting' end);
  return r.id;
end $$;

create or replace function public.leave_run(run uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.run_players where run_id = run and user_id = auth.uid();
  delete from public.runs r where r.id = run and not exists (select 1 from public.run_players p where p.run_id = r.id);
end $$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.runs r where r.created_by = auth.uid()
    and not exists (select 1 from public.run_players p where p.run_id = r.id and p.user_id <> auth.uid());
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.keep_row_keys() from public, anon, authenticated;
revoke execute on function public.guard_player_row() from public, anon, authenticated;
revoke execute on function public.soul_link_death() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.shares_run(uuid) from public, anon;
revoke execute on function public.create_run(jsonb) from public, anon;
revoke execute on function public.join_run(text) from public, anon;
revoke execute on function public.leave_run(uuid) from public, anon;
grant execute on function public.run_preview(text) to anon, authenticated;
grant execute on function public.is_member(uuid), public.shares_run(uuid), public.create_run(jsonb), public.join_run(text), public.leave_run(uuid), public.delete_my_account() to authenticated;

alter table public.profiles enable row level security;
alter table public.library enable row level security;
alter table public.runs enable row level security;
alter table public.run_players enable row level security;
alter table public.saves enable row level security;
alter table public.save_summaries enable row level security;
alter table public.encounters enable row level security;
alter table public.live_status enable row level security;
alter table public.chat_messages enable row level security;

create policy "profiles read" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.shares_run(id));
create policy "profiles update own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "library own" on public.library for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "runs read" on public.runs for select to authenticated using (public.is_member(id));
create policy "runs update" on public.runs for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
-- mitspieler duerfen nur das ende eintragen, alles andere laeuft ueber die funktionen
revoke insert, update on public.runs from anon, authenticated;
grant update (ended_at, end_reason, result, ended_by) on public.runs to authenticated;
revoke insert, delete on public.run_players from anon, authenticated;
create policy "runs delete" on public.runs for delete to authenticated using (created_by = (select auth.uid()));

create policy "players read" on public.run_players for select to authenticated using (public.is_member(run_id));
create policy "players update own" on public.run_players for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(run_id));

create policy "saves own" on public.saves for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(run_id));
create policy "saves read members" on public.saves for select to authenticated using (public.is_member(run_id));

create policy "summaries read" on public.save_summaries for select to authenticated using (public.is_member(run_id));
create policy "summaries write own" on public.save_summaries for insert to authenticated with check (user_id = (select auth.uid()) and public.is_member(run_id));
create policy "summaries update own" on public.save_summaries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(run_id));

create policy "encounters read" on public.encounters for select to authenticated using (public.is_member(run_id));
create policy "encounters insert own" on public.encounters for insert to authenticated with check (user_id = (select auth.uid()) and public.is_member(run_id));
create policy "encounters update own" on public.encounters for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(run_id));
create policy "encounters delete own" on public.encounters for delete to authenticated using (user_id = (select auth.uid()));

create policy "live read" on public.live_status for select to authenticated using (public.is_member(run_id));
create policy "live insert own" on public.live_status for insert to authenticated with check (user_id = (select auth.uid()) and public.is_member(run_id));
create policy "live update own" on public.live_status for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(run_id));

create policy "chat read" on public.chat_messages for select to authenticated using (public.is_member(run_id));
create policy "chat write" on public.chat_messages for insert to authenticated with check (user_id = (select auth.uid()) and public.is_member(run_id));

alter publication supabase_realtime add table public.runs, public.run_players, public.encounters, public.saves, public.save_summaries, public.live_status, public.chat_messages;
