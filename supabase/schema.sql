-- =====================================================================
-- Dialbook Pro – database setup for Supabase
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a new project.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Team members (one row per login)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  phone text default '',
  role text not null default 'telecaller' check (role in ('admin','manager','telecaller')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- The first person to sign up becomes an active admin. Everyone after that
-- waits for an admin to approve them in the Team page.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists(select 1 from public.profiles) into first_user;
  insert into public.profiles(id, name, email, role, active)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
          new.email,
          case when first_user then 'admin' else 'telecaller' end,
          first_user)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create or replace function public.is_active() returns boolean
language sql stable as $$ select public.my_role() is not null $$;
create or replace function public.is_mgr() returns boolean
language sql stable as $$ select coalesce(public.my_role() in ('admin','manager'), false) $$;
create or replace function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.my_role() = 'admin', false) $$;

-- Non-admins cannot change their own role or approval.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.active := old.active;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------------------------------------------------------------------
-- Settings (single row, JSON)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings(id, data) values (1, $json${
  "company": "Dialbook",
  "stages": [
    {"id":"new","name":"New"},{"id":"contacted","name":"Contacted"},{"id":"interested","name":"Interested"},
    {"id":"followup","name":"Follow-up"},{"id":"negotiation","name":"Negotiation"},
    {"id":"won","name":"Converted"},{"id":"lost","name":"Lost"}],
  "dispositions": [
    {"id":"interested","name":"Interested","connected":true,"stage":"interested","fu":true},
    {"id":"callback","name":"Call back later","connected":true,"stage":"followup","fu":true},
    {"id":"info_shared","name":"Details shared","connected":true,"stage":"contacted","fu":true},
    {"id":"converted","name":"Converted / Sale","connected":true,"stage":"won","fu":false},
    {"id":"not_interested","name":"Not interested","connected":true,"stage":"lost","fu":false},
    {"id":"no_answer","name":"Did not pick","connected":false,"stage":"","fu":true},
    {"id":"busy","name":"Busy / Cut the call","connected":false,"stage":"","fu":true},
    {"id":"unreachable","name":"Switched off / Not reachable","connected":false,"stage":"","fu":true},
    {"id":"wrong_number","name":"Wrong number","connected":false,"stage":"lost","fu":false}],
  "sources": ["Facebook Ads","Google Ads","Website","IndiaMART","JustDial","Referral","Walk-in","Incoming call","Excel import"],
  "templates": [
    {"id":"t1","name":"Intro after call","channel":"whatsapp","body":"Hi {name}, this is {agent} from {company}. Thanks for your time on the call. Sharing the details we discussed."},
    {"id":"t2","name":"Could not reach you","channel":"whatsapp","body":"Hi {name}, {agent} from {company} here. I tried calling you today but could not connect. When is a good time to talk?"}],
  "autoCreateIncoming": true,
  "ai": {"agentId":"","fromNumber":"","startHour":10,"endHour":19,"maxBatch":50}
}$json$::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  script text not null default '',
  ai_agent_id text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  phone text not null,
  phone_key text generated always as (right(regexp_replace(phone, '\D', '', 'g'), 10)) stored,
  alt_phone text not null default '',
  email text not null default '',
  city text not null default '',
  company text not null default '',
  source text not null default '',
  campaign_id uuid references public.campaigns(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  stage text not null default 'new',
  priority text not null default '',
  priority_rank int generated always as (case priority when 'hot' then 0 when 'warm' then 1 when 'cold' then 2 else 3 end) stored,
  value numeric not null default 0,
  tags text[] not null default '{}',
  note text not null default '',
  dnd boolean not null default false,
  call_count int not null default 0,
  last_call_at timestamptz,
  last_outcome text not null default '',
  next_follow_up_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_phone_key on public.leads(phone_key);
create index if not exists leads_assigned on public.leads(assigned_to, stage);
create index if not exists leads_campaign on public.leads(campaign_id);
create index if not exists leads_followup on public.leads(next_follow_up_at) where next_follow_up_at is not null;
create index if not exists leads_updated on public.leads(updated_at desc);
create index if not exists leads_created on public.leads(created_at);
create index if not exists leads_name_trgm on public.leads using gin (name gin_trgm_ops);

-- Telecallers cannot reassign leads; everyone bumps updated_at.
create or replace function public.leads_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_mgr() then
    new.assigned_to := old.assigned_to;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists leads_before_update on public.leads;
create trigger leads_before_update before update on public.leads
  for each row execute function public.leads_before_update();

-- ---------------------------------------------------------------------
-- Calls (manual, auto-logged from the phone app, or made by the AI agent)
-- ---------------------------------------------------------------------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  agent_id uuid references public.profiles(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','phone','ai')),
  direction text not null default 'outgoing',
  started_at timestamptz not null default now(),
  duration int not null default 0,
  connected boolean not null default false,
  outcome text,
  note text not null default '',
  follow_up_at timestamptz,
  recording_path text,
  recording_url text,
  transcript text,
  external_id text unique,
  ai_call_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists calls_lead on public.calls(lead_id, started_at desc);
create index if not exists calls_agent on public.calls(agent_id, started_at desc);
create index if not exists calls_started on public.calls(started_at desc);
create index if not exists calls_pending on public.calls(agent_id) where outcome is null;

-- ---------------------------------------------------------------------
-- Activity timeline (notes, stage changes, assignments, messages)
-- ---------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  text text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activities_lead on public.activities(lead_id, created_at desc);

-- ---------------------------------------------------------------------
-- AI calls (one row per call placed by the AI voice agent)
-- ---------------------------------------------------------------------
create table if not exists public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  execution_id text unique,
  status text not null default 'queued',
  requested_by uuid references public.profiles(id) on delete set null,
  call_id uuid references public.calls(id) on delete set null,
  outcome text,
  summary text,
  error text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_calls_created on public.ai_calls(created_at desc);

-- ---------------------------------------------------------------------
-- Call → lead automation
-- ---------------------------------------------------------------------
create or replace function public.dispo(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select x from public.settings s, jsonb_array_elements(s.data->'dispositions') x
  where s.id = 1 and x->>'id' = p_id limit 1
$$;

create or replace function public.calls_before() returns trigger
language plpgsql as $$
declare d jsonb;
begin
  if new.outcome is not null and new.source <> 'phone' then
    d := public.dispo(new.outcome);
    if d is not null and new.source = 'manual' then
      new.connected := coalesce((d->>'connected')::boolean, false);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists calls_before on public.calls;
create trigger calls_before before insert or update on public.calls
  for each row execute function public.calls_before();

create or replace function public.calls_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  l public.leads%rowtype;
  d jsonb;
  st text;
  apply_outcome boolean := false;
begin
  select * into l from public.leads where id = new.lead_id;
  if not found then return new; end if;

  if tg_op = 'INSERT' then
    update public.leads
       set call_count = call_count + 1,
           last_call_at = greatest(coalesce(last_call_at, new.started_at), new.started_at)
     where id = l.id;
    apply_outcome := new.outcome is not null;
  else
    if new.outcome is not null then
      if old.outcome is distinct from new.outcome or old.follow_up_at is distinct from new.follow_up_at then
        apply_outcome := true;
      end if;
    end if;
  end if;

  if apply_outcome then
    d := public.dispo(new.outcome);
    st := nullif(d->>'stage', '');
    if st is null and l.stage = 'new' then st := 'contacted'; end if;
    update public.leads
       set last_outcome = new.outcome,
           next_follow_up_at = new.follow_up_at,
           stage = coalesce(st, stage)
     where id = l.id;
    if st is not null and st <> l.stage then
      insert into public.activities(lead_id, actor_id, kind, data)
      values (l.id, new.agent_id, 'stage', jsonb_build_object('from', l.stage, 'to', st));
    end if;
  elsif tg_op = 'INSERT' and new.connected and l.stage = 'new' then
    update public.leads set stage = 'contacted' where id = l.id;
  end if;
  return new;
end $$;
drop trigger if exists calls_after on public.calls;
create trigger calls_after after insert or update on public.calls
  for each row execute function public.calls_after();

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.settings   enable row level security;
alter table public.campaigns  enable row level security;
alter table public.leads      enable row level security;
alter table public.calls      enable row level security;
alter table public.activities enable row level security;
alter table public.ai_calls   enable row level security;

drop policy if exists p_profiles_sel on public.profiles;
create policy p_profiles_sel on public.profiles for select to authenticated using (public.is_active() or id = auth.uid());
drop policy if exists p_profiles_upd on public.profiles;
create policy p_profiles_upd on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists p_profiles_del on public.profiles;
create policy p_profiles_del on public.profiles for delete to authenticated using (public.is_admin() and id <> auth.uid());

drop policy if exists p_settings_sel on public.settings;
create policy p_settings_sel on public.settings for select to authenticated using (public.is_active());
drop policy if exists p_settings_upd on public.settings;
create policy p_settings_upd on public.settings for update to authenticated using (public.is_admin());

drop policy if exists p_campaigns_sel on public.campaigns;
create policy p_campaigns_sel on public.campaigns for select to authenticated using (public.is_active());
drop policy if exists p_campaigns_all on public.campaigns;
create policy p_campaigns_all on public.campaigns for all to authenticated using (public.is_mgr()) with check (public.is_mgr());

drop policy if exists p_leads_sel on public.leads;
create policy p_leads_sel on public.leads for select to authenticated using (public.is_mgr() or (public.is_active() and assigned_to = auth.uid()));
drop policy if exists p_leads_ins on public.leads;
create policy p_leads_ins on public.leads for insert to authenticated with check (public.is_mgr() or (public.is_active() and assigned_to = auth.uid()));
drop policy if exists p_leads_upd on public.leads;
create policy p_leads_upd on public.leads for update to authenticated using (public.is_mgr() or (public.is_active() and assigned_to = auth.uid()));
drop policy if exists p_leads_del on public.leads;
create policy p_leads_del on public.leads for delete to authenticated using (public.is_mgr());

drop policy if exists p_calls_sel on public.calls;
create policy p_calls_sel on public.calls for select to authenticated using (
  public.is_mgr() or (public.is_active() and (agent_id = auth.uid() or exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()))));
drop policy if exists p_calls_ins on public.calls;
create policy p_calls_ins on public.calls for insert to authenticated with check (public.is_active() and (agent_id = auth.uid() or public.is_mgr()));
drop policy if exists p_calls_upd on public.calls;
create policy p_calls_upd on public.calls for update to authenticated using (public.is_mgr() or (public.is_active() and agent_id = auth.uid()));
drop policy if exists p_calls_del on public.calls;
create policy p_calls_del on public.calls for delete to authenticated using (public.is_mgr());

drop policy if exists p_act_sel on public.activities;
create policy p_act_sel on public.activities for select to authenticated using (
  public.is_mgr() or (public.is_active() and exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid())));
drop policy if exists p_act_ins on public.activities;
create policy p_act_ins on public.activities for insert to authenticated with check (public.is_active() and actor_id = auth.uid());

drop policy if exists p_ai_sel on public.ai_calls;
create policy p_ai_sel on public.ai_calls for select to authenticated using (
  public.is_mgr() or (public.is_active() and exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid())));

-- ---------------------------------------------------------------------
-- Call recordings storage (private bucket)
-- Files are stored as <user id>/<call id>.<ext>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false)
on conflict (id) do nothing;

