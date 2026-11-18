-- Dialbook Pro – 18 Nov 2026: the course posters in web/media were replaced with new files and the old ones deleted:
--   09-1-msme-gac-chn.png / 09-msme-gac-chn.png → msme-gac-chn.png
--   10-msme-gac-vjw.png                         → msme-gac-vjw.png
--   11-msme-gac-hyd.png                         → msme-gac-hyd.png
--   11-msme-gaa-mum.png                         → msme-gaa-mumbai.png
-- (also new: msme-gac-mysuru.png and qr-<city>-payment.png for Chennai, Vijayawada, Hyderabad, Mumbai, Mysuru)
-- This points WhatsApp template images at the new files. Already applied to the live database; safe to run again.

update public.wa_templates set header_url = case
   when header_url ~ '/(09-1-msme-gac-chn|09-msme-gac-chn)(-oct26)?\.png$' then 'https://ggfacademy.github.io/dialbook/media/msme-gac-chn.png'
   when header_url ~ '/10-msme-gac-vjw(-oct26)?\.png$' then 'https://ggfacademy.github.io/dialbook/media/msme-gac-vjw.png'
   when header_url ~ '/11-msme-gac-hyd(-oct26)?\.png$' then 'https://ggfacademy.github.io/dialbook/media/msme-gac-hyd.png'
   when header_url ~ '/11-msme-gaa-mum(-oct26)?\.png$' then 'https://ggfacademy.github.io/dialbook/media/msme-gaa-mumbai.png' end
 where header_url ~ '/(09-1-msme-gac-chn|09-msme-gac-chn|10-msme-gac-vjw|11-msme-gac-hyd|11-msme-gaa-mum)(-oct26)?\.png$';
