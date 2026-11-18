-- Dialbook Pro – enquiry pages on the Dialbook website (web/enquiry/*.html) save leads through this function and get
-- a confirmed answer, so a page can fire its ad conversion (Google Ads, …) only after the lead is really saved.
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- Each page has a key in public.web_enquiry_forms that decides the lead source (e.g. GOOGLE ADS) and, optionally,
-- the campaign and default language. Anyone can call the function (it is a public web form), so it:
--   • accepts only known form keys and a valid 10-digit Indian mobile number,
--   • ignores bots that fill the hidden "website" field,
--   • accepts at most 30 enquiries a minute per form,
--   • never creates a second lead for a number already in Dialbook (ingest_lead marks it "enquired again").

create table if not exists public.web_enquiry_forms (
  key text primary key,
  source_id uuid not null references public.lead_sources(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  default_language text not null default '',
  active boolean not null default true
);
alter table public.web_enquiry_forms enable row level security;
revoke all on public.web_enquiry_forms from anon, authenticated, public;

create or replace function public.web_enquiry(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f public.web_enquiry_forms; s public.lead_sources; mob text; nm text; r jsonb; extra jsonb := '{}'; k text; note text := '';
begin
  select * into f from public.web_enquiry_forms where key = p->>'form' and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown form'); end if;
  select * into s from public.lead_sources where id = f.source_id and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'form paused'); end if;
  if coalesce(p->>'website', '') <> '' then return jsonb_build_object('ok', true, 'status', 'ignored'); end if;   -- bot

  mob := regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g');
  if length(mob) = 12 and mob like '91%' then mob := substr(mob, 3); end if;
  if length(mob) = 11 and mob like '0%' then mob := substr(mob, 2); end if;
  if mob !~ '^[6-9][0-9]{9}$' then return jsonb_build_object('ok', false, 'error', 'mobile'); end if;
  nm := left(btrim(coalesce(p->>'name', '')), 80);
  if length(nm) < 2 then return jsonb_build_object('ok', false, 'error', 'name'); end if;

  if (select count(*) from public.leads l where l.source_id = s.id and l.created_at > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;

  -- answers and ad tracking codes go into the lead's details and notes (never into the ad platforms from here)
  foreach k in array array['course', 'gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'page'] loop
    if coalesce(btrim(p->>k), '') <> '' then extra := extra || jsonb_build_object(k, left(btrim(p->>k), 300)); end if;
  end loop;
  if extra ? 'course' then note := 'Course: ' || (extra->>'course'); end if;
  if extra ? 'utm_campaign' then note := note || case when note = '' then '' else E'\n' end || 'Ad campaign: ' || (extra->>'utm_campaign'); end if;

  r := public.ingest_lead(jsonb_build_object(
    'name', nm, 'phone', '+91' || mob, 'email', left(btrim(coalesce(p->>'email', '')), 100),
    'city', left(btrim(coalesce(p->>'city', '')), 60),
    'language', coalesce(nullif(btrim(p->>'language'), ''), f.default_language),
    'source', s.name, 'source_id', s.id, 'campaign_id', f.campaign_id,
    'tags', '[]'::jsonb, 'note', note, 'extra', extra));
  return jsonb_build_object('ok', r->>'status' in ('created', 'existing'), 'status', r->>'status');
end $$;
revoke execute on function public.web_enquiry(jsonb) from public;
grant execute on function public.web_enquiry(jsonb) to anon, authenticated;

-- the Gold Appraisal page for Google Ads → lead source GOOGLE ADS
insert into public.web_enquiry_forms(key, source_id)
select 'google-gold-appraisal', id from public.lead_sources where name = 'GOOGLE ADS' order by created_at limit 1
on conflict (key) do nothing;

notify pgrst, 'reload schema';