drop policy if exists rec_insert on storage.objects;
create policy rec_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and public.is_active() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists rec_update on storage.objects;
create policy rec_update on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists rec_select on storage.objects;
create policy rec_select on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and (public.is_mgr() or (storage.foldername(name))[1] = auth.uid()::text
         or exists (select 1 from public.calls c join public.leads l on l.id = c.lead_id
                    where c.recording_path = storage.objects.name and l.assigned_to = auth.uid())));

-- ---------------------------------------------------------------------
-- Functions used by the phone app
-- ---------------------------------------------------------------------

-- Log a call found in the phone's call history. Returns null when the number
-- is not a lead (and auto-create is off), so personal calls are never stored.
create or replace function public.log_phone_call(
  p_phone text, p_direction text, p_started_at timestamptz, p_duration int, p_external_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10);
  l record;
  cid uuid;
  dup boolean := false;
  auto boolean;
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  if length(k) < 6 then return null; end if;

  select id, name into l from public.leads where phone_key = k
   order by (assigned_to = auth.uid()) desc nulls last, updated_at desc limit 1;

  if not found then
    select coalesce((data->>'autoCreateIncoming')::boolean, false) into auto from public.settings where id = 1;
    if auto and p_direction in ('incoming','missed') then
      insert into public.leads(name, phone, source, assigned_to, created_by)
      values ('New caller ' || right(k, 4), p_phone, 'Incoming call', auth.uid(), auth.uid())
      returning id, name into l;
      insert into public.activities(lead_id, actor_id, kind, text) values (l.id, auth.uid(), 'created', 'Incoming call');
    else
      return null;
    end if;
  end if;

  insert into public.calls(lead_id, agent_id, source, direction, started_at, duration, connected, external_id)
  values (l.id, auth.uid(), 'phone', p_direction, p_started_at, greatest(coalesce(p_duration,0),0),
          coalesce(p_duration,0) > 0, p_external_id)
  on conflict (external_id) do nothing
  returning id into cid;

  if cid is null then
    select id into cid from public.calls where external_id = p_external_id;
    dup := true;
  end if;
  return jsonb_build_object('call_id', cid, 'lead_id', l.id, 'lead_name', l.name, 'duplicate', dup);
