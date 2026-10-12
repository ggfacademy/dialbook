-- Dialbook Pro – automatic WhatsApp after a call that did not connect, and when a lead moves to a stage
-- (for example "Payment pending" → payment details). Run once in Supabase → SQL Editor, after
-- nurture.sql and contacts.sql. Safe to run again.
--
-- You choose the messages in Settings → Nurture sequences → "Automatic messages": each is a nurture
-- sequence (make it with "New lead joins automatically" OFF, so only these events use it). The messages
-- go out within about 2 minutes, in sending hours, from the sequence's WhatsApp number.
-- A lead gets the same automatic message at most once in 2 days.
-- Stage messages can be set per program (campaign), e.g. a different payment QR for each city.
-- Moving a lead to a stage that has a message also puts a call in the owner's follow-ups for tomorrow 11 am.

create or replace function public.auto_msg_enroll(p_lead uuid, p_seq uuid, p_gap interval default interval '2 days')
returns void language plpgsql security definer set search_path = public as $$
declare l public.leads; e public.nurture_enrollments;
begin
  if p_seq is null then return; end if;
  select * into l from public.leads where id = p_lead;
  if not found or l.dnd or coalesce(l.contact_only, false) or l.stage in ('won','lost') then return; end if;
  if not exists (select 1 from public.nurture_sequences s where s.id = p_seq and s.active) then return; end if;
  select * into e from public.nurture_enrollments where sequence_id = p_seq and lead_id = p_lead;
  if found then
    if e.status = 'active' and e.step = 0 then return; end if;                 -- already waiting to send
    if e.last_sent_at is not null and e.last_sent_at > now() - p_gap then return; end if;
    update public.nurture_enrollments
       set status = 'active', step = 0, attempts = 0, last_error = null, stop_reason = null,
           enrolled_at = now(), next_at = now()
     where id = e.id;
  else
    insert into public.nurture_enrollments(sequence_id, lead_id, next_at) values (p_seq, p_lead, now())
    on conflict (sequence_id, lead_id) do nothing;
  end if;
end $$;
revoke execute on function public.auto_msg_enroll(uuid, uuid, interval) from anon, authenticated, public;

-- After a call whose outcome is "not connected" (Did not pick, Busy, Switched off …)
create or replace function public.calls_auto_msg() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; seq uuid; conn boolean;
begin
  if new.outcome is null or new.outcome = '' or (tg_op = 'UPDATE' and new.outcome is not distinct from old.outcome) then return new; end if;
  select data into cfg from public.settings where id = 1;
  seq := nullif(cfg->'autoMsg'->>'missed', '')::uuid;
  if seq is null then return new; end if;
  select coalesce((d->>'connected')::boolean, false) into conn
    from jsonb_array_elements(coalesce(cfg->'dispositions', '[]'::jsonb)) d where d->>'id' = new.outcome limit 1;
  if conn is distinct from false then return new; end if;            -- connected (or unknown outcome): no message
  if new.outcome = 'wrong' or new.outcome = 'dnd' then return new; end if;
  perform public.auto_msg_enroll(new.lead_id, seq);
  return new;
exception when others then
  raise warning 'calls_auto_msg: %', sqlerrm;   -- never block saving a call
  return new;
end $$;
drop trigger if exists calls_auto_msg on public.calls;
create trigger calls_auto_msg after insert or update of outcome on public.calls
  for each row execute function public.calls_auto_msg();

-- When a lead moves to a stage that has a message (e.g. Payment pending → payment details)
create or replace function public.leads_stage_auto_msg() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; seq uuid; tmr timestamptz;
begin
  if new.stage is not distinct from old.stage then return new; end if;
  select data into cfg from public.settings where id = 1;
  -- the program's own message for this stage (e.g. its payment QR) first, then the general one
  seq := coalesce(nullif(cfg->'autoMsg'->'campStages'->(new.campaign_id::text)->>new.stage, '')::uuid,
                  nullif(cfg->'autoMsg'->'stages'->>new.stage, '')::uuid);
  if seq is null then return new; end if;
  perform public.auto_msg_enroll(new.id, seq, interval '1 day');
  -- remind the owner to follow up tomorrow at 11 am (India time) if nothing earlier is planned
  tmr := (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day 11 hours') at time zone 'Asia/Kolkata';
  if new.next_follow_up_at is null or new.next_follow_up_at < now() then
    update public.leads set next_follow_up_at = tmr where id = new.id;
  end if;
  return new;
exception when others then
  raise warning 'leads_stage_auto_msg: %', sqlerrm;
  return new;
end $$;
drop trigger if exists leads_stage_auto_msg on public.leads;
create trigger leads_stage_auto_msg after update of stage on public.leads
  for each row execute function public.leads_stage_auto_msg();

notify pgrst, 'reload schema';
