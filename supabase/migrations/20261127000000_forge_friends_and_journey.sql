-- ════════════════════════════════════════════════════════════════════════════
-- Forge · Friends and Shared Journey ("Our Journey")
--
-- Run once against the Supabase project (SQL editor, or `supabase db push`).
-- Safe to read top to bottom: tables first, then the only doors into them.
--
-- ── How access works ────────────────────────────────────────────────────────
--
-- Everything lives in the schema `forge`, which is NOT exposed through the
-- Data API. Its tables have row level security switched on and grant nothing
-- to `anon` or `authenticated`, so a browser — or anyone holding the public
-- anon key — cannot select, insert, update or delete a single row directly.
--
-- The only way in is the set of `public.forge_*` functions at the bottom. Each
-- one runs as its owner (SECURITY DEFINER), starts from `auth.uid()` — the
-- signed-in user proven by their Supabase session — and checks the
-- relationship it needs before touching anything: that two people are
-- friends, that both agreed to a Journey, that a goal belongs to the caller's
-- own Journey. A modified client cannot skip those checks because they are not
-- in the client. Only signed-in users may call them; `anon` may call none.
--
-- ── What is shared ──────────────────────────────────────────────────────────
--
-- Only what someone deliberately puts here: a username and optional display
-- name (visible to friends, people you have a request with, and anyone who
-- types your exact username or holds your invite code), and the goals,
-- contributions, Our Future plans and check-ins written INTO a Journey, which
-- only that Journey's members can read. Personal Forge data — habits, XP,
-- ranks, Daily Logs, ratings, challenges, notes, health — never comes here at
-- all: the app keeps it on the device and this schema has nowhere to put it.
--
-- ── Shape ───────────────────────────────────────────────────────────────────
--
-- accounts ── friendships (a request, then an accepted friendship)
--    └─ journey_members ── journeys ── goals ── contributions
--                                 ├── future_items
--                                 └── checkins
--
-- A Journey has members rather than "two people", so groups and more than one
-- Journey per person can come later without a migration of the data. For now
-- the functions allow one open Journey (invited-and-waiting or active) per
-- person, with exactly two members.
-- ════════════════════════════════════════════════════════════════════════════