end $$;

create or replace function public.set_call_outcome(
  p_call uuid, p_outcome text, p_note text, p_follow_up timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.calls set outcome = p_outcome, note = coalesce(p_note, ''), follow_up_at = p_follow_up
   where id = p_call and (agent_id = auth.uid() or public.is_mgr());
  if not found then raise exception 'call not found'; end if;
end $$;

create or replace function public.attach_recording(p_call uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.calls set recording_path = p_path
   where id = p_call and agent_id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- Reporting functions used by the web CRM
-- ---------------------------------------------------------------------
-- Accepts any time zone name; falls back to India time if the name is unknown.
create or replace function public.safe_tz(p text) returns text language plpgsql stable as $$
begin
  perform now() at time zone p;
  return p;
exception when others then
  return 'Asia/Kolkata';
end $$;

create or replace function public.dashboard_stats(
  p_from timestamptz, p_to timestamptz, p_agent uuid default null, p_campaign uuid default null,
  p_tz text default 'Asia/Kolkata')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare agent uuid := p_agent; res jsonb; tz text := public.safe_tz(p_tz);
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  if not public.is_mgr() then agent := auth.uid(); end if;

  with dm as (
    select x->>'id' as id, x->>'stage' as stage from public.settings s, jsonb_array_elements(s.data->'dispositions') x where s.id = 1
  ), c as (
    select c.*, dm.stage as dstage from public.calls c
      left join dm on dm.id = c.outcome
      join public.leads l on l.id = c.lead_id
     where c.started_at >= p_from and c.started_at < p_to
       and (agent is null or c.agent_id = agent)
       and (p_campaign is null or l.campaign_id = p_campaign)
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'n', count(*), 'conn', count(*) filter (where connected), 'talk', coalesce(sum(duration),0),
        'conv', count(*) filter (where dstage = 'won'), 'intr', count(*) filter (where dstage = 'interested'),
        'fus', count(*) filter (where follow_up_at is not null),
        'ai', count(*) filter (where source = 'ai'), 'auto', count(*) filter (where source = 'phone'),
        'recorded', count(*) filter (where recording_path is not null or recording_url is not null)) from c),
    'by_day', (select coalesce(jsonb_object_agg(d, v), '{}'::jsonb) from (
        select to_char(started_at at time zone tz, 'YYYY-MM-DD') d,
               jsonb_build_object('a', count(*) filter (where connected), 'b', count(*) filter (where not connected)) v
          from c group by 1) t),
    'by_hour', (select coalesce(jsonb_object_agg(h, v), '{}'::jsonb) from (
        select extract(hour from started_at at time zone tz)::int h,
               jsonb_build_object('a', count(*) filter (where connected), 'b', count(*) filter (where not connected)) v
          from c group by 1) t),
    'outcomes', (select coalesce(jsonb_object_agg(coalesce(outcome,'_none'), n), '{}'::jsonb) from (
        select outcome, count(*) n from c group by 1) t),
    'by_agent', (select coalesce(jsonb_object_agg(coalesce(agent_id::text,'ai'), v), '{}'::jsonb) from (
        select agent_id, jsonb_build_object('n', count(*), 'conn', count(*) filter (where connected),
               'talk', coalesce(sum(duration),0), 'conv', count(*) filter (where dstage = 'won'),
               'intr', count(*) filter (where dstage = 'interested'), 'fus', count(*) filter (where follow_up_at is not null)) v
          from c group by 1) t)
  ) into res;
  return res;
