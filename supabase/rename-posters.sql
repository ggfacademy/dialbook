-- Dialbook Pro – one-time: the GAC poster images lost "-oct26" from their names
-- (web/media/09-1-msme-gac-chn.png, 09-msme-gac-chn.png, 10-msme-gac-vjw.png, 11-msme-gac-hyd.png).
-- Run once in Supabase → SQL Editor after the website has rebuilt. Safe to run again.
-- It points WhatsApp template headers, nurture steps, settings and campaign details at the new names.
-- Old messages already sent are left as they are.

update public.wa_templates
   set header_url = regexp_replace(header_url, '(09-1-msme-gac-chn|09-msme-gac-chn|10-msme-gac-vjw|11-msme-gac-hyd)-oct26\.png', '\1.png', 'g')
 where header_url ~ '(09-1-msme-gac-chn|09-msme-gac-chn|10-msme-gac-vjw|11-msme-gac-hyd)-oct26\.png';

update public.nurture_sequences
   set steps = regexp_replace(steps::text, '(09-1-msme-gac-chn|09-msme-gac-chn|10-msme-gac-vjw|11-msme-gac-hyd)-oct26\.png', '\1.png', 'g')::jsonb
 where steps::text ~ '(09-1-msme-gac-chn|09-msme-gac-chn|10-msme-gac-vjw|11-msme-gac-hyd)-oct26\.png';

update public.settings
   set data = regexp_replace(data::text, '(09-1-msme-gac-chn|09-msme-gac-chn|10-msme-gac-vjw|11-msme-gac-hyd)-oct26\.png', '\1.png', 'g')::jsonb
 where data::text ~ '(09-1-msme-gac-chn|09-msme-gac-chn|10-msme-gac-vjw|11-msme-gac-hyd)-oct26\.png';

update public.campaigns
   set details = regexp_replace(details::text, '(09-1-msme-gac-chn|09-msme-gac-chn|10-msme-gac-vjw|11-msme-gac-hyd)-oct26\.png', '\1.png', 'g')::jsonb
 where details::text ~ '(09-1-msme-gac-chn|09-msme-gac-chn|10-msme-gac-vjw|11-msme-gac-hyd)-oct26\.png';

-- What now uses the posters (should list only the new names):
select 'template' as used_in, name as item, header_url as link from public.wa_templates where header_url ~ 'msme-gac-'
union all
select 'nurture step', s.name, st->>'header_url' from public.nurture_sequences s, jsonb_array_elements(s.steps) st where st->>'header_url' ~ 'msme-gac-';
