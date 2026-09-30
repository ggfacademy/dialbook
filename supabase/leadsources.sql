-- =====================================================================
-- Dialbook Pro – Lead sources (Facebook pages, Google Ads, website forms)
-- and language-based lead assignment.
-- Run AFTER schema.sql (and whatsapp.sql if you use it). Safe to run again.
-- =====================================================================

-- Languages ------------------------------------------------------------
alter table public.leads     add column if not exists language text not null default '';
alter table public.leads     add column if not exists source_id uuid;
alter table public.leads     add column if not exists extra jsonb not null default '{}'::jsonb;
alter table public.profiles  add column if not exists languages text[] not null default '{}';
alter table public.campaigns add column if not exists language text not null default '';
create index if not exists leads_language on public.leads(language);

-- Default language list, assignment rules and per-language AI agents
update public.settings set data = data
  || jsonb_build_object('languages', coalesce(data->'languages', '["English","Hindi","Tamil","Telugu","Kannada","Malayalam","Marathi","Bengali","Gujarati","Punjabi","Odia"]'::jsonb))
  || jsonb_build_object('assignment', coalesce(data->'assignment', '{"enabled":false,"fallback":"all","rules":[{"id":"r1","language":"","source":"","campaign":"","mode":"speakers","agents":[]}]}'::jsonb))
where id = 1;

