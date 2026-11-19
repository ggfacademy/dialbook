-- Dialbook Pro – conversion boosters (19 Nov 2026). Run in Supabase → SQL Editor. Safe to run again.
-- Already applied to the live database by Claude; this file keeps the record.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. "Payment pending" and "Asked for payment link" call outcomes move the lead to the Payment pending stage
--    (so the city's payment message goes out and Meta hears QualifiedLead).
update public.settings set data = jsonb_set(data, '{dispositions}', (
  select jsonb_agg(case when d->>'name' ilike 'payment pending' or d->>'name' ilike 'asked for payment link'
                        then d || '{"stage":"negotiation"}'::jsonb else d end order by o)
  from jsonb_array_elements(data->'dispositions') with ordinality x(d, o))), updated_at = now()
where id = 1;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Calls from the phone app that did not connect get an outcome by themselves
--    • outgoing call with 0 seconds and no outcome → "Did not pick" (no_answer): the missed-call WhatsApp goes out and a
--      call-back is set 3 hours later (after 7 pm → 10:30 am next morning; a later follow-up already planned is kept)
--    • a lead called us and it was missed / rejected → "call back now" follow-up and a note on the lead
-- The telecaller can still pick another outcome afterwards; theirs replaces this one.
create or replace function public.next_callback(p_lead uuid) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare cur timestamptz; t timestamptz; h int; d date;
begin
  select next_follow_up_at into cur from public.leads where id = p_lead;
  if cur is not null and cur > now() then return cur; end if;
  t := now() + interval '3 hours';
  h := extract(hour from t at time zone 'Asia/Kolkata');
  d := (t at time zone 'Asia/Kolkata')::date;
  if h >= 19 then d := d + 1; end if;
  if h >= 19 or h < 9 then t := (d + time '10:30') at time zone 'Asia/Kolkata'; end if;
  return t;
end $$;
revoke execute on function public.next_callback(uuid) from anon, public;

create or replace function public.calls_auto_outcome() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'phone' and new.outcome is null and coalesce(new.duration, 0) = 0 and new.direction = 'outgoing'
     and exists (select 1 from public.settings s, jsonb_array_elements(s.data->'dispositions') x where s.id = 1 and x->>'id' = 'no_answer') then
    new.outcome := 'no_answer';
    new.follow_up_at := coalesce(new.follow_up_at, public.next_callback(new.lead_id));
    if coalesce(new.note, '') = '' then new.note := 'Auto: call did not connect'; end if;
  end if;
  return new;
exception when others then raise warning 'calls_auto_outcome: %', sqlerrm; return new;
end $$;
drop trigger if exists calls_auto_outcome on public.calls;
create trigger calls_auto_outcome before insert on public.calls for each row execute function public.calls_auto_outcome();

create or replace function public.calls_missed_callback() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'phone' and new.direction in ('missed', 'rejected') then
    update public.leads set next_follow_up_at = now()
     where id = new.lead_id and stage not in ('won', 'lost')
       and (next_follow_up_at is null or next_follow_up_at > now());
    insert into public.activities(lead_id, actor_id, kind, text)
    values (new.lead_id, new.agent_id, 'note', 'Lead called and the call was missed – call back now');
  end if;
  return new;
exception when others then raise warning 'calls_missed_callback: %', sqlerrm; return new;
end $$;
drop trigger if exists calls_missed_callback on public.calls;
create trigger calls_missed_callback after insert on public.calls for each row execute function public.calls_missed_callback();

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Act on short WhatsApp replies (the messages ask candidates to reply YES / PAY / CALL / STOP / LATER; buttons send
--    "Reserve my seat" etc.). Only short replies (up to 30 letters) are read; anything else is left for the team.
create or replace function public.wa_reply_action(p_body text) returns text
language sql immutable as $$
  with n as (select btrim(regexp_replace(upper(regexp_replace(coalesce(p_body, ''), '[^A-Za-z ]', ' ', 'g')), '\s+', ' ', 'g')) b)
  select case
    when length(coalesce(p_body, '')) > 30 then null
    when b in ('YES','Y','S','YES PLEASE','YES SIR','YES MAM','RESERVE MY SEAT','BOOK MY SEAT','BOOK SEAT','INTERESTED','I AM INTERESTED','IM INTERESTED') then 'yes'
    when b in ('PAY','PAYMENT','PAYMENT LINK','SEND PAYMENT LINK','PAYMENT DETAILS','QR','QR CODE','SEND QR') then 'pay'
    when b in ('CALL','CALL ME','CALL ME BACK','CALLBACK','CALL BACK','PLEASE CALL','PLS CALL','FEE','FEES','FEE DETAILS','FEES DETAILS','DETAILS','MORE DETAILS','NEED HELP','NEED DETAILS') then 'call'
    when b in ('STOP','UNSUBSCRIBE','STOP MESSAGES','DONT MESSAGE','DO NOT MESSAGE') then 'stop'
    when b in ('NOT INTERESTED','NO LONGER NEEDED','NOT NEEDED','NO INTEREST','NOT INTERESTED NOW') then 'no'
    when b in ('LATER','NEXT BATCH','NEXT TIME','LATER PLEASE','NOT NOW','NEXT MONTH') then 'later'
  end from n
$$;

create or replace function public.wa_reply_auto() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; l public.leads; note text;
begin
  if new.direction <> 'in' or new.lead_id is null then return new; end if;
  a := public.wa_reply_action(new.body);
  if a is null then return new; end if;
  select * into l from public.leads where id = new.lead_id;
  if not found then return new; end if;
  if a = 'yes' then
    if l.stage in ('new', 'contacted', 'followup', 'lost') then
      update public.leads set stage = 'interested', next_follow_up_at = now() where id = l.id;
      note := 'Interested – call now';
    else update public.leads set next_follow_up_at = now() where id = l.id and stage <> 'won'; note := 'call now'; end if;
  elsif a = 'pay' then
    if l.stage not in ('won', 'negotiation') then
      update public.leads set stage = 'negotiation', next_follow_up_at = now() where id = l.id;
      note := 'Payment pending – payment details sent';
    else update public.leads set next_follow_up_at = now() where id = l.id and stage <> 'won'; note := 'call now'; end if;
  elsif a = 'call' then
    update public.leads set next_follow_up_at = now() where id = l.id and stage not in ('won', 'lost'); note := 'call now';
  elsif a = 'stop' then
    update public.leads set dnd = true, next_follow_up_at = null where id = l.id;
    update public.nurture_enrollments set status = 'stopped', stop_reason = 'replied STOP' where lead_id = l.id and status = 'active';
    note := 'do not contact (messages stopped)';
  elsif a = 'no' then
    if l.stage in ('new', 'contacted', 'followup', 'interested') then
      update public.leads set stage = 'lost', lost_reason = 'Not interested now', lost_at = now(), next_follow_up_at = null where id = l.id;
      note := 'Lost (not interested)';
    end if;
  elsif a = 'later' then   -- the dates don't suit: tag for the next batch (item 6 brings them back when it is added)
    if l.stage not in ('won') then
      update public.leads set tags = array_append(array_remove(coalesce(tags, '{}'), 'Next batch'), 'Next batch'), next_follow_up_at = null
       where id = l.id;
      note := 'wants a later batch (tagged “Next batch”)';
    end if;
  end if;
  if note is not null then
    insert into public.activities(lead_id, kind, text) values (l.id, 'note', 'WhatsApp reply “' || left(btrim(new.body), 30) || '” → ' || note);
  end if;
  return new;
exception when others then raise warning 'wa_reply_auto: %', sqlerrm; return new;
end $$;
drop trigger if exists wa_reply_auto on public.wa_messages;
create trigger wa_reply_auto after insert on public.wa_messages for each row execute function public.wa_reply_auto();

-- 4. Speed to lead: a new lead nobody has called 30 minutes after it arrived (counted from 9:00 IST for leads that come
--    in at night) → the assigned caller gets a private team-chat message with the lead (phone notification in the app,
--    badge and pop-up on the website). Still not called 90 minutes after that alert → the managers get one message listing them.
--    Settings (settings.data.speedToLead): enabled, minutes (30), escalateMinutes (90), startHour (9), endHour (20),
--    sender (the account the messages come from; default: the first admin).
--    Each lead is alerted once and escalated once (public.speed_alerts). Only leads from the last 2 days, stage New,
--    never called, not "do not contact", not test leads.
create table if not exists public.speed_alerts (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  alerted_at timestamptz,
  escalated_at timestamptz
);
alter table public.speed_alerts enable row level security;
revoke all on public.speed_alerts from anon, authenticated, public;

create or replace function public.team_dm(p_a uuid, p_b uuid) returns text language sql immutable as $$
  select 'dm:' || least(p_a::text, p_b::text) || ':' || greatest(p_a::text, p_b::text)
$$;

create or replace function public.speed_to_lead_run() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; mins int; esc int; sh int; eh int; snd uuid; now_ist timestamp; day_start timestamptz;
        r record; m record; n_alert int := 0; n_esc int := 0; txt text;
begin
  select coalesce(data->'speedToLead', '{}'::jsonb) into cfg from public.settings where id = 1;
  if coalesce((cfg->>'enabled')::boolean, true) = false then return jsonb_build_object('ok', true, 'off', true); end if;
  mins := coalesce((cfg->>'minutes')::int, 30); esc := coalesce((cfg->>'escalateMinutes')::int, 90);
  sh := coalesce((cfg->>'startHour')::int, 9); eh := coalesce((cfg->>'endHour')::int, 20);
  now_ist := now() at time zone 'Asia/Kolkata';
  if extract(hour from now_ist) < sh or extract(hour from now_ist) >= eh then return jsonb_build_object('ok', true, 'hours', false); end if;
  day_start := (date_trunc('day', now_ist) + make_interval(hours => sh)) at time zone 'Asia/Kolkata';
  snd := coalesce(nullif(cfg->>'sender', '')::uuid,
                  (select id from public.profiles where role = 'admin' and active order by created_at limit 1));
  if snd is null then return jsonb_build_object('ok', false, 'reason', 'no sender'); end if;

  -- waiting leads (not called yet), with the time they became due
  create temp table if not exists stl_wait(lead_id uuid, name text, phone text, city text, camp text, owner uuid, created timestamptz, due timestamptz) on commit drop;
  truncate stl_wait;
  insert into stl_wait
  select l.id, coalesce(nullif(l.name, ''), l.phone), l.phone, l.city, c.name, l.assigned_to, l.created_at,
         greatest(l.created_at, day_start) + make_interval(mins => mins)
    from public.leads l
    join public.profiles p on p.id = l.assigned_to and p.active
    left join public.campaigns c on c.id = l.campaign_id
   where l.created_at > now() - interval '2 days' and l.stage = 'new' and coalesce(l.call_count, 0) = 0
     and not coalesce(l.dnd, false) and not coalesce(l.contact_only, false)
     and not ('Test lead' = any(coalesce(l.tags, '{}')))
     and not exists (select 1 from public.calls k where k.lead_id = l.id);

  -- 1) the caller: one message per lead (a summary when 4 or more are waiting at once)
  for r in select w.owner, count(*) n, array_agg(w.lead_id order by w.due) ids,
                  string_agg('• ' || w.name || coalesce(' · ' || nullif(w.city, ''), '') || coalesce(' · ' || w.camp, ''), E'\n' order by w.due) list
             from stl_wait w
            where w.due <= now() and not exists (select 1 from public.speed_alerts a where a.lead_id = w.lead_id and a.alerted_at is not null)
            group by w.owner loop
    if r.owner = snd then null;   -- the sender's own leads: no message to themself
    elsif r.n >= 4 then
      insert into public.team_messages(channel, sender_id, body, lead_id)
      values (public.team_dm(snd, r.owner), snd,
              '⏱ Auto alert: ' || r.n || ' new leads are waiting for their first call. Please call them now (oldest first):' || E'\n' || left(r.list, 3500),
              r.ids[1]);
    else
      for m in select * from stl_wait w where w.lead_id = any(r.ids) order by w.due loop
        insert into public.team_messages(channel, sender_id, body, lead_id)
        values (public.team_dm(snd, r.owner), snd,
                '⏱ Auto alert: new lead not called yet (arrived ' || to_char(m.created at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || ') – ' ||
                m.name || coalesce(' · ' || nullif(m.city, ''), '') || coalesce(' · ' || m.camp, '') || '. Please call now.', m.lead_id);
      end loop;
    end if;
    insert into public.speed_alerts(lead_id, alerted_at) select unnest(r.ids), now()
    on conflict (lead_id) do update set alerted_at = coalesce(public.speed_alerts.alerted_at, now());
    n_alert := n_alert + r.n;
  end loop;

  -- 2) the managers: one message listing leads still not called long after the alert
  select count(*), string_agg('• ' || w.name || ' – ' || coalesce(p.name, '?') || ' (' || to_char(w.created at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') || ')', E'\n' order by w.due)
    into n_esc, txt
    from stl_wait w join public.speed_alerts a on a.lead_id = w.lead_id and a.alerted_at is not null and a.escalated_at is null
    left join public.profiles p on p.id = w.owner
   where a.alerted_at + make_interval(mins => esc) <= now();
  if n_esc > 0 then
    for m in select id from public.profiles where active and role in ('admin', 'manager') and id <> snd loop
      insert into public.team_messages(channel, sender_id, body)
      values (public.team_dm(snd, m.id), snd,
              '⚠ Auto alert: ' || n_esc || ' new lead' || case when n_esc = 1 then ' has' else 's have' end || ' still not been called (' || (mins + esc) ||
              '+ min). Lead – caller (arrived):' || E'\n' || left(txt, 3500));
    end loop;
    update public.speed_alerts a set escalated_at = now()
      from stl_wait w where w.lead_id = a.lead_id and a.alerted_at is not null and a.escalated_at is null
       and a.alerted_at + make_interval(mins => esc) <= now();
  end if;
  return jsonb_build_object('ok', true, 'alerted', n_alert, 'escalated', n_esc);
end $$;
revoke execute on function public.speed_to_lead_run() from anon, authenticated, public;

select cron.unschedule(jobid) from cron.job where jobname = 'speed-to-lead';
select cron.schedule('speed-to-lead', '*/10 * * * *', $c$ select public.speed_to_lead_run() $c$);

-- 5. Batch countdown: WhatsApp messages before each batch from the training calendar, to the leads of that course and
--    city who have spoken to the team (last 90 days; never Converted, Lost, "do not contact" or the contact list; never
--    a second WhatsApp within 20 hours):
--      GAC (4-day Gold Appraisal): 7 days before – gac_seats (Contacted, Follow-up, Interested, Payment pending)
--                                  3 days before – reminder_upcoming_gac (Interested, Payment pending)
--                                  1 day before  – gac_last_call (Follow-up, Interested, Payment pending)
--      GAA (2-day Gold Audit):     7 days before – gaa_seat (Contacted, Follow-up, Interested, Payment pending)
--                                  3 days before – gaa_reminder (Follow-up, Interested, Payment pending)
--    The batch date and city come from the training calendar. Each campaign has its own automatic-message sequence
--    "Batch countdown – <city>" (Settings → Automatic messages); pausing it there stops that city's countdown.
--    Runs once a day at about 10:07 IST; each message goes once per batch.
create table if not exists public.batch_countdown (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  title_match text not null,                       -- matched against the training-calendar title (case-insensitive)
  city text not null,
  kind text not null check (kind in ('gac', 'gaa')),
  sequence_id uuid references public.nurture_sequences(id) on delete set null,
  active boolean not null default true,
  sent jsonb not null default '{}'                 -- "<batch uid>:<days before>" → when and to how many
);
alter table public.batch_countdown enable row level security;
revoke all on public.batch_countdown from anon, authenticated, public;

insert into public.batch_countdown(campaign_id, title_match, city, kind)
select c.id, x.m, x.city, x.kind from (values
  ('Gold Appraisal Training - Chennai',    '^(?=.*\mMSME\M)(?=.*\mGAC\M)(?=.*\mCHN\M)',    'Chennai',    'gac'),
  ('Gold Appraisal Training - Vijayawada', '^(?=.*\mMSME\M)(?=.*\mGAC\M)(?=.*\mVJW\M)',    'Vijayawada', 'gac'),
  ('Gold Appraisal Training - Hyderabad',  '^(?=.*\mMSME\M)(?=.*\mGAC\M)(?=.*\mHYD\M)',    'Hyderabad',  'gac'),
  ('Gold Audit and Appraisal – Mumbai',    '^(?=.*\mMSME\M)(?=.*\mGAA\M)(?=.*\mMUMBAI\M)', 'Mumbai',     'gaa'),
  ('Gold Audit and Appraisal – Mysuru',    '^(?=.*\mMSME\M)(?=.*\mGAA\M)(?=.*\mMYSURU\M)', 'Mysuru',     'gaa')) x(camp, m, city, kind)
join public.campaigns c on c.name = x.camp
on conflict (campaign_id) do update set title_match = excluded.title_match;   -- MSME batches only; words in any order

-- one sequence per campaign (not auto-enrolled; its single step is set by the countdown each time it sends)
do $$
declare r record; s uuid;
begin
  for r in select * from public.batch_countdown where sequence_id is null loop
    insert into public.nurture_sequences(name, active, auto_enroll, campaign_id, account_id, stop_on_reply, end_followup, steps)
    values ('Batch countdown – ' || r.city, true, false, null,
            (select account_id from public.wa_templates where id = '451c07a4-2ced-41ee-8b9f-0beb64784b37'), false, false, '[]')
    returning id into s;
    update public.batch_countdown set sequence_id = s where campaign_id = r.campaign_id;
  end loop;
end $$;

create or replace function public.batch_countdown_run(p_dry boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; b record; d int; tpl uuid; params text; aud text[]; n int; dt text; k text; lid uuid;
        today date := (now() at time zone 'Asia/Kolkata')::date; out jsonb := '[]';
begin
  for r in select bc.*, s.active seq_active from public.batch_countdown bc join public.nurture_sequences s on s.id = bc.sequence_id
            where bc.active loop
    select * into b from public.training_batches t where t.title ~* r.title_match and t.starts > today and t.starts <= today + 7
     order by t.starts limit 1;
    if not found then continue; end if;
    d := b.starts - today; dt := to_char(b.starts, 'FMDD Mon YYYY'); tpl := null;
    if r.kind = 'gac' then
      if d = 7 then tpl := '451c07a4-2ced-41ee-8b9f-0beb64784b37';       -- gac_seats: only a few seats are left for {{2}}
        params := '{first_name}|the Gold Appraisal training in ' || r.city || ' starting ' || dt; aud := array['contacted','followup','interested','negotiation'];
      elsif d = 3 then tpl := '1cf2fcbf-69c6-47d7-b1d9-2af50b32905a';    -- reminder_upcoming_gac: training in {{3}} on {{2}}
        params := '{first_name}|' || dt || '|' || r.city; aud := array['interested','negotiation'];
      elsif d = 1 then tpl := 'fa3b5e44-4dad-4ece-bc99-1a4251a1e1fa';    -- gac_last_call: registrations for {{2}} close soon
        params := '{first_name}|the ' || r.city || ' batch starting ' || dt; aud := array['followup','interested','negotiation'];
      end if;
    else
      if d = 7 then tpl := 'cd662146-7322-4924-bc09-dba6061eb614';       -- gaa_seat
        params := '{first_name}'; aud := array['contacted','followup','interested','negotiation'];
      elsif d = 3 then tpl := 'b7249bbf-4d53-4d93-ac76-dd40cf2cfa5a';    -- gaa_reminder (last reminder)
        params := '{first_name}'; aud := array['followup','interested','negotiation'];
      end if;
    end if;
    k := b.uid || ':' || d;
    if tpl is null or r.sent ? k or not r.seq_active then continue; end if;

    if not p_dry then
      update public.nurture_sequences set steps = jsonb_build_array(jsonb_build_object('day', 0, 'params', params, 'template_id', tpl))
       where id = r.sequence_id;
    end if;
    n := 0;
    for lid in select l.id from public.leads l
                where l.campaign_id = r.campaign_id and l.stage = any(aud)
                  and not coalesce(l.dnd, false) and not coalesce(l.contact_only, false)
                  and greatest(l.created_at, coalesce(l.last_enquiry_at, l.created_at)) > now() - interval '90 days'
                  and not exists (select 1 from public.wa_messages w where w.lead_id = l.id and w.direction = 'out' and w.created_at > now() - interval '20 hours') loop
      if not p_dry then perform public.auto_msg_enroll(lid, r.sequence_id, interval '20 hours'); end if;
      n := n + 1;
    end loop;
    if not p_dry then
      update public.batch_countdown set sent = sent || jsonb_build_object(k, jsonb_build_object('at', now(), 'leads', n)) where campaign_id = r.campaign_id;
    end if;
    out := out || jsonb_build_object('city', r.city, 'batch', b.title, 'starts', b.starts, 'days_before', d, 'leads', n);
  end loop;
  return out;
end $$;
revoke execute on function public.batch_countdown_run(boolean) from anon, authenticated, public;

select cron.unschedule(jobid) from cron.job where jobname = 'batch-countdown';
select cron.schedule('batch-countdown', '37 4 * * *', $c$ select public.batch_countdown_run() $c$);

-- 6. Win back "next batch" leads: when a new batch appears in the training calendar for a course and city (the
--    batch_countdown list above), that campaign's leads who
--      • chose the call outcome "Will attend next batch", or
--      • replied LATER / NEXT BATCH on WhatsApp (tag "Next batch"), or
--      • were marked Lost with the reason "Dates or timing not suitable" (last 180 days)
--    come back into Follow-ups (Lost → Follow-up), due now (or 10:30 IST next morning after 19:00), with a note
--    naming the new batch. Their caller gets one team-chat message saying how many came back. Never Converted
--    or "do not contact" leads.
create or replace function public.batch_winback(p_uid text) returns int
language plpgsql security definer set search_path = public as $$
declare b public.training_batches; r record; o record; n int := 0; tot int := 0; due timestamptz; h int; snd uuid; dt text;
begin
  select * into b from public.training_batches where uid = p_uid;
  if not found or b.starts <= (now() at time zone 'Asia/Kolkata')::date then return 0; end if;
  dt := to_char(b.starts, 'FMDD Mon YYYY');
  h := extract(hour from now() at time zone 'Asia/Kolkata');
  due := case when h between 9 and 18 then now()
              else (date_trunc('day', now() at time zone 'Asia/Kolkata') + case when h >= 19 then interval '1 day' else interval '0' end
                    + interval '10 hours 30 minutes') at time zone 'Asia/Kolkata' end;
  snd := (select id from public.profiles where role = 'admin' and active order by created_at limit 1);
  for r in select * from public.batch_countdown bc where bc.active and b.title ~* bc.title_match loop
    create temp table if not exists wb_leads(id uuid, owner uuid) on commit drop;
    truncate wb_leads;
    with upd as (
      update public.leads l
         set stage = case when l.stage = 'lost' then 'followup' else l.stage end,
             lost_reason = case when l.stage = 'lost' then null else l.lost_reason end,
             lost_at = case when l.stage = 'lost' then null else l.lost_at end,
             tags = array_remove(coalesce(l.tags, '{}'), 'Next batch'),
             next_follow_up_at = due
       where l.campaign_id = r.campaign_id and l.stage <> 'won' and not coalesce(l.dnd, false)
         and (l.last_outcome = 'dmus3m2jevdnn7p' or 'Next batch' = any(coalesce(l.tags, '{}'))
              or (l.stage = 'lost' and l.lost_reason = 'Dates or timing not suitable' and l.lost_at > now() - interval '180 days'))
      returning l.id, l.assigned_to)
    insert into wb_leads select id, assigned_to from upd;
    insert into public.activities(lead_id, kind, text)
    select id, 'note', 'New batch added: ' || r.city || ', starting ' || dt || ' (' || b.title || '). This lead wanted a later batch – call to offer the new dates.'
      from wb_leads;
    get diagnostics n = row_count;
    tot := tot + n;
    if snd is not null then
      for o in select owner, count(*) c, (array_agg(id))[1] one from wb_leads where owner is not null and owner <> snd group by owner loop
        insert into public.team_messages(channel, sender_id, body, lead_id)
        values (public.team_dm(snd, o.owner), snd,
                '📅 Auto alert: new ' || r.city || ' batch added, starting ' || dt || '. ' || o.c || ' of your lead' || case when o.c = 1 then '' else 's' end ||
                ' who wanted a later batch ' || case when o.c = 1 then 'is' else 'are' end || ' back in Follow-ups – please call to offer the new dates.', o.one);
      end loop;
    end if;
  end loop;
  return tot;
end $$;
revoke execute on function public.batch_winback(text) from anon, authenticated, public;

create or replace function public.training_batches_winback() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.batch_winback(new.uid);
  return new;
exception when others then raise warning 'training_batches_winback: %', sqlerrm; return new;   -- never block the calendar sync
end $$;
drop trigger if exists training_batches_winback on public.training_batches;
create trigger training_batches_winback after insert on public.training_batches for each row execute function public.training_batches_winback();

-- 7. Morning summary (about 9:20 IST every day): each caller gets a private team-chat message with today's work –
--    Payment pending, Interested, follow-ups due today, overdue follow-ups, new leads not called yet – and their top 5
--    leads to call first. Admins and managers get one message with every caller's numbers and yesterday's calls.
create or replace function public.daily_summary_run() returns jsonb
language plpgsql security definer set search_path = public as $$
declare snd uuid; d0 timestamptz; d1 timestamptz; y0 timestamptz; r record; m record; body text; top text; top1 uuid; n int := 0; team text;
begin
  if coalesce((select (data->'dailySummary'->>'enabled')::boolean from public.settings where id = 1), true) = false then
    return jsonb_build_object('ok', true, 'off', true);
  end if;
  snd := (select id from public.profiles where role = 'admin' and active order by created_at limit 1);
  if snd is null then return jsonb_build_object('ok', false, 'reason', 'no sender'); end if;
  d0 := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  d1 := d0 + interval '1 day'; y0 := d0 - interval '1 day';

  create temp table if not exists ds(owner uuid, name text, pay int, hot int, today int, overdue int, oldest timestamptz, fresh int, calls int, conn int) on commit drop;
  truncate ds;
  insert into ds
  select p.id, p.name,
         count(l.id) filter (where l.stage = 'negotiation'),
         count(l.id) filter (where l.stage = 'interested'),
         count(l.id) filter (where l.next_follow_up_at >= d0 and l.next_follow_up_at < d1),
         count(l.id) filter (where l.next_follow_up_at < d0),
         min(l.next_follow_up_at) filter (where l.next_follow_up_at < d0),
         count(l.id) filter (where l.stage = 'new' and coalesce(l.call_count, 0) = 0),
         (select count(*) from public.calls k where k.agent_id = p.id and k.started_at >= y0 and k.started_at < d0),
         (select count(*) from public.calls k where k.agent_id = p.id and k.started_at >= y0 and k.started_at < d0 and (k.connected or k.duration > 0))
    from public.profiles p
    left join public.leads l on l.assigned_to = p.id and l.stage not in ('won', 'lost') and not coalesce(l.dnd, false) and not coalesce(l.contact_only, false)
   where p.active
   group by p.id, p.name;

  for r in select * from ds where owner <> snd and (pay + hot + today + overdue + fresh) > 0 loop
    select string_agg('• ' || coalesce(nullif(x.name, ''), x.phone) || ' · ' || case x.stage when 'negotiation' then 'Payment pending' else 'Interested' end ||
                      coalesce(' · ' || x.camp, ''), E'\n' order by x.rk, x.fu nulls last),
           (array_agg(x.id order by x.rk, x.fu nulls last))[1]
      into top, top1
      from (select l.id, l.name, l.phone, l.stage, c.name camp, l.next_follow_up_at fu, case l.stage when 'negotiation' then 0 else 1 end rk
              from public.leads l left join public.campaigns c on c.id = l.campaign_id
             where l.assigned_to = r.owner and l.stage in ('negotiation', 'interested') and not coalesce(l.dnd, false) and not coalesce(l.contact_only, false)
             order by rk, l.next_follow_up_at nulls last limit 5) x;
    body := '☀ Good morning, ' || split_part(r.name, ' ', 1) || '! Your list for today:' ||
            case when r.pay > 0 then E'\n• Payment pending: ' || r.pay || ' – call these first' else '' end ||
            case when r.hot > 0 then E'\n• Interested: ' || r.hot else '' end ||
            E'\n• Follow-ups due today: ' || r.today ||
            case when r.overdue > 0 then E'\n• Overdue follow-ups: ' || r.overdue || ' (oldest ' || to_char(r.oldest at time zone 'Asia/Kolkata', 'FMDD Mon') || ')' else '' end ||
            case when r.fresh > 0 then E'\n• New leads not called yet: ' || r.fresh else '' end ||
            E'\n• Your calls yesterday: ' || r.calls || ' (' || r.conn || ' connected)' ||
            case when top is not null then E'\n\nCall first:\n' || top else '' end;
    insert into public.team_messages(channel, sender_id, body, lead_id) values (public.team_dm(snd, r.owner), snd, left(body, 3900), top1);
    n := n + 1;
  end loop;

  select string_agg('• ' || name || ': overdue ' || overdue || ' · due today ' || today || ' · payment pending ' || pay || ' · interested ' || hot ||
                    ' · not called ' || fresh || ' · calls yesterday ' || calls || ' (' || conn || ' connected)', E'\n' order by overdue desc, name)
    into team from ds where (pay + hot + today + overdue + fresh + calls) > 0;
  if team is not null then
    for m in select id from public.profiles where active and role in ('admin', 'manager') and id <> snd loop
      insert into public.team_messages(channel, sender_id, body) values (public.team_dm(snd, m.id), snd, left('📊 Team summary for today:' || E'\n' || team, 3900));
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'callers', n);
end $$;
revoke execute on function public.daily_summary_run() from anon, authenticated, public;

select cron.unschedule(jobid) from cron.job where jobname = 'daily-summary';
select cron.schedule('daily-summary', '50 3 * * *', $c$ select public.daily_summary_run() $c$);

-- 8. Link leads without a campaign: from what the lead wrote on WhatsApp (first 3 messages) and the lead's note, or
--    else the lead's city – only when exactly one active campaign's place names match (public.campaign_keywords).
--    New leads are linked as their first WhatsApp message arrives; a job every 30 minutes catches the rest (last 60
--    days). Linking a NEW lead (last 2 days) also starts that campaign's automatic messages as usual; older leads are
--    only linked, so the backlog never gets a burst of messages. Each link leaves a note on the lead.
create table if not exists public.campaign_keywords (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  pattern text not null                                  -- case-insensitive regular expression
);
alter table public.campaign_keywords enable row level security;
revoke all on public.campaign_keywords from anon, authenticated, public;
insert into public.campaign_keywords(campaign_id, pattern)
select c.id, x.p from (values
  ('Gold Audit and Appraisal – Mumbai',    '\m(mumbai|andheri|bombay)\M'),
  ('Gold Audit and Appraisal – Mysuru',    '\m(mysuru|mysore)\M'),
  ('Gold Appraisal Training - Chennai',    '\m(chennai|madras|mogappair)\M'),
  ('Gold Appraisal Training - Vijayawada', '\m(vijayawada|bezawada)\M'),
  ('Gold Appraisal Training - Hyderabad',  '\m(hyderabad|secunderabad)\M')) x(camp, p)
join public.campaigns c on c.name = x.camp
on conflict (campaign_id) do nothing;

create or replace function public.campaign_guess(p_lead uuid, out campaign_id uuid, out why text)
language plpgsql stable security definer set search_path = public as $$
declare l public.leads; txt text;
begin
  select * into l from public.leads where id = p_lead;
  if not found then return; end if;
  select coalesce(string_agg(left(w.body, 500), ' '), '') into txt
    from (select body from public.wa_messages w where w.lead_id = p_lead and w.direction = 'in' order by w.created_at limit 3) w;
  txt := txt || ' ' || coalesce(l.note, '');
  select case when count(*) = 1 then min(k.campaign_id::text)::uuid end into campaign_id
    from public.campaign_keywords k join public.campaigns c on c.id = k.campaign_id and c.active where txt ~* k.pattern;
  if campaign_id is not null then why := 'from the WhatsApp message'; return; end if;
  if coalesce(l.city, '') <> '' then
    select case when count(*) = 1 then min(k.campaign_id::text)::uuid end into campaign_id
      from public.campaign_keywords k join public.campaigns c on c.id = k.campaign_id and c.active where l.city ~* k.pattern;
    if campaign_id is not null then why := 'from the city'; end if;
  end if;
end $$;

create or replace function public.campaign_autolink(p_lead uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare g record; l public.leads;
begin
  select * into l from public.leads where id = p_lead;
  if not found or l.campaign_id is not null or coalesce(l.contact_only, false) then return false; end if;
  select * into g from public.campaign_guess(p_lead);
  if g.campaign_id is null then return false; end if;
  update public.leads set campaign_id = g.campaign_id where id = p_lead and campaign_id is null;
  if l.created_at < now() - interval '2 days' then   -- backlog: link only, no automatic messages
    delete from public.nurture_enrollments where lead_id = p_lead and enrolled_at >= now() and last_sent_at is null;
  end if;
  insert into public.activities(lead_id, kind, text)
  values (p_lead, 'note', 'Course linked automatically: ' || (select name from public.campaigns where id = g.campaign_id) || ' (' || g.why || ')');
  return true;
end $$;
revoke execute on function public.campaign_guess(uuid) from anon, authenticated, public;
revoke execute on function public.campaign_autolink(uuid) from anon, authenticated, public;

create or replace function public.wa_campaign_autolink() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'in' and new.lead_id is not null
     and exists (select 1 from public.leads l where l.id = new.lead_id and l.campaign_id is null) then
    perform public.campaign_autolink(new.lead_id);
  end if;
  return new;
exception when others then raise warning 'wa_campaign_autolink: %', sqlerrm; return new;
end $$;
drop trigger if exists wa_campaign_autolink on public.wa_messages;
create trigger wa_campaign_autolink after insert on public.wa_messages for each row execute function public.wa_campaign_autolink();

create or replace function public.campaign_autolink_run() returns int
language plpgsql security definer set search_path = public as $$
declare lid uuid; n int := 0;
begin
  for lid in select id from public.leads where campaign_id is null and created_at > now() - interval '60 days'
                and not coalesce(contact_only, false) order by created_at desc limit 1000 loop
    if public.campaign_autolink(lid) then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.campaign_autolink_run() from anon, authenticated, public;

select cron.unschedule(jobid) from cron.job where jobname = 'campaign-autolink';
select cron.schedule('campaign-autolink', '11,41 * * * *', $c$ select public.campaign_autolink_run() $c$);

-- 9. Payment proof (fees are paid only through the MSME payment link, so Dialbook cannot see payments itself):
--    when a lead in Interested or Payment pending sends a photo or PDF on WhatsApp, or a short message like
--    "paid", "payment done", "UTR …", the lead is due for a call now (a payment message also moves it to Payment
--    pending), gets a note, and the
--    caller gets a team-chat message to check the payment on the MSME side and mark the lead Converted.
--    At most one alert per lead every 6 hours.
create or replace function public.wa_payment_proof() returns trigger
language plpgsql security definer set search_path = public as $$
declare l public.leads; kind text; snd uuid;
begin
  if new.direction <> 'in' or new.lead_id is null then return new; end if;
  if new.media_type in ('image', 'document') then kind := case new.media_type when 'image' then 'a photo' else 'a document' end;
  elsif length(coalesce(new.body, '')) <= 160 and new.body ~* '\m(paid|payment (is )?(done|completed|successful|made)|amount (paid|sent|transferred)|fees? paid|paid (the )?fees?|transaction|utr|txn|ref(erence)? no)\M'
    then kind := 'a payment message';
  else return new; end if;
  select * into l from public.leads where id = new.lead_id;
  if not found or l.stage not in ('interested', 'negotiation') then return new; end if;
  if exists (select 1 from public.activities a where a.lead_id = l.id and a.text like 'Payment proof?%' and a.created_at > now() - interval '6 hours') then
    return new;
  end if;
  -- a photo may also be an ID or certificate copy, so only a payment message moves the stage
  update public.leads set stage = case when kind = 'a payment message' then 'negotiation' else stage end, next_follow_up_at = now()
   where id = l.id and stage <> 'won';
  insert into public.activities(lead_id, kind, text)
  values (l.id, 'note', 'Payment proof? The lead sent ' || kind || ' on WhatsApp' ||
                        case when kind = 'a payment message' then ' (“' || left(btrim(new.body), 60) || '”)' else '' end ||
                        ' – check the payment on the MSME side and mark Converted.');
  snd := (select id from public.profiles where role = 'admin' and active order by created_at limit 1);
  if snd is not null and l.assigned_to is not null and l.assigned_to <> snd then
    insert into public.team_messages(channel, sender_id, body, lead_id)
    values (public.team_dm(snd, l.assigned_to), snd,
            '💰 Auto alert: ' || coalesce(nullif(l.name, ''), l.phone) || ' sent ' || kind || ' on WhatsApp – it may be the fee payment. ' ||
            'Please check it on the MSME side and mark the lead Converted.', l.id);
  end if;
  return new;
exception when others then raise warning 'wa_payment_proof: %', sqlerrm; return new;
end $$;
drop trigger if exists wa_payment_proof on public.wa_messages;
create trigger wa_payment_proof after insert on public.wa_messages for each row execute function public.wa_payment_proof();

-- 10. Paid students: the day before a Gold Appraisal (GAC) batch, Converted students of that course get the
--     batch_reminder template ("Your training starts tomorrow at 10 am. Venue: … Please bring an ID proof …").
--     "Paid for this batch" = marked Converted after the end of the course's previous batch (or in the last 60 days).
--     GAA (Gold Audit) starts at 11 am, so it is left out until there is a template without the time.
--     Needs the "whatsapp" Edge Function version that lets sequences marked include_won reach Converted leads.
alter table public.nurture_sequences add column if not exists include_won boolean not null default false;
alter table public.batch_countdown add column if not exists paid_sequence_id uuid references public.nurture_sequences(id) on delete set null;
do $$
declare r record; s uuid;
begin
  for r in select * from public.batch_countdown where kind = 'gac' and paid_sequence_id is null loop
    insert into public.nurture_sequences(name, active, auto_enroll, campaign_id, account_id, stop_on_reply, end_followup, include_won, steps)
    values ('Paid students – day-before reminder – ' || r.city, true, false, null,
            (select account_id from public.wa_templates where id = 'd773adfb-06e9-486d-852c-cc918d770e0e'), false, false, true,
            jsonb_build_array(jsonb_build_object('day', 0, 'params', '{first_name}|{venue}', 'template_id', 'd773adfb-06e9-486d-852c-cc918d770e0e')))
    returning id into s;
    update public.batch_countdown set paid_sequence_id = s where campaign_id = r.campaign_id;
  end loop;
end $$;

create or replace function public.batch_countdown_run(p_dry boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; b record; d int; tpl uuid; params text; aud text[]; n int; dt text; k text; lid uuid; prev_end date;
        today date := (now() at time zone 'Asia/Kolkata')::date; out jsonb := '[]';
begin
  for r in select bc.*, s.active seq_active, ps.active paid_active
             from public.batch_countdown bc join public.nurture_sequences s on s.id = bc.sequence_id
             left join public.nurture_sequences ps on ps.id = bc.paid_sequence_id
            where bc.active loop
    select * into b from public.training_batches t where t.title ~* r.title_match and t.starts > today and t.starts <= today + 7
     order by t.starts limit 1;
    if not found then continue; end if;
    d := b.starts - today; dt := to_char(b.starts, 'FMDD Mon YYYY'); tpl := null; k := b.uid || ':' || d;

    -- paid students: the day before a GAC batch
    if r.kind = 'gac' and d = 1 and coalesce(r.paid_active, false) and not (r.sent ? (k || ':paid')) then
      select max(t.ends) into prev_end from public.training_batches t where t.title ~* r.title_match and t.starts < b.starts and t.uid <> b.uid;
      n := 0;
      for lid in select l.id from public.leads l
                  where l.campaign_id = r.campaign_id and l.stage = 'won' and not coalesce(l.dnd, false)
                    and (select max(a.created_at) from public.activities a where a.lead_id = l.id and a.kind = 'stage' and a.data->>'to' = 'won')
                        > greatest(coalesce((prev_end + 1)::timestamp at time zone 'Asia/Kolkata', '-infinity'::timestamptz), now() - interval '60 days') loop
        if not p_dry then
          insert into public.nurture_enrollments(sequence_id, lead_id, next_at) values (r.paid_sequence_id, lid, now())
          on conflict (sequence_id, lead_id) do update
            set status = 'active', step = 0, attempts = 0, last_error = null, stop_reason = null, enrolled_at = now(), next_at = now()
          where nurture_enrollments.last_sent_at is null or nurture_enrollments.last_sent_at < now() - interval '20 hours';
        end if;
        n := n + 1;
      end loop;
      if not p_dry then
        update public.batch_countdown set sent = sent || jsonb_build_object(k || ':paid', jsonb_build_object('at', now(), 'leads', n)) where campaign_id = r.campaign_id;
      end if;
      out := out || jsonb_build_object('city', r.city, 'batch', b.title, 'starts', b.starts, 'days_before', d, 'paid_students', n);
    end if;

    -- leads who have not paid yet
    if r.kind = 'gac' then
      if d = 7 then tpl := '451c07a4-2ced-41ee-8b9f-0beb64784b37';       -- gac_seats: only a few seats are left for {{2}}
        params := '{first_name}|the Gold Appraisal training in ' || r.city || ' starting ' || dt; aud := array['contacted','followup','interested','negotiation'];
      elsif d = 3 then tpl := '1cf2fcbf-69c6-47d7-b1d9-2af50b32905a';    -- reminder_upcoming_gac: training in {{3}} on {{2}}
        params := '{first_name}|' || dt || '|' || r.city; aud := array['interested','negotiation'];
      elsif d = 1 then tpl := 'fa3b5e44-4dad-4ece-bc99-1a4251a1e1fa';    -- gac_last_call: registrations for {{2}} close soon
        params := '{first_name}|the ' || r.city || ' batch starting ' || dt; aud := array['followup','interested','negotiation'];
      end if;
    else
      if d = 7 then tpl := 'cd662146-7322-4924-bc09-dba6061eb614';       -- gaa_seat
        params := '{first_name}'; aud := array['contacted','followup','interested','negotiation'];
      elsif d = 3 then tpl := 'b7249bbf-4d53-4d93-ac76-dd40cf2cfa5a';    -- gaa_reminder (last reminder)
        params := '{first_name}'; aud := array['followup','interested','negotiation'];
      end if;
    end if;
    if tpl is null or r.sent ? k or not r.seq_active then continue; end if;

    if not p_dry then
      update public.nurture_sequences set steps = jsonb_build_array(jsonb_build_object('day', 0, 'params', params, 'template_id', tpl))
       where id = r.sequence_id;
    end if;
    n := 0;
    for lid in select l.id from public.leads l
                where l.campaign_id = r.campaign_id and l.stage = any(aud)
                  and not coalesce(l.dnd, false) and not coalesce(l.contact_only, false)
                  and greatest(l.created_at, coalesce(l.last_enquiry_at, l.created_at)) > now() - interval '90 days'
                  and not exists (select 1 from public.wa_messages w where w.lead_id = l.id and w.direction = 'out' and w.created_at > now() - interval '20 hours') loop
      if not p_dry then perform public.auto_msg_enroll(lid, r.sequence_id, interval '20 hours'); end if;
      n := n + 1;
    end loop;
    if not p_dry then
      update public.batch_countdown set sent = sent || jsonb_build_object(k, jsonb_build_object('at', now(), 'leads', n)) where campaign_id = r.campaign_id;
    end if;
    out := out || jsonb_build_object('city', r.city, 'batch', b.title, 'starts', b.starts, 'days_before', d, 'leads', n);
  end loop;
  return out;
end $$;
revoke execute on function public.batch_countdown_run(boolean) from anon, authenticated, public;

-- Chennai campaign dates corrected to the calendar (owner, 19 Nov 2026)
update public.campaigns set details = jsonb_set(details, '{dates}', '"27th Nov to 30th Nov 2026"')
 where name = 'Gold Appraisal Training - Chennai';
