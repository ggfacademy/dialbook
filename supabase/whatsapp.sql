-- =====================================================================
-- Dialbook Pro – WhatsApp add-on
-- Run this AFTER schema.sql: Supabase → SQL Editor → New query → paste → Run.
-- Safe to run again.
-- =====================================================================

-- Connected WhatsApp numbers. Provider:
--   meta   = WhatsApp Business Cloud API (Meta, official)
--   twilio = Twilio WhatsApp
--   custom = any other WhatsApp API provider, set up with a URL and a message format
--   qr     = a person's own WhatsApp, linked by scanning a QR code (through the WhatsApp gateway)
create table if not exists public.wa_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text not null check (provider in ('meta','twilio','custom','qr')),
  owner_id uuid references public.profiles(id) on delete cascade,
  shared boolean not null default true,
  phone text not null default '',
  status text not null default 'setup',
  config jsonb not null default '{}'::jsonb,
  webhook_token text not null default encode(gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- API keys and tokens. No one can read these from the website; only the server functions can.
create table if not exists public.wa_secrets (
  account_id uuid primary key references public.wa_accounts(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
);

-- The WhatsApp gateway used for "own WhatsApp by QR" (address + key). Server-only.
create table if not exists public.wa_gateway (
  id int primary key default 1 check (id = 1),
  url text not null default '',
  api_key text not null default ''
);

-- Approved message templates
create table if not exists public.wa_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wa_accounts(id) on delete cascade,
  name text not null,
  language text not null default 'en',
  category text not null default '',
  status text not null default 'APPROVED',
  body text not null default '',
  params int not null default 0,
  external_id text not null default '',
  updated_at timestamptz not null default now(),
  unique (account_id, name, language)
);

-- Every WhatsApp message sent or received, linked to the lead
create table if not exists public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.wa_accounts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete cascade,
  phone_key text not null default '',
  direction text not null check (direction in ('in','out')),
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null default '',
  template_name text,
  media_type text,
  status text not null default 'sent',
  error text,
  provider_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists wa_messages_provider on public.wa_messages(account_id, provider_id) where provider_id is not null;
create index if not exists wa_messages_lead on public.wa_messages(lead_id, created_at desc);
create index if not exists wa_messages_created on public.wa_messages(created_at desc);
create index if not exists wa_messages_unread on public.wa_messages(lead_id) where direction = 'in' and read_at is null;

-- ---------------------------------------------------------------------
-- Access rules
--   Admins and managers see every chat of every employee.
--   Telecallers see chats with their own leads and messages they sent.
-- ---------------------------------------------------------------------
alter table public.wa_accounts  enable row level security;
alter table public.wa_secrets   enable row level security;
alter table public.wa_gateway   enable row level security;
alter table public.wa_templates enable row level security;
alter table public.wa_messages  enable row level security;

drop policy if exists wa_acc_sel on public.wa_accounts;
create policy wa_acc_sel on public.wa_accounts for select to authenticated
  using (public.is_active() and (shared or owner_id = auth.uid() or public.is_mgr()));

drop policy if exists wa_tpl_sel on public.wa_templates;
create policy wa_tpl_sel on public.wa_templates for select to authenticated using (public.is_active());
drop policy if exists wa_tpl_all on public.wa_templates;
create policy wa_tpl_all on public.wa_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists wa_msg_sel on public.wa_messages;
create policy wa_msg_sel on public.wa_messages for select to authenticated using (
  public.is_mgr() or (public.is_active() and (sender_id = auth.uid()
    or exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()))));
drop policy if exists wa_msg_upd on public.wa_messages;
create policy wa_msg_upd on public.wa_messages for update to authenticated using (
  public.is_mgr() or (public.is_active() and exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid())));

-- The website never touches secrets or the gateway table directly.
revoke all on public.wa_secrets from anon, authenticated;
revoke all on public.wa_gateway from anon, authenticated;
grant select on public.wa_accounts, public.wa_templates, public.wa_messages to authenticated;
grant insert, update, delete on public.wa_templates to authenticated;
grant update (read_at) on public.wa_messages to authenticated;

-- ---------------------------------------------------------------------
-- Conversations list: newest message per lead, with unread counts
-- ---------------------------------------------------------------------
create or replace function public.wa_conversations(
  p_agent uuid default null, p_account uuid default null, p_unread boolean default false,
  p_search text default '', p_limit int default 100)
returns table (lead_id uuid, lead_name text, phone text, assigned_to uuid, last_body text, last_dir text,
               last_at timestamptz, last_sender uuid, last_account uuid, unread int, last_in_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare mgr boolean := public.is_mgr();
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  return query
  with m as (
    select w.* from public.wa_messages w
      join public.leads l on l.id = w.lead_id
     where (mgr or l.assigned_to = auth.uid() or w.sender_id = auth.uid())
       and (p_account is null or w.account_id = p_account)
       and (p_agent is null or l.assigned_to = p_agent or w.sender_id = p_agent)
  ), last as (
    select distinct on (m.lead_id) m.* from m order by m.lead_id, m.created_at desc
  )
  select l.id, l.name, l.phone, l.assigned_to, last.body, last.direction, last.created_at, last.sender_id, last.account_id,
         (select count(*)::int from m where m.lead_id = l.id and m.direction = 'in' and m.read_at is null),
         (select max(m.created_at) from m where m.lead_id = l.id and m.direction = 'in')
    from last join public.leads l on l.id = last.lead_id
   where (not p_unread or exists (select 1 from m where m.lead_id = l.id and m.direction = 'in' and m.read_at is null))
     and (coalesce(p_search,'') = '' or l.name ilike '%' || p_search || '%' or l.phone_key like '%' || regexp_replace(p_search,'\D','','g') || '%')
   order by last.created_at desc
   limit greatest(1, least(p_limit, 500));
end $$;

create or replace function public.wa_mark_read(p_lead uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_mgr() or exists (select 1 from public.leads where id = p_lead and assigned_to = auth.uid())) then return; end if;
  update public.wa_messages set read_at = now() where lead_id = p_lead and direction = 'in' and read_at is null;
end $$;

create or replace function public.wa_unread_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.wa_messages w join public.leads l on l.id = w.lead_id
   where w.direction = 'in' and w.read_at is null
     and (public.is_mgr() or l.assigned_to = auth.uid())
$$;

grant execute on function public.wa_conversations(uuid, uuid, boolean, text, int) to authenticated;
grant execute on function public.wa_mark_read(uuid) to authenticated;
grant execute on function public.wa_unread_count() to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.wa_messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.wa_accounts; exception when others then null; end;
end $$;