end $$;

create or replace function public.lead_summary(p_agent uuid default null, p_campaign uuid default null, p_tz text default 'Asia/Kolkata')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare agent uuid := p_agent; res jsonb;
  t0 timestamptz := date_trunc('day', now() at time zone public.safe_tz(p_tz)) at time zone public.safe_tz(p_tz);
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  if not public.is_mgr() then agent := auth.uid(); end if;
  with l as (
    select * from public.leads where (agent is null or assigned_to = agent) and (p_campaign is null or campaign_id = p_campaign)
  )
  select jsonb_build_object(
    'total', (select count(*) from l),
    'stages', (select coalesce(jsonb_object_agg(stage, jsonb_build_object('n', n, 'value', v)), '{}'::jsonb)
                 from (select stage, count(*) n, coalesce(sum(value),0) v from l group by stage) t),
    'overdue', (select count(*) from l where stage not in ('won','lost') and next_follow_up_at < now()),
    'today', (select count(*) from l where stage not in ('won','lost') and next_follow_up_at >= now() and next_follow_up_at < t0 + interval '1 day'),
    'fresh', (select count(*) from l where call_count = 0 and stage not in ('won','lost')),
    'unassigned', (select count(*) from l where assigned_to is null)
  ) into res;
  return res;
end $$;