-- Lead sources ---------------------------------------------------------
create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('facebook','google','webhook')),
  name text not null,
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  token text not null default encode(gen_random_bytes(18), 'hex'),
  lead_count int not null default 0,
  last_lead_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.leads add constraint leads_source_fk foreign key (source_id) references public.lead_sources(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Page tokens and app keys: readable only by the server functions
create table if not exists public.lead_source_secrets (
  source_id uuid primary key references public.lead_sources(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
);
create table if not exists public.integration_secrets (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);
-- Every lead ID received from Facebook/Google, so a lead is never created twice
create table if not exists public.lead_refs (
  ref text primary key,
  lead_id uuid references public.leads(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Round-robin position for each assignment rule
create table if not exists public.assign_state (
  key text primary key,
  n bigint not null default 0
);

alter table public.lead_sources        enable row level security;
alter table public.lead_source_secrets enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.lead_refs           enable row level security;
alter table public.assign_state        enable row level security;
drop policy if exists ls_sel on public.lead_sources;
create policy ls_sel on public.lead_sources for select to authenticated using (public.is_mgr());
revoke all on public.lead_source_secrets, public.integration_secrets, public.lead_refs, public.assign_state from anon, authenticated;
grant select on public.lead_sources to authenticated;

-- Language names --------------------------------------------------------
-- Turns "ta", "tamil", "தமிழ்" etc. into the name used in Settings (e.g. "Tamil").
create or replace function public.norm_language(p text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text := lower(trim(coalesce(p,''))); langs jsonb; l text;
begin
  if v = '' then return ''; end if;
  v := case
    when v in ('en','eng','english','अंग्रेज़ी','अंग्रेजी') then 'english'
    when v in ('hi','hin','hindi','हिन्दी','हिंदी') then 'hindi'
    when v in ('ta','tam','tamil','தமிழ்') then 'tamil'
    when v in ('te','tel','telugu','తెలుగు') then 'telugu'
    when v in ('kn','kan','kannada','ಕನ್ನಡ') then 'kannada'
    when v in ('ml','mal','malayalam','മലയാളം') then 'malayalam'
    when v in ('mr','mar','marathi','मराठी') then 'marathi'
    when v in ('bn','ben','bengali','bangla','বাংলা') then 'bengali'
    when v in ('gu','guj','gujarati','ગુજરાતી') then 'gujarati'
    when v in ('pa','pan','punjabi','ਪੰਜਾਬੀ') then 'punjabi'
    when v in ('or','od','odia','oriya','ଓଡ଼ିଆ') then 'odia'
    else v end;
  select data->'languages' into langs from public.settings where id = 1;
  for l in select jsonb_array_elements_text(coalesce(langs,'[]'::jsonb)) loop
    if lower(l) = v then return l; end if;
  end loop;
  return initcap(v);
end $$;

-- Assignment -------------------------------------------------------------
-- Settings → Lead assignment stores ordered rules:
--   { id, language, source, campaign, mode: "speakers" | "people", agents: [profile ids] }
-- The first rule that matches and has someone available wins; people take turns (round robin).
-- mode "speakers" = telecallers whose languages include the lead's language.
create or replace function public.pick_assignee(p_language text, p_source text, p_campaign uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare a jsonb; r jsonb; cands uuid[]; k text; pos bigint; i int := 0;
begin
  select data->'assignment' into a from public.settings where id = 1;
  if a is null or not coalesce((a->>'enabled')::boolean, false) then return null; end if;
  for r in select * from jsonb_array_elements(coalesce(a->'rules','[]'::jsonb)) loop
    i := i + 1;
    if coalesce(r->>'language','') <> '' and lower(r->>'language') <> lower(coalesce(p_language,'')) then continue; end if;
    if coalesce(r->>'source','') <> '' and lower(r->>'source') <> lower(coalesce(p_source,'')) then continue; end if;
    if coalesce(r->>'campaign','') <> '' and (p_campaign is null or r->>'campaign' <> p_campaign::text) then continue; end if;
    cands := null;
    if coalesce(r->>'mode','speakers') = 'people' then
      select array_agg(p.id order by p.created_at) into cands from public.profiles p
       where p.active and p.id::text in (select jsonb_array_elements_text(coalesce(r->'agents','[]'::jsonb)));
    else
      if coalesce(p_language,'') = '' then continue; end if;
      select array_agg(p.id order by p.created_at) into cands from public.profiles p
       where p.active and p.role = 'telecaller' and exists (select 1 from unnest(p.languages) x where lower(x) = lower(p_language));
    end if;
    if cands is null or coalesce(array_length(cands,1),0) = 0 then continue; end if;
    k := 'rule:' || coalesce(nullif(r->>'id',''), i::text);
    insert into public.assign_state(key, n) values (k, 1)
      on conflict (key) do update set n = public.assign_state.n + 1 returning n into pos;
    return cands[((pos - 1) % array_length(cands,1)) + 1];
  end loop;
  if coalesce(a->>'fallback','all') = 'all' then
    select array_agg(id order by created_at) into cands from public.profiles where active and role = 'telecaller';
    if cands is null then return null; end if;
    insert into public.assign_state(key, n) values ('fallback', 1)
      on conflict (key) do update set n = public.assign_state.n + 1 returning n into pos;
    return cands[((pos - 1) % array_length(cands,1)) + 1];
  end if;
  return null;
end $$;

create or replace function public.leads_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.language := public.norm_language(new.language);
  if new.language = '' and new.campaign_id is not null then
    select language into new.language from public.campaigns where id = new.campaign_id;
    new.language := coalesce(new.language, '');
  end if;
  if new.assigned_to is null then
    new.assigned_to := public.pick_assignee(new.language, new.source, new.campaign_id);
  end if;
  return new;
end $$;
drop trigger if exists leads_before_insert on public.leads;
create trigger leads_before_insert before insert on public.leads
  for each row execute function public.leads_before_insert();

-- Apply the rules to leads that already exist (managers). p_ids null = all unassigned leads.
create or replace function public.auto_assign_leads(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare l record; who uuid; n int := 0;
begin
  if not public.is_mgr() then raise exception 'only managers can do this'; end if;
  for l in select id, language, source, campaign_id from public.leads
            where (p_ids is null and assigned_to is null) or (p_ids is not null and id = any(p_ids))
            order by created_at limit 5000 loop
    who := public.pick_assignee(l.language, l.source, l.campaign_id);
    if who is not null then
      update public.leads set assigned_to = who where id = l.id;
      insert into public.activities(lead_id, actor_id, kind, data) values (l.id, auth.uid(), 'assign', jsonb_build_object('to', who, 'rule', true));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Receive a lead from Facebook, Google or a website form ------------------
-- p: { name, phone, email, city, language, source, source_id, ref, campaign_id, tags[], note, extra, test }
-- A repeat enquiry from a number already in the CRM does not create a duplicate: the existing
-- lead gets a note, is reopened if it was lost, and is marked for a call today.
create or replace function public.ingest_lead(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k text := right(regexp_replace(coalesce(p->>'phone',''), '\D', '', 'g'), 10);
  v_ref text := nullif(p->>'ref','');
  ex_id uuid; ex_stage text; ex_who uuid;
  new_id uuid;
  who uuid;
  src uuid := nullif(p->>'source_id','')::uuid;
  v_tags text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'tags','[]'::jsonb)) x), '{}');
begin
  if auth.uid() is not null and not public.is_mgr() then raise exception 'not allowed'; end if;
  if v_ref is not null and exists (select 1 from public.lead_refs r where r.ref = v_ref) then
    return jsonb_build_object('status', 'duplicate');
  end if;
  if length(k) < 6 and coalesce(p->>'email','') = '' then
    return jsonb_build_object('status', 'skipped', 'reason', 'no phone or email');
  end if;

  if length(k) >= 6 then
    select l.id, l.stage, l.assigned_to into ex_id, ex_stage, ex_who from public.leads l where l.phone_key = k order by l.updated_at desc limit 1;
  end if;

  if ex_id is not null then
    update public.leads l
       set stage = case when l.stage = 'lost' then 'new' else l.stage end,
           next_follow_up_at = case when l.stage = 'won' then l.next_follow_up_at else now() end,
           language = case when l.language = '' then public.norm_language(p->>'language') else l.language end,
           tags = array(select distinct t from unnest(l.tags || v_tags) t),
           updated_at = now()
     where l.id = ex_id;
    insert into public.activities(lead_id, kind, text, data)
    values (ex_id, 'enquiry', 'Enquired again via ' || coalesce(nullif(p->>'source',''), 'a form') || coalesce(': ' || nullif(p->>'note',''), ''),
            jsonb_build_object('source', p->>'source', 'extra', coalesce(p->'extra','{}'::jsonb)));
    new_id := ex_id; who := ex_who;
  else
    insert into public.leads(name, phone, email, city, language, source, source_id, campaign_id, tags, note, extra)
    values (coalesce(nullif(p->>'name',''), 'New lead'),
            case when length(k) >= 6 then coalesce(p->>'phone','') else '' end,
            coalesce(p->>'email',''), coalesce(p->>'city',''), coalesce(p->>'language',''),
            coalesce(p->>'source',''), src, nullif(p->>'campaign_id','')::uuid,
            v_tags || case when coalesce((p->>'test')::boolean,false) then array['Test lead'] else '{}'::text[] end,
            coalesce(p->>'note',''), coalesce(p->'extra','{}'::jsonb))
    returning id, assigned_to into new_id, who;
    insert into public.activities(lead_id, kind, text) values (new_id, 'created', coalesce(p->>'source',''));
  end if;

  if v_ref is not null then insert into public.lead_refs(ref, lead_id) values (v_ref, new_id) on conflict do nothing; end if;
  if src is not null then
    update public.lead_sources set lead_count = lead_count + 1, last_lead_at = now(), last_error = null where id = src;
  end if;
  return jsonb_build_object('status', case when ex_id is not null then 'existing' else 'created' end, 'lead_id', new_id, 'assigned_to', who);
end $$;

revoke execute on function public.ingest_lead(jsonb) from anon, public;
revoke execute on function public.pick_assignee(text, text, uuid) from anon, authenticated, public;
grant execute on function public.ingest_lead(jsonb) to authenticated, service_role;
grant execute on function public.auto_assign_leads(uuid[]) to authenticated;
grant execute on function public.norm_language(text) to authenticated;
grant all on public.lead_sources, public.lead_source_secrets, public.integration_secrets, public.lead_refs, public.assign_state to service_role;
