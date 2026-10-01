# Working on Dialbook Pro

## Shipping changes
- The owner wants code changes shipped without asking: commit to your working branch, open a pull request into `main`, and merge it yourself. Pushing to `main` rebuilds the website and Android app via `.github/workflows/build.yml` (GitHub Pages: https://ggfacademy.github.io/dialbook/).
- After merging, check that the "Build app and website" run on `main` succeeded.
- Some steps can't be done from GitHub and must be handed to the owner with exact clicks: SQL in the Supabase SQL editor, redeploying Supabase Edge Functions (`supabase/functions/*`, pasted by hand in the dashboard), and anything in Meta, Interakt or Bolna. Say which of these a change needs.

## Live setup
- Supabase project: `yyrovakknsuanlolrlth`. Edge functions: ai, ai-webhook, whatsapp, whatsapp-webhook, leadsources, leads-webhook ("Verify JWT" off for all; each checks auth itself).
- WhatsApp goes through Interakt, configured as the "Other WhatsApp API" provider.
- Facebook lead ads: Pages Gold Appraisal Training and Skilldevelopmenttraining.