create or replace function public.campaign_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  select coalesce(jsonb_object_agg(campaign_id, v), '{}'::jsonb) into res from (
    select campaign_id, jsonb_build_object(
      'n', count(*), 'called', count(*) filter (where call_count > 0),
      'intr', count(*) filter (where stage = 'interested'), 'won', count(*) filter (where stage = 'won'),
      'due', count(*) filter (where stage not in ('won','lost') and next_follow_up_at < now() + interval '1 day')) v
    from public.leads
    where campaign_id is not null and (public.is_mgr() or assigned_to = auth.uid())
    group by campaign_id) t;
  return res;
end $$;

-- Share leads out equally (round robin). p_which: 'unassigned' | 'fresh' | 'open'
create or replace function public.distribute_leads(p_which text, p_campaign uuid, p_agents uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_mgr() then raise exception 'only managers can share out leads'; end if;
  if coalesce(array_length(p_agents, 1), 0) = 0 then return 0; end if;
  with pick as (
    select id, row_number() over (order by created_at) - 1 as rn from public.leads
     where (p_campaign is null or campaign_id = p_campaign)
       and case p_which when 'unassigned' then assigned_to is null
                        when 'fresh' then call_count = 0 and stage not in ('won','lost')
                        else stage not in ('won','lost') end
  ), upd as (
    update public.leads l set assigned_to = p_agents[(pick.rn % array_length(p_agents,1)) + 1]
      from pick where l.id = pick.id returning l.id
  ) select count(*) into n from upd;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- API access for the app roles
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.distribute_leads(text, uuid, uuid[]) from anon;

-- Live updates in the web CRM
do $$ begin
  begin alter publication supabase_realtime add table public.leads; exception when others then null; end;
  begin alter publication supabase_realtime add table public.calls; exception when others then null; end;
  begin alter publication supabase_realtime add table public.ai_calls; exception when others then null; end;
end $$;