create schema if not exists forge;
revoke all on schema forge from public;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table forge.accounts (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  -- Lowercase, starts with a letter, 3–20 characters. Unique, so it can be
  -- typed exactly to find someone; never searchable by prefix.
  username     text not null unique check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  display_name text check (display_name is null or char_length(display_name) between 1 and 40),
  -- Lets someone send you a friend request from a link. Rotating it revokes
  -- every link already shared.
  invite_code  text not null unique check (invite_code ~ '^[0-9A-F]{10}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table forge.friendships (
  id          uuid primary key default gen_random_uuid(),
  requester   uuid not null references forge.accounts (user_id) on delete cascade,
  addressee   uuid not null references forge.accounts (user_id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);
-- One row per pair, whichever direction it was asked in. A declined or
-- removed friendship is deleted, not remembered.
create unique index friendships_pair on forge.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee on forge.friendships (addressee);

create table forge.journeys (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Our Journey' check (char_length(title) between 1 and 60),
  kind       text not null default 'pair' check (kind in ('pair')),
  -- pending: invited, waiting for the other person to agree. Nothing can be
  -- written into it until it is active.
  status     text not null default 'pending' check (status in ('pending', 'active')),
  created_by uuid not null references forge.accounts (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  started_at timestamptz
);

create table forge.journey_members (
  journey_id uuid not null references forge.journeys (id) on delete cascade,
  user_id    uuid not null references forge.accounts (user_id) on delete cascade,
  -- invited: asked, has not agreed. joined: agreed (the inviter joins on asking).
  status     text not null check (status in ('invited', 'joined')),
  invited_by uuid references forge.accounts (user_id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at  timestamptz,
  primary key (journey_id, user_id)
);
-- One open Journey per person: the one they started or agreed to.
create unique index journey_members_one_open on forge.journey_members (user_id) where status = 'joined';
create index journey_members_user on forge.journey_members (user_id);

create table forge.goals (
  id           uuid primary key default gen_random_uuid(),
  journey_id   uuid not null references forge.journeys (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 80),
  details      text check (details is null or char_length(details) <= 500),
  -- count: a number to reach together ("4 workouts"). milestone: done once.
  kind         text not null check (kind in ('count', 'milestone')),
  target       integer check (target is null or target between 1 and 1000000),
  unit         text check (unit is null or char_length(unit) between 1 and 24),
  starts_on    date,
  ends_on      date,
  -- proposed by one member, active once the other agrees, completed at the end.
  status       text not null default 'proposed' check (status in ('proposed', 'active', 'completed')),
  created_by   uuid references forge.accounts (user_id) on delete set null,
  agreed_by    uuid references forge.accounts (user_id) on delete set null,
  agreed_at    timestamptz,
  completed_by uuid references forge.accounts (user_id) on delete set null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((kind = 'count') = (target is not null)),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index goals_journey on forge.goals (journey_id);

create table forge.contributions (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references forge.goals (id) on delete cascade,
  user_id    uuid references forge.accounts (user_id) on delete set null,
  amount     integer not null check (amount between 1 and 100000),
  note       text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index contributions_goal on forge.contributions (goal_id);

create table forge.future_items (
  id           uuid primary key default gen_random_uuid(),
  journey_id   uuid not null references forge.journeys (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 80),
  notes        text check (notes is null or char_length(notes) <= 1000),
  -- A free label the two of them choose ("Travel", "Home"), not a fixed list.
  area         text check (area is null or char_length(area) between 1 and 30),
  target_date  date,
  done         boolean not null default false,
  created_by   uuid references forge.accounts (user_id) on delete set null,
  completed_by uuid references forge.accounts (user_id) on delete set null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index future_items_journey on forge.future_items (journey_id);

create table forge.checkins (
  id         uuid primary key default gen_random_uuid(),
  journey_id uuid not null references forge.journeys (id) on delete cascade,
  user_id    uuid not null references forge.accounts (user_id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  went_well  text check (went_well is null or char_length(went_well) <= 1000),
  improving  text check (improving is null or char_length(improving) <= 1000),
  appreciate text check (appreciate is null or char_length(appreciate) <= 1000),
  support    text check (support is null or char_length(support) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journey_id, user_id, week_start)
);

-- Row level security on, and no policies: nobody but the owner reads a row.
alter table forge.accounts        enable row level security;
alter table forge.friendships     enable row level security;
alter table forge.journeys        enable row level security;
alter table forge.journey_members enable row level security;
alter table forge.goals           enable row level security;
alter table forge.contributions   enable row level security;
alter table forge.future_items    enable row level security;
alter table forge.checkins        enable row level security;

revoke all on all tables in schema forge from public;

-- A pair Journey cannot outlive one of its two people (an account deleted
-- from the dashboard, for instance): it ends with all of its content.
create function forge.end_incomplete_journey() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from forge.journeys j
   where j.id = old.journey_id
     and (select count(*) from forge.journey_members m where m.journey_id = j.id) < 2;
  return null;
end $$;

create trigger journey_members_after_delete
  after delete on forge.journey_members
  for each row execute function forge.end_incomplete_journey();

-- ── Private helpers ─────────────────────────────────────────────────────────

create function forge.fail(p_code text) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = p_code;
end $$;

-- The signed-in user, or an error.
create function forge.me() returns uuid
language plpgsql stable set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then perform forge.fail('not_signed_in'); end if;
  return uid;
end $$;

-- The signed-in user, who must have chosen a username.
create function forge.require_account() returns uuid
language plpgsql stable set search_path = '' as $$
declare uid uuid := forge.me();
begin
  if not exists (select 1 from forge.accounts a where a.user_id = uid) then
    perform forge.fail('no_username');
  end if;
  return uid;
end $$;

create function forge.new_invite_code() returns text
language sql volatile set search_path = '' as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
$$;

create function forge.norm_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Fa-f]', '', 'g'))
$$;

-- What another person may see of someone: their chosen name, nothing else.
create function forge.person(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('user_id', a.user_id, 'username', a.username, 'display_name', a.display_name)
    from forge.accounts a where a.user_id = p_user
$$;

create function forge.friendship_between(p_a uuid, p_b uuid) returns forge.friendships
language sql stable set search_path = '' as $$
  select f.* from forge.friendships f
   where least(f.requester, f.addressee) = least(p_a, p_b)
     and greatest(f.requester, f.addressee) = greatest(p_a, p_b)
$$;

create function forge.are_friends(p_a uuid, p_b uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((forge.friendship_between(p_a, p_b)).status = 'accepted', false)
$$;

-- self | friend | requested (you asked them) | incoming (they asked you) | none
create function forge.relation(p_me uuid, p_other uuid) returns text
language plpgsql stable set search_path = '' as $$
declare f forge.friendships;
begin
  if p_me = p_other then return 'self'; end if;
  f := forge.friendship_between(p_me, p_other);
  if f.id is null then return 'none'; end if;
  if f.status = 'accepted' then return 'friend'; end if;
  return case when f.requester = p_me then 'requested' else 'incoming' end;
end $$;

-- The caller's active Journey, or null.
create function forge.active_journey(p_user uuid) returns uuid
language sql stable set search_path = '' as $$
  select m.journey_id
    from forge.journey_members m
    join forge.journeys j on j.id = m.journey_id
   where m.user_id = p_user and m.status = 'joined' and j.status = 'active'
$$;

create function forge.require_journey(p_user uuid) returns uuid
language plpgsql stable set search_path = '' as $$
declare jid uuid := forge.active_journey(p_user);
begin
  if jid is null then perform forge.fail('no_active_journey'); end if;
  return jid;
end $$;

create function forge.clean(p_text text) returns text
language sql immutable set search_path = '' as $$
  select nullif(btrim(coalesce(p_text, '')), '')
$$;

create function forge.goal_progress(p_goal uuid) returns integer
language sql stable set search_path = '' as $$
  select coalesce(sum(c.amount), 0)::integer from forge.contributions c where c.goal_id = p_goal
$$;

create function forge.goal_view(p_goal uuid) returns jsonb
language sql stable set search_path = '' as $$
  select (to_jsonb(g) - 'journey_id') || jsonb_build_object(
           'progress', forge.goal_progress(g.id),
           'contributions', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', c.id, 'user_id', c.user_id, 'amount', c.amount,
                      'note', c.note, 'created_at', c.created_at) order by c.created_at desc)
               from (select * from forge.contributions c2
                      where c2.goal_id = g.id order by c2.created_at desc limit 50) c), '[]'::jsonb))
    from forge.goals g where g.id = p_goal
$$;

-- A goal the caller may act on: it must belong to the caller's active Journey.
-- Anything else — another Journey's goal, a made-up id — is "not found", so
-- the answer never reveals that someone else's goal exists.
create function forge.member_goal(p_user uuid, p_goal uuid) returns forge.goals
language plpgsql stable set search_path = '' as $$
declare g forge.goals;
begin
  select * into g from forge.goals
   where id = p_goal and journey_id = forge.active_journey(p_user);
  if not found then perform forge.fail('goal_not_found'); end if;
  return g;
end $$;

create function forge.member_future_item(p_user uuid, p_item uuid) returns forge.future_items
language plpgsql stable set search_path = '' as $$
declare fi forge.future_items;
begin
  select * into fi from forge.future_items
   where id = p_item and journey_id = forge.active_journey(p_user);
  if not found then perform forge.fail('item_not_found'); end if;
  return fi;
end $$;

create function forge.journey_view(p_journey uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', j.id, 'title', j.title, 'status', j.status, 'created_by', j.created_by,
    'created_at', j.created_at, 'started_at', j.started_at,
    -- Whoever started it first, then in the order people agreed.
    'members', (select jsonb_agg(forge.person(m.user_id) || jsonb_build_object('status', m.status, 'joined_at', m.joined_at)
                                 order by m.joined_at nulls last, m.user_id)
                  from forge.journey_members m where m.journey_id = j.id),
    -- Content exists only once both have agreed.
    'goals', case when j.status = 'active' then coalesce((
               select jsonb_agg(forge.goal_view(g.id) order by g.created_at)
                 from forge.goals g where g.journey_id = j.id), '[]'::jsonb) else '[]'::jsonb end,
    'future', case when j.status = 'active' then coalesce((
               select jsonb_agg(to_jsonb(fi) - 'journey_id' order by fi.done, fi.target_date nulls last, fi.created_at)
                 from forge.future_items fi where fi.journey_id = j.id), '[]'::jsonb) else '[]'::jsonb end,
    'checkins', case when j.status = 'active' then coalesce((
               select jsonb_agg(to_jsonb(c) - 'journey_id' order by c.week_start desc, c.user_id)
                 from forge.checkins c
                where c.journey_id = j.id and c.week_start >= current_date - 70), '[]'::jsonb) else '[]'::jsonb end)
  from forge.journeys j where j.id = p_journey
$$;

revoke all on all functions in schema forge from public;

-- ════════════════════════════════════════════════════════════════════════════
-- The API. Every function below is callable by signed-in users only.
-- ════════════════════════════════════════════════════════════════════════════

-- Everything the app shows, for the signed-in user, in one read.
create function public.forge_snapshot() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := forge.me();
  acct forge.accounts;
  jid uuid;
begin
  select * into acct from forge.accounts where user_id = uid;
  if not found then
    return jsonb_build_object('me', null, 'server_time', now());
  end if;
  select m.journey_id into jid from forge.journey_members m where m.user_id = uid and m.status = 'joined';

  return jsonb_build_object(
    'me', jsonb_build_object('user_id', acct.user_id, 'username', acct.username,
                             'display_name', acct.display_name, 'invite_code', acct.invite_code),
    'friends', coalesce((
      select jsonb_agg(forge.person(case when f.requester = uid then f.addressee else f.requester end)
                       || jsonb_build_object('since', f.accepted_at) order by f.accepted_at)
        from forge.friendships f where f.status = 'accepted' and uid in (f.requester, f.addressee)), '[]'::jsonb),
    'incoming_requests', coalesce((
      select jsonb_agg(forge.person(f.requester) || jsonb_build_object('id', f.id, 'created_at', f.created_at)
                       order by f.created_at)
        from forge.friendships f where f.status = 'pending' and f.addressee = uid), '[]'::jsonb),
    'outgoing_requests', coalesce((
      select jsonb_agg(forge.person(f.addressee) || jsonb_build_object('id', f.id, 'created_at', f.created_at)
                       order by f.created_at)
        from forge.friendships f where f.status = 'pending' and f.requester = uid), '[]'::jsonb),
    'journey_invites', coalesce((
      select jsonb_agg(jsonb_build_object('journey_id', j.id, 'title', j.title,
                                          'from', forge.person(j.created_by), 'created_at', m.invited_at)
                       order by m.invited_at)
        from forge.journey_members m join forge.journeys j on j.id = m.journey_id
       where m.user_id = uid and m.status = 'invited' and j.status = 'pending'), '[]'::jsonb),
    'journey', case when jid is null then null else forge.journey_view(jid) end,
    'server_time', now());
end $$;

-- ── Account ─────────────────────────────────────────────────────────────────

create function public.forge_claim_username(p_username text, p_display_name text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := forge.me();
  uname text := lower(btrim(coalesce(p_username, '')));
  dname text := forge.clean(p_display_name);
begin
  if uname !~ '^[a-z][a-z0-9_]{2,19}$' then perform forge.fail('username_invalid'); end if;
  if uname = any (array['admin', 'administrator', 'forge', 'support', 'help', 'root', 'system', 'moderator',
                        'staff', 'official', 'everyone', 'null', 'undefined', 'anonymous', 'friends', 'journey']) then
    perform forge.fail('username_reserved');
  end if;
  if dname is not null and char_length(dname) > 40 then perform forge.fail('display_name_too_long'); end if;
  if exists (select 1 from forge.accounts a where a.username = uname and a.user_id <> uid) then
    perform forge.fail('username_taken');
  end if;
  insert into forge.accounts (user_id, username, display_name, invite_code)
  values (uid, uname, dname, forge.new_invite_code())
  on conflict (user_id) do update
    set username = excluded.username, display_name = excluded.display_name, updated_at = now();
  return (select jsonb_build_object('user_id', a.user_id, 'username', a.username,
                                    'display_name', a.display_name, 'invite_code', a.invite_code)
            from forge.accounts a where a.user_id = uid);
exception when unique_violation then
  perform forge.fail('username_taken');
end $$;

-- A new code; every link carrying the old one stops working.
create function public.forge_rotate_invite_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); code text;
begin
  update forge.accounts set invite_code = forge.new_invite_code(), updated_at = now()
   where user_id = uid returning invite_code into code;
  return code;
end $$;

-- ── Friends ─────────────────────────────────────────────────────────────────

-- Exact username only: no partial matches, no lists, no ids for strangers.
create function public.forge_find_user(p_username text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); target uuid;
begin
  select a.user_id into target from forge.accounts a where a.username = lower(btrim(coalesce(p_username, '')));
  if target is null then return null; end if;
  return (forge.person(target) - 'user_id') || jsonb_build_object('relation', forge.relation(uid, target));
end $$;

-- Who an invite code belongs to, so the app can ask before sending a request.
create function public.forge_lookup_invite(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); target uuid;
begin
  select a.user_id into target from forge.accounts a where a.invite_code = forge.norm_code(p_code);
  if target is null then return null; end if;
  return (forge.person(target) - 'user_id') || jsonb_build_object('relation', forge.relation(uid, target));
end $$;

-- A request goes to a username or to the owner of an invite code. If they had
-- already asked you, asking back is agreeing.
create function public.forge_send_friend_request(p_username text default null, p_code text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := forge.require_account();
  target uuid;
  existing forge.friendships;
begin
  if p_code is not null then
    select a.user_id into target from forge.accounts a where a.invite_code = forge.norm_code(p_code);
  else
    select a.user_id into target from forge.accounts a where a.username = lower(btrim(coalesce(p_username, '')));
  end if;
  if target is null then perform forge.fail('user_not_found'); end if;
  if target = uid then perform forge.fail('cannot_friend_self'); end if;

  select f.* into existing from forge.friendships f
   where least(f.requester, f.addressee) = least(uid, target)
     and greatest(f.requester, f.addressee) = greatest(uid, target)
   for update;
  if found then
    if existing.status = 'accepted' then return jsonb_build_object('status', 'already_friends'); end if;
    if existing.requester = uid then return jsonb_build_object('status', 'already_requested'); end if;
    update forge.friendships set status = 'accepted', accepted_at = now() where id = existing.id;
    return jsonb_build_object('status', 'accepted');
  end if;

  if (select count(*) from forge.friendships f where f.requester = uid and f.status = 'pending') >= 20 then
    perform forge.fail('too_many_requests');
  end if;
  insert into forge.friendships (requester, addressee) values (uid, target);
  return jsonb_build_object('status', 'requested');
exception when unique_violation then
  return jsonb_build_object('status', 'already_requested');
end $$;

create function public.forge_respond_friend_request(p_request uuid, p_accept boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); r forge.friendships;
begin
  select * into r from forge.friendships
   where id = p_request and addressee = uid and status = 'pending' for update;
  if not found then perform forge.fail('request_not_found'); end if;
  if coalesce(p_accept, false) then
    update forge.friendships set status = 'accepted', accepted_at = now() where id = r.id;
    return jsonb_build_object('status', 'accepted');
  end if;
  delete from forge.friendships where id = r.id;
  return jsonb_build_object('status', 'declined');
end $$;

create function public.forge_cancel_friend_request(p_request uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account();
begin
  delete from forge.friendships where id = p_request and requester = uid and status = 'pending';
  if not found then perform forge.fail('request_not_found'); end if;
  return jsonb_build_object('status', 'cancelled');
end $$;

-- Ending a friendship also ends any Journey the two share, with its content.
create function public.forge_remove_friend(p_user uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account();
begin
  delete from forge.friendships f
   where f.status = 'accepted'
     and least(f.requester, f.addressee) = least(uid, p_user)
     and greatest(f.requester, f.addressee) = greatest(uid, p_user);
  if not found then perform forge.fail('not_friends'); end if;
  delete from forge.journeys j
   where exists (select 1 from forge.journey_members m where m.journey_id = j.id and m.user_id = uid)
     and exists (select 1 from forge.journey_members m where m.journey_id = j.id and m.user_id = p_user);
  return jsonb_build_object('status', 'removed');
end $$;

-- ── Journeys ────────────────────────────────────────────────────────────────

create function public.forge_respond_journey_invite(p_journey uuid, p_accept boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); j forge.journeys;
begin
  select * into j from forge.journeys where id = p_journey and status = 'pending' for update;
  if not found or not exists (select 1 from forge.journey_members m
                               where m.journey_id = p_journey and m.user_id = uid and m.status = 'invited') then
    perform forge.fail('invite_not_found');
  end if;
  if not coalesce(p_accept, false) then
    delete from forge.journeys where id = p_journey;
    return jsonb_build_object('status', 'declined');
  end if;
  if not forge.are_friends(uid, j.created_by) then
    delete from forge.journeys where id = p_journey;
    perform forge.fail('invite_not_found');
  end if;
  if forge.active_journey(uid) is not null then perform forge.fail('journey_exists'); end if;
  -- Saying yes to theirs withdraws an invitation you had sent yourself.
  delete from forge.journeys where status = 'pending' and created_by = uid;
  update forge.journey_members set status = 'joined', joined_at = now()
   where journey_id = p_journey and user_id = uid;
  update forge.journeys set status = 'active', started_at = now() where id = p_journey;
  return jsonb_build_object('status', 'active', 'journey_id', p_journey);
exception when unique_violation then
  perform forge.fail('journey_exists');
end $$;

-- Ask a friend to start a Journey. Nothing is shared until they agree; if they
-- had already asked you, asking back is agreeing.
create function public.forge_invite_to_journey(p_friend uuid, p_title text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := forge.require_account();
  title text := coalesce(forge.clean(p_title), 'Our Journey');
  theirs uuid;
  jid uuid;
begin
  if p_friend is null or not forge.are_friends(uid, p_friend) then perform forge.fail('not_friends'); end if;
  if char_length(title) > 60 then perform forge.fail('title_too_long'); end if;
  select j.id into theirs from forge.journeys j
    join forge.journey_members m on m.journey_id = j.id
   where j.status = 'pending' and j.created_by = p_friend and m.user_id = uid and m.status = 'invited';
  if theirs is not null then
    return public.forge_respond_journey_invite(theirs, true);
  end if;
  if exists (select 1 from forge.journey_members m where m.user_id = uid and m.status = 'joined') then
    perform forge.fail('journey_exists');
  end if;
  insert into forge.journeys (title, created_by) values (title, uid) returning id into jid;
  insert into forge.journey_members (journey_id, user_id, status, invited_by, joined_at)
  values (jid, uid, 'joined', uid, now()), (jid, p_friend, 'invited', uid, null);
  return jsonb_build_object('status', 'invited', 'journey_id', jid);
exception when unique_violation then
  perform forge.fail('journey_exists');
end $$;

create function public.forge_cancel_journey_invite(p_journey uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account();
begin
  delete from forge.journeys where id = p_journey and created_by = uid and status = 'pending';
  if not found then perform forge.fail('invite_not_found'); end if;
  return jsonb_build_object('status', 'cancelled');
end $$;

-- Leaving ends the Journey for both members and deletes everything written
-- into it: goals, contributions, Our Future plans and check-ins. Personal
-- Forge data is never here, so it is never touched.
create function public.forge_leave_journey(p_journey uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account();
begin
  if not exists (select 1 from forge.journey_members m
                  where m.journey_id = p_journey and m.user_id = uid and m.status = 'joined') then
    perform forge.fail('journey_not_found');
  end if;
  delete from forge.journeys where id = p_journey;
  return jsonb_build_object('status', 'ended');
end $$;

-- ── Shared goals ────────────────────────────────────────────────────────────

create function public.forge_create_goal(
  p_title text, p_kind text, p_target integer default null, p_unit text default null,
  p_starts_on date default null, p_ends_on date default null, p_details text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); jid uuid := forge.require_journey(uid); gid uuid;
begin
  if p_kind not in ('count', 'milestone') then perform forge.fail('goal_invalid'); end if;
  if forge.clean(p_title) is null then perform forge.fail('title_required'); end if;
  if p_kind = 'count' and (p_target is null or p_target < 1 or p_target > 1000000) then
    perform forge.fail('target_invalid');
  end if;
  if (select count(*) from forge.goals g where g.journey_id = jid) >= 200 then perform forge.fail('too_many_goals'); end if;
  insert into forge.goals (journey_id, title, details, kind, target, unit, starts_on, ends_on, created_by)
  values (jid, forge.clean(p_title), forge.clean(p_details), p_kind,
          case when p_kind = 'count' then p_target end,
          case when p_kind = 'count' then forge.clean(p_unit) end,
          p_starts_on, p_ends_on, uid)
  returning id into gid;
  return forge.goal_view(gid);
exception when check_violation then
  perform forge.fail('goal_invalid');
end $$;

-- The other member agrees, and the goal becomes active.
create function public.forge_agree_goal(p_goal uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); g forge.goals := forge.member_goal(uid, p_goal);
begin
  if g.status <> 'proposed' then perform forge.fail('goal_not_proposed'); end if;
  if g.created_by = uid then perform forge.fail('cannot_agree_own_goal'); end if;
  update forge.goals set status = 'active', agreed_by = uid, agreed_at = now(), updated_at = now() where id = g.id;
  return forge.goal_view(g.id);
end $$;

create function public.forge_update_goal(
  p_goal uuid, p_title text, p_target integer default null, p_unit text default null,
  p_starts_on date default null, p_ends_on date default null, p_details text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := forge.require_account();
  g forge.goals := forge.member_goal(uid, p_goal);
  progress integer;
begin
  -- A proposal is the proposer's to change until it is agreed.
  if g.status = 'proposed' and g.created_by is distinct from uid then perform forge.fail('only_proposer_can_edit'); end if;
  if forge.clean(p_title) is null then perform forge.fail('title_required'); end if;
  if g.kind = 'count' and (p_target is null or p_target < 1 or p_target > 1000000) then perform forge.fail('target_invalid'); end if;
  update forge.goals
     set title = forge.clean(p_title), details = forge.clean(p_details),
         target = case when g.kind = 'count' then p_target end,
         unit = case when g.kind = 'count' then forge.clean(p_unit) end,
         starts_on = p_starts_on, ends_on = p_ends_on, updated_at = now()
   where id = g.id;
  if g.kind = 'count' and g.status in ('active', 'completed') then
    progress := forge.goal_progress(g.id);
    update forge.goals
       set status = case when progress >= p_target then 'completed' else 'active' end,
           completed_at = case when progress >= p_target then coalesce(completed_at, now()) end,
           completed_by = case when progress >= p_target then coalesce(completed_by, uid) end
     where id = g.id;
  end if;
  return forge.goal_view(g.id);
exception when check_violation then
  perform forge.fail('goal_invalid');
end $$;

-- Withdraw or decline a proposal, or remove a goal with its contributions.
create function public.forge_remove_goal(p_goal uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); g forge.goals := forge.member_goal(uid, p_goal);
begin
  delete from forge.goals where id = g.id;
  return jsonb_build_object('status', 'removed');
end $$;

-- A one-time milestone is marked done (or not done) by either member.
create function public.forge_set_goal_done(p_goal uuid, p_done boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); g forge.goals := forge.member_goal(uid, p_goal);
begin
  if g.kind <> 'milestone' then perform forge.fail('goal_not_milestone'); end if;
  if g.status = 'proposed' then perform forge.fail('goal_not_agreed'); end if;
  update forge.goals
     set status = case when p_done then 'completed' else 'active' end,
         completed_at = case when p_done then now() end,
         completed_by = case when p_done then uid end,
         updated_at = now()
   where id = g.id;
  return forge.goal_view(g.id) || jsonb_build_object('just_completed', coalesce(p_done, false) and g.status <> 'completed');
end $$;

-- Your own contribution toward an agreed goal. Reaching the target completes it.
create function public.forge_add_contribution(p_goal uuid, p_amount integer, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := forge.require_account();
  g forge.goals := forge.member_goal(uid, p_goal);
  progress integer;
  finished boolean := false;
begin
  if g.kind <> 'count' then perform forge.fail('goal_not_count'); end if;
  if g.status = 'proposed' then perform forge.fail('goal_not_agreed'); end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then perform forge.fail('amount_invalid'); end if;
  if forge.clean(p_note) is not null and char_length(forge.clean(p_note)) > 200 then perform forge.fail('note_too_long'); end if;
  insert into forge.contributions (goal_id, user_id, amount, note) values (g.id, uid, p_amount, forge.clean(p_note));
  progress := forge.goal_progress(g.id);
  if g.status = 'active' and progress >= g.target then
    update forge.goals set status = 'completed', completed_at = now(), completed_by = uid, updated_at = now()
     where id = g.id;
    finished := true;
  end if;
  return forge.goal_view(g.id) || jsonb_build_object('just_completed', finished);
end $$;

-- Only your own contribution can be taken back.
create function public.forge_remove_contribution(p_contribution uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := forge.require_account();
  gid uuid;
  g forge.goals;
begin
  select c.goal_id into gid from forge.contributions c
    join forge.goals g2 on g2.id = c.goal_id
   where c.id = p_contribution and c.user_id = uid and g2.journey_id = forge.active_journey(uid);
  if gid is null then perform forge.fail('contribution_not_found'); end if;
  delete from forge.contributions where id = p_contribution;
  select * into g from forge.goals where id = gid;
  if g.status = 'completed' and forge.goal_progress(gid) < g.target then
    update forge.goals set status = 'active', completed_at = null, completed_by = null, updated_at = now() where id = gid;
  end if;
  return forge.goal_view(gid);
end $$;

-- ── Our Future ──────────────────────────────────────────────────────────────

create function public.forge_add_future_item(
  p_title text, p_notes text default null, p_area text default null, p_target_date date default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); jid uuid := forge.require_journey(uid); fid uuid;
begin
  if forge.clean(p_title) is null then perform forge.fail('title_required'); end if;
  if (select count(*) from forge.future_items fi where fi.journey_id = jid) >= 300 then perform forge.fail('too_many_items'); end if;
  insert into forge.future_items (journey_id, title, notes, area, target_date, created_by)
  values (jid, forge.clean(p_title), forge.clean(p_notes), forge.clean(p_area), p_target_date, uid)
  returning id into fid;
  return (select to_jsonb(fi) - 'journey_id' from forge.future_items fi where fi.id = fid);
exception when check_violation then
  perform forge.fail('item_invalid');
end $$;

create function public.forge_update_future_item(
  p_item uuid, p_title text, p_notes text default null, p_area text default null, p_target_date date default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); fi forge.future_items := forge.member_future_item(uid, p_item);
begin
  if forge.clean(p_title) is null then perform forge.fail('title_required'); end if;
  update forge.future_items
     set title = forge.clean(p_title), notes = forge.clean(p_notes), area = forge.clean(p_area),
         target_date = p_target_date, updated_at = now()
   where id = fi.id;
  return (select to_jsonb(x) - 'journey_id' from forge.future_items x where x.id = fi.id);
exception when check_violation then
  perform forge.fail('item_invalid');
end $$;

create function public.forge_set_future_item_done(p_item uuid, p_done boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); fi forge.future_items := forge.member_future_item(uid, p_item);
begin
  update forge.future_items
     set done = coalesce(p_done, false),
         completed_at = case when p_done then now() end,
         completed_by = case when p_done then uid end,
         updated_at = now()
   where id = fi.id;
  return (select to_jsonb(x) - 'journey_id' from forge.future_items x where x.id = fi.id);
end $$;

create function public.forge_remove_future_item(p_item uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); fi forge.future_items := forge.member_future_item(uid, p_item);
begin
  delete from forge.future_items where id = fi.id;
  return jsonb_build_object('status', 'removed');
end $$;

-- ── Weekly check-ins ────────────────────────────────────────────────────────

-- Your own answers for a week (a Monday close to today). Every answer is
-- optional; saving none at all removes the check-in.
create function public.forge_save_checkin(
  p_week_start date, p_went_well text default null, p_improving text default null,
  p_appreciate text default null, p_support text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := forge.require_account(); jid uuid := forge.require_journey(uid);
begin
  if p_week_start is null or extract(isodow from p_week_start) <> 1
     or p_week_start < current_date - 21 or p_week_start > current_date + 7 then
    perform forge.fail('week_invalid');
  end if;
  if forge.clean(p_went_well) is null and forge.clean(p_improving) is null
     and forge.clean(p_appreciate) is null and forge.clean(p_support) is null then
    delete from forge.checkins where journey_id = jid and user_id = uid and week_start = p_week_start;
    return null;
  end if;
  insert into forge.checkins (journey_id, user_id, week_start, went_well, improving, appreciate, support)
  values (jid, uid, p_week_start, forge.clean(p_went_well), forge.clean(p_improving),
          forge.clean(p_appreciate), forge.clean(p_support))
  on conflict (journey_id, user_id, week_start) do update
    set went_well = excluded.went_well, improving = excluded.improving,
        appreciate = excluded.appreciate, support = excluded.support, updated_at = now();
  return (select to_jsonb(c) - 'journey_id' from forge.checkins c
           where c.journey_id = jid and c.user_id = uid and c.week_start = p_week_start);
exception when check_violation then
  perform forge.fail('checkin_too_long');
end $$;

-- ── Who may call what ───────────────────────────────────────────────────────
-- Supabase grants new functions in `public` to anon by default. Undo that for
-- every forge_* function: signed-in users only.
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'forge\_%' loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Ask the Data API to pick up the new functions straight away.
notify pgrst, 'reload schema';
