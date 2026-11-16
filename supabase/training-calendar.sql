-- Dialbook Pro – Training calendar: upcoming batches read from a Google Calendar.
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- An admin pastes the calendar's "Secret address in iCal format" once (Training calendar page → Calendar link,
-- or Google Calendar → Settings → the calendar → Integrate calendar). Every 30 minutes the database fetches it,
-- keeps the events whose title matches the keywords (MSME, GAC, GAA, GJSCI, TRAINING, BATCH) and shows them on
-- the Training calendar page. Other events in that calendar (payments, reminders…) are never stored.
-- The link itself is kept where no Dialbook login can read it.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.training_batches (
  uid text primary key,
  title text not null,
  starts date not null,
  ends date not null,                -- last day of the batch (inclusive)
  location text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists training_batches_starts on public.training_batches(starts);
alter table public.training_batches enable row level security;
drop policy if exists tb_sel on public.training_batches;
create policy tb_sel on public.training_batches for select to authenticated using (public.is_active());
grant select on public.training_batches to authenticated;

create table if not exists public.training_cal_config (
  id int primary key default 1 check (id = 1),
  ical_url text not null default '',
  keywords text not null default 'MSME|GAC|GAA|GJSCI|TRAINING|BATCH',
  request_id bigint,
  last_sync timestamptz,
  last_error text
);
insert into public.training_cal_config(id) values (1) on conflict do nothing;
alter table public.training_cal_config enable row level security;   -- no policies: only the functions below
revoke all on public.training_cal_config from anon, authenticated, public;

-- Turn iCal text into batches (keeps only titles matching the keywords; all-day end dates are exclusive in iCal)
create or replace function public.training_cal_parse_text(p_ics text, p_keywords text)
returns table(uid text, title text, starts date, ends date, location text, notes text)
language sql immutable as $$
  with t as (select regexp_replace(replace(coalesce(p_ics,''), E'\r', ''), E'\n[ \t]', '', 'g') as s),
  ev as (select e from t, regexp_split_to_table(t.s, 'BEGIN:VEVENT') with ordinality x(e, n) where n > 1),
  f as (select
      substring(e from E'\nUID:([^\n]+)') as uid,
      substring(e from E'\nSUMMARY[^:\n]*:([^\n]*)') as summary,
      substring(e from E'\nDTSTART[^:\n]*:([0-9]{8})') as ds,
      substring(e from E'\nDTEND[^:\n]*:([0-9]{8})') as de,
      (e ~ E'\nDTSTART[^:\n]*VALUE=DATE[:;]') as allday,
      coalesce(substring(e from E'\nLOCATION[^:\n]*:([^\n]*)'), '') as loc,
      coalesce(substring(e from E'\nDESCRIPTION[^:\n]*:([^\n]*)'), '') as descr,
      coalesce(substring(e from E'\nSTATUS:([^\n]*)'), '') as status
    from ev),
  u as (select uid, replace(replace(replace(replace(trim(summary), '\,', ','), '\;', ';'), '\n', ' '), '\\', '\') as title,
      to_date(ds, 'YYYYMMDD') as starts,
      case when de is null then to_date(ds, 'YYYYMMDD')
           when allday then greatest(to_date(de, 'YYYYMMDD') - 1, to_date(ds, 'YYYYMMDD'))
           else to_date(de, 'YYYYMMDD') end as ends,
      replace(replace(loc, '\,', ','), '\n', ', ') as location,
      left(replace(replace(replace(descr, '\,', ','), '\;', ';'), '\n', E'\n'), 1000) as notes,
      status
    from f where uid is not null and ds is not null)
  select uid, title, starts, ends, location, notes from u
   where status <> 'CANCELLED' and title ~* coalesce(nullif(p_keywords, ''), 'MSME|GAC|GAA|GJSCI|TRAINING|BATCH')
$$;

-- Ask Google for the calendar (the answer arrives a few seconds later and is read by training_cal_apply)
create or replace function public.training_cal_fetch() returns void
language plpgsql security definer set search_path = public as $$
declare c public.training_cal_config;
begin
  select * into c from public.training_cal_config where id = 1;
  if coalesce(c.ical_url, '') = '' then return; end if;
  update public.training_cal_config set request_id = net.http_get(url := c.ical_url, timeout_milliseconds := 30000) where id = 1;
end $$;

-- Read Google's answer and refresh the batches (from 90 days ago on; past batches stay for reference)
create or replace function public.training_cal_apply() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.training_cal_config; r record; n int := 0;
begin
  select * into c from public.training_cal_config where id = 1;
  if c.request_id is null then return jsonb_build_object('ok', false, 'reason', 'not set up'); end if;
  select status_code, content, error_msg, timed_out into r from net._http_response where id = c.request_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'waiting for Google'); end if;
  if coalesce(r.status_code, 0) <> 200 or coalesce(r.content, '') !~ 'BEGIN:VCALENDAR' then
    update public.training_cal_config set last_error = 'Google answered ' || coalesce(r.status_code::text, 'nothing') ||
      case when r.timed_out then ' (timed out)' else '' end || ': check the calendar link', request_id = null where id = 1;
    return jsonb_build_object('ok', false, 'reason', 'bad answer');
  end if;
  create temp table if not exists tmp_tb (uid text primary key, title text, starts date, ends date, location text, notes text) on commit drop;
  delete from tmp_tb;
  insert into tmp_tb select distinct on (p.uid) p.* from public.training_cal_parse_text(r.content, c.keywords) p where p.ends >= current_date - 90 order by p.uid, p.starts desc;
  insert into public.training_batches(uid, title, starts, ends, location, notes, updated_at)
    select uid, title, starts, ends, location, notes, now() from tmp_tb
  on conflict (uid) do update set title = excluded.title, starts = excluded.starts, ends = excluded.ends,
    location = excluded.location, notes = excluded.notes, updated_at = now();
  get diagnostics n = row_count;
  delete from public.training_batches b where b.ends >= current_date - 90 and not exists (select 1 from tmp_tb t where t.uid = b.uid);
  update public.training_cal_config set last_sync = now(), last_error = null, request_id = null where id = 1;
  return jsonb_build_object('ok', true, 'batches', n);
end $$;

-- Admin: save the link (from the Training calendar page) and fetch at once
create or replace function public.training_cal_set_url(p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'only admins can change this'; end if;
  if coalesce(p_url, '') <> '' and p_url !~* '^https://calendar\.google\.com/calendar/ical/.+\.ics$' then
    raise exception 'paste the "Secret address in iCal format" from Google Calendar (it ends with .ics)';
  end if;
  update public.training_cal_config set ical_url = coalesce(p_url, ''), last_error = null where id = 1;
  perform public.training_cal_fetch();
end $$;

-- Anyone signed in: when was it last synced, is a link set (never the link itself)
create or replace function public.training_cal_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('linked', coalesce(ical_url, '') <> '', 'last_sync', last_sync, 'last_error', last_error)
    from public.training_cal_config where id = 1 and public.is_active()
$$;

revoke execute on function public.training_cal_fetch() from anon, authenticated, public;
revoke execute on function public.training_cal_apply() from anon, public;
grant execute on function public.training_cal_apply() to authenticated;
revoke execute on function public.training_cal_set_url(text) from anon, public;
grant execute on function public.training_cal_set_url(text) to authenticated;
grant execute on function public.training_cal_status() to authenticated;

-- Every 30 minutes: fetch, and a few minutes later read the answer
select cron.unschedule(jobid) from cron.job where jobname in ('training-cal-fetch', 'training-cal-apply');
select cron.schedule('training-cal-fetch', '*/30 * * * *', $c$ select public.training_cal_fetch() $c$);
select cron.schedule('training-cal-apply', '2,32 * * * *', $c$ select public.training_cal_apply() $c$);

notify pgrst, 'reload schema';
