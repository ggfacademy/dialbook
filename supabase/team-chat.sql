-- Dialbook Pro – team chat between telecallers, managers and admins (website and phone app).
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- Two kinds of conversation:
--   * "team"           – everyone in the team sees it (announcements, quick questions)
--   * "dm:<id>:<id>"   – a private chat between two people (the two ids in alphabetical order)
-- A message can point to a lead ("please call this lead"), shown as a button that opens it.
-- Messages are kept like the rest of the CRM data, and only active team members can read or write.

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel = 'team' or channel ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$'),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (length(body) <= 4000),
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists team_messages_channel on public.team_messages(channel, created_at desc);

-- When each person last read each conversation (for the unread counts)
create table if not exists public.team_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, channel)
);

-- Can the signed-in person see this conversation?
create or replace function public.team_can(p_channel text) returns boolean
language sql stable as $$
  select public.is_active() and (p_channel = 'team'
    or (p_channel like 'dm:%' and auth.uid()::text in (split_part(p_channel, ':', 2), split_part(p_channel, ':', 3))))
$$;

alter table public.team_messages enable row level security;
alter table public.team_reads enable row level security;
drop policy if exists tm_sel on public.team_messages;
drop policy if exists tm_ins on public.team_messages;
drop policy if exists tm_del on public.team_messages;
create policy tm_sel on public.team_messages for select to authenticated using (public.team_can(channel));
create policy tm_ins on public.team_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.team_can(channel));
-- people can delete their own message; admins can delete any
create policy tm_del on public.team_messages for delete to authenticated using (sender_id = auth.uid() or public.is_admin());
drop policy if exists tr_all on public.team_reads;
create policy tr_all on public.team_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.team_messages to authenticated;
grant select, insert, update, delete on public.team_reads to authenticated;

-- Mark a conversation as read
create or replace function public.team_mark_read(p_channel text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.team_can(p_channel) then return; end if;
  insert into public.team_reads(user_id, channel, read_at) values (auth.uid(), p_channel, now())
  on conflict (user_id, channel) do update set read_at = now();
end $$;

-- My conversations: the team one and every private chat that has messages, newest first, with unread counts
create or replace function public.team_inbox() returns table(channel text, last_at timestamptz, last_body text, last_sender uuid, unread int)
language sql stable security definer set search_path = public as $$
  with mine as (
    select distinct m.channel from public.team_messages m where public.team_can(m.channel)
    union select 'team'
  )
  select c.channel,
         (select max(m.created_at) from public.team_messages m where m.channel = c.channel),
         (select m.body from public.team_messages m where m.channel = c.channel order by m.created_at desc limit 1),
         (select m.sender_id from public.team_messages m where m.channel = c.channel order by m.created_at desc limit 1),
         (select count(*)::int from public.team_messages m
           where m.channel = c.channel and m.sender_id <> auth.uid()
             and m.created_at > coalesce((select r.read_at from public.team_reads r where r.user_id = auth.uid() and r.channel = c.channel),
                                         (select p.created_at from public.profiles p where p.id = auth.uid())))
    from mine c
   where public.is_active()
   order by 2 desc nulls last
$$;

-- Total unread (for the menu badge and the phone app)
create or replace function public.team_unread() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(unread), 0)::int from public.team_inbox()
$$;

revoke execute on function public.team_mark_read(text), public.team_inbox(), public.team_unread() from anon, public;
grant execute on function public.team_mark_read(text), public.team_inbox(), public.team_unread(), public.team_can(text) to authenticated;

-- Live updates
do $$ begin
  begin alter publication supabase_realtime add table public.team_messages; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
