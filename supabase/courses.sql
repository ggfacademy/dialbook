-- Dialbook Pro – course details for each campaign (course name, fee, duration, timing, dates, venue).
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- A campaign is one course in one city, e.g. "Gold Audit and Appraisal – Mumbai". Its course details are
-- filled into call scripts, quick messages, WhatsApp nurture templates and AI calls as
-- {course}, {fee}, {duration}, {timing}, {dates} and {venue}. Edit them in Campaigns → Edit.

alter table public.campaigns add column if not exists details jsonb not null default '{}'::jsonb;

-- Existing Gold Appraisal (GAC) campaigns (GAC, Gold Appraisal or a GAC city in the name): fill in what is the same
-- everywhere, only where nothing is set yet. Check them in Campaigns afterwards.
update public.campaigns
   set details = jsonb_build_object('course', 'Gold Appraisal', 'fee', 'Rs. 15,000 including GST', 'duration', '4 days')
 where details = '{}'::jsonb and name !~* 'audit'
   and (name ~* '\mgac\M' or name ~* 'gold\s*apprais' or name ~* 'chennai|vijayawada|hyderabad|\m(chn|vjw|hyd)\M');

update public.campaigns
   set details = details || jsonb_build_object('venue', 'Vijayawada Chamber of Commerce & Industry, P.B.No. 561, Chamber Road, Gandhinagar, Vijayawada - 520 003')
 where details->>'course' = 'Gold Appraisal' and coalesce(details->>'venue', '') = '' and name ~* 'vijayawada|\mvjw\M';

update public.campaigns
   set details = details || jsonb_build_object('venue', 'The Federation of Telangana Chambers of Commerce and Industry - Federation House, 11-6-841, Red Hills, Hyderabad 500004')
 where details->>'course' = 'Gold Appraisal' and coalesce(details->>'venue', '') = '' and name ~* 'hyderabad|\mhyd\M';

-- New course: Gold Audit and Appraisal (2 full days, 11 am to 5 pm, Rs. 25,000), first batch in Mumbai.
-- Add the venue and dates in Campaigns → Edit when they are fixed. For another city, copy this campaign's
-- details into a new campaign, e.g. "Gold Audit and Appraisal – Delhi".
insert into public.campaigns (name, description, language, details)
select 'Gold Audit and Appraisal – Mumbai', '2-day Gold Audit and Appraisal training, Mumbai', '',
       jsonb_build_object('course', 'Gold Audit and Appraisal', 'fee', 'Rs. 25,000', 'duration', '2 full days', 'timing', '11 am to 5 pm')
 where not exists (select 1 from public.campaigns where name ilike 'gold audit%mumbai%');

notify pgrst, 'reload schema';
