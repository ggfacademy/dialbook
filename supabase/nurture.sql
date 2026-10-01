-- Dialbook Pro – nurture sequences (automatic WhatsApp follow-ups)
-- Run once in Supabase → SQL Editor, after schema.sql, whatsapp.sql and leadsources.sql.
-- Safe to run again (the schedule at the end is replaced, so keep YOUR-PROJECT filled in).
--
-- A sequence is a list of steps ("day 0: template A, day 2: template B …") sent from one WhatsApp number.
-- New leads in the sequence's program (or any program) are enrolled automatically. The "whatsapp" edge
-- function sends the steps that are due every 15 minutes (see the schedule at the end of this file), and
-- stops a lead's sequence when they reply, are converted or lost, or are marked "do not call".

create table if not exists public.nurture_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default false,
  auto_enroll boolean not null default true,
  campaign_id uuid references public.campaigns(id) on delete set null,
  language text not null default '',          -- '' = any language
  account_id uuid references public.wa_accounts(id) on delete set null,
  stop_on_reply boolean not null default true,
  end_followup boolean not null default true,
  steps jsonb not null default '[]'::jsonb,   -- [{ "day": 0, "template_id": "…", "params": "{first_name}|{program}" }]
  created_at timestamptz not null default now()
);

create table if not exists public.nurture_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.nurture_sequences(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  step int not null default 0,
  status text not null default 'active' check (status in ('active','done','stopped')),
  stop_reason text,
  attempts int not null default 0,
  last_error text,
  enrolled_at timestamptz not null default now(),
  next_at timestamptz not null default now(),
  last_sent_at timestamptz,
  unique (sequence_id, lead_id)
);
alter table public.nurture_sequences add column if not exists language text not null default '';
create index if not exists nurture_due on public.nurture_enrollments(next_at) where status = 'active';
create index if not exists nurture_lead on public.nurture_enrollments(lead_id);

alter table public.nurture_sequences enable row level security;
alter table public.nurture_enrollments enable row level security;

drop policy if exists nu_seq_sel on public.nurture_sequences;
create policy nu_seq_sel on public.nurture_sequences for select to authenticated using (public.is_active());
drop policy if exists nu_seq_all on public.nurture_sequences;
create policy nu_seq_all on public.nurture_sequences for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists nu_en_sel on public.nurture_enrollments;
create policy nu_en_sel on public.nurture_enrollments for select to authenticated using (
  public.is_mgr() or (public.is_active() and exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid())));
drop policy if exists nu_en_ins on public.nurture_enrollments;
create policy nu_en_ins on public.nurture_enrollments for insert to authenticated with check (
  public.is_mgr() or (public.is_active() and exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid())));
drop policy if exists nu_en_upd on public.nurture_enrollments;
create policy nu_en_upd on public.nurture_enrollments for update to authenticated using (
  public.is_mgr() or (public.is_active() and exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid())));
drop policy if exists nu_en_del on public.nurture_enrollments;
create policy nu_en_del on public.nurture_enrollments for delete to authenticated using (public.is_mgr());

grant select, insert, update, delete on public.nurture_sequences, public.nurture_enrollments to authenticated;
grant all on public.nurture_sequences, public.nurture_enrollments to service_role;

-- When the first step is due for a lead enrolled now
create or replace function public.nurture_first_at(s public.nurture_sequences) returns timestamptz
language sql stable as $$ select now() + coalesce((s.steps->0->>'day')::numeric, 0) * interval '1 day' $$;

-- Enrol new leads in the best matching active sequence: the lead's program AND language first,
-- then its program, then its language, then "any program, any language". When a lead's program or
-- language changes before its first message went out, it is moved to the better match.
create or replace function public.nurture_best(p_campaign uuid, p_language text) returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from public.nurture_sequences s
   where s.active and s.auto_enroll and jsonb_array_length(s.steps) > 0
     and (s.campaign_id is null or s.campaign_id = p_campaign)
     and (s.language = '' or lower(s.language) = lower(coalesce(p_language, '')))
   order by (s.campaign_id is not null)::int * 2 + (s.language <> '')::int desc, s.created_at
   limit 1
$$;

create or replace function public.nurture_auto_enroll() returns trigger
language plpgsql security definer set search_path = public as $$
declare best uuid; cur public.nurture_enrollments;
begin
  if new.dnd or new.stage in ('won','lost') then return new; end if;
  if tg_op = 'UPDATE' and new.campaign_id is not distinct from old.campaign_id
     and new.language is not distinct from old.language then return new; end if;
  best := public.nurture_best(new.campaign_id, new.language);
  if best is null then return new; end if;
  select * into cur from public.nurture_enrollments e where e.lead_id = new.id and e.status = 'active' limit 1;
  if found then
    if cur.sequence_id = best or cur.last_sent_at is not null then return new; end if;
    delete from public.nurture_enrollments where id = cur.id;   -- nothing sent yet: switch to the better match
  end if;
  insert into public.nurture_enrollments(sequence_id, lead_id, next_at)
  select s.id, new.id, public.nurture_first_at(s) from public.nurture_sequences s where s.id = best
  on conflict (sequence_id, lead_id) do nothing;
  return new;
end $$;
drop trigger if exists nurture_auto_enroll on public.leads;
create trigger nurture_auto_enroll after insert or update of campaign_id, language on public.leads
  for each row execute function public.nurture_auto_enroll();

-- Managers: enrol existing open leads of the sequence's program and language (added in the last p_days days)
create or replace function public.nurture_enroll_existing(p_seq uuid, p_days int default 30) returns int
language plpgsql security definer set search_path = public as $$
declare s public.nurture_sequences; n int;
begin
  if not public.is_mgr() then raise exception 'not allowed'; end if;
  select * into s from public.nurture_sequences where id = p_seq;
  if not found then raise exception 'sequence not found'; end if;
  insert into public.nurture_enrollments(sequence_id, lead_id, next_at)
  select s.id, l.id, public.nurture_first_at(s) from public.leads l
   where not l.dnd and l.stage not in ('won','lost')
     and (s.campaign_id is null or l.campaign_id = s.campaign_id)
     and (s.language = '' or lower(l.language) = lower(s.language))
     and l.created_at > now() - make_interval(days => greatest(1, coalesce(p_days, 30)))
     and not exists (select 1 from public.nurture_enrollments e where e.lead_id = l.id and e.status = 'active')
  on conflict (sequence_id, lead_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.nurture_enroll_existing(uuid, int) to authenticated;

-- A ready-made sequence to edit (inactive until you pick the templates and switch it on)
insert into public.nurture_sequences(name, steps)
select 'Default follow-up', '[{"day":0,"params":"{first_name}"},{"day":2,"params":"{first_name}"},{"day":5,"params":"{first_name}"},{"day":10,"params":"{first_name}"}]'::jsonb
where not exists (select 1 from public.nurture_sequences);

-- The scheduler's password (checked by the "whatsapp" function)
insert into public.integration_secrets(key, value)
values ('nurture_cron', jsonb_build_object('token', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Schedule: every 15 minutes, ask the "whatsapp" function to send due steps.
-- Replace YOUR-PROJECT with your Supabase project reference (the part before .supabase.co).
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'dialbook-nurture';
select cron.schedule('dialbook-nurture', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/whatsapp',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-token', (select value->>'token' from public.integration_secrets where key = 'nurture_cron')),
    body := '{"action":"nurture_run"}'::jsonb)
$cron$);
