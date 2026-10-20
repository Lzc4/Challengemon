-- einladungen: registrieren nur mit code, solange invite_only an ist

alter table public.profiles add column if not exists is_admin boolean not null default false;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values ('invite_only', 'true'), ('invites_per_user', '3') on conflict (key) do nothing;
alter table public.app_settings enable row level security;

create table if not exists public.invites (
  code text primary key,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  used_by uuid,
  used_at timestamptz
);
create index if not exists invites_creator on public.invites (created_by);
alter table public.invites enable row level security;

create or replace function public.setting(name text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select value from public.app_settings where key = name
$$;

-- laeuft nach dem anlegen des users, ein fehler hier bricht die registrierung ab
create or replace function public.use_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite', '')));
begin
  if coalesce((public.setting('invite_only'))::boolean, false) is false then
    if c <> '' then
      update public.invites set used_by = new.id, used_at = now() where code = c and used_by is null;
    end if;
    return new;
  end if;
  update public.invites set used_by = new.id, used_at = now() where code = c and used_by is null;
  if not found then raise exception 'invite_invalid'; end if;
  return new;
end $$;

drop trigger if exists on_auth_user_invite on auth.users;
create trigger on_auth_user_invite after insert on auth.users
for each row execute function public.use_invite();

create or replace function public.signup_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('invite_only', coalesce((public.setting('invite_only'))::boolean, false))
$$;

create or replace function public.invite_status(code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('valid', i.used_by is null, 'used', i.used_by is not null, 'inviter', p.name)
       from public.invites i left join public.profiles p on p.id = i.created_by
      where i.code = upper(btrim(invite_status.code))),
    jsonb_build_object('valid', false, 'used', false, 'inviter', null))
$$;

create or replace function public.create_invite()
returns text language plpgsql security definer set search_path = '' as $$
declare
  admin boolean;
  quota int := coalesce((public.setting('invites_per_user'))::int, 0);
  c text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select is_admin into admin from public.profiles where id = auth.uid();
  if not coalesce(admin, false) and (select count(*) from public.invites where created_by = auth.uid()) >= quota then
    raise exception 'invite_quota';
  end if;
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    exit when not exists (select 1 from public.invites where code = c);
  end loop;
  insert into public.invites (code, created_by) values (c, auth.uid());
  return c;
end $$;

create or replace function public.invite_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'quota', coalesce((public.setting('invites_per_user'))::int, 0),
    'admin', coalesce((select is_admin from public.profiles where id = auth.uid()), false),
    'created', (select count(*) from public.invites where created_by = auth.uid()))
$$;

drop function if exists public.my_invites();
create or replace function public.my_invites()
returns table (code text, created_at timestamptz, used_at timestamptz, used_name text)
language sql stable security definer set search_path = '' as $$
  select i.code, i.created_at, i.used_at, p.name
    from public.invites i left join public.profiles p on p.id = i.used_by
   where i.created_by = auth.uid()
   order by i.created_at desc
$$;

create or replace function public.delete_invite(code text)
returns void language sql security definer set search_path = '' as $$
  delete from public.invites i where i.code = delete_invite.code and i.created_by = auth.uid() and i.used_by is null
$$;

revoke execute on function public.setting(text) from public, anon, authenticated;
revoke execute on function public.use_invite() from public, anon, authenticated;
revoke execute on function public.create_invite(), public.my_invites(), public.invite_info(), public.delete_invite(text) from public, anon;
grant execute on function public.signup_info(), public.invite_status(text) to anon, authenticated;
grant execute on function public.create_invite(), public.my_invites(), public.invite_info(), public.delete_invite(text) to authenticated;
