# Dialbook Pro – setup guide

Dialbook Pro has three parts that work together:

| Part | What it does | Where it runs |
|---|---|---|
| **CRM website** | Leads, calling mode, follow-ups, pipeline, campaigns, team, reports, AI calling, settings | Free on GitHub Pages |
| **Android app** | Logs every call with a lead on its own (real duration), uploads the phone's call recording, asks the caller for the outcome | Each telecaller's Android phone |
| **Cloud database** | Stores leads, calls, recordings. No lead limit. | Supabase (free to start) |

The **AI calling agent** uses Bolna (bolna.ai), an Indian voice-AI service that speaks Hindi, English and other Indian languages and works with Exotel and Plivo numbers.

Plan about 1–2 hours for the whole setup. You do not need to write code. If you have someone technical nearby, this guide is also enough for them to do it for you.

---

## What it costs

| Service | Free plan | When you would pay |
|---|---|---|
| Supabase | 500 MB database (roughly 200,000–500,000 leads with their call history) and 1 GB of recordings | Pro plan, about US$25/month: 8 GB database and 100 GB storage. Needed once you keep many call recordings. |
| GitHub | Free for a public repository | Not needed |
| Bolna (AI calls) | Trial credit | Per minute of AI calling, plus your phone number provider's charges. Check bolna.ai for current prices. |
| Anthropic API (optional) | – | Small cost per AI summary. Only needed for "Suggest next step" and smarter AI call outcomes. |

Prices change. Check each website before you commit.

---

## Step 1 – Create the database (Supabase)

1. Go to **supabase.com** and sign up (you can sign in with Google or GitHub).
2. Click **New project**. Name it `dialbook`. Choose a strong database password and save it somewhere safe. For **Region**, pick **Mumbai (ap-south-1)**. Click **Create**. Wait about 2 minutes.
3. In the left menu, open **SQL Editor** → **New query**.
4. Open the file `supabase/schema.sql` from this package, copy **everything**, paste it into the editor, and click **Run**. You should see "Success".
5. Open **Authentication** → **Sign In / Providers** (or **Providers** → **Email**). Turn **off** "Confirm email" so your team can sign in straight away. (You can leave it on; then each person must click the link in their email first.)
6. Open **Project Settings** → **API** (sometimes called **Data API** / **API Keys**). Keep this page open. You need two values:
   - **Project URL**, for example `https://abcdefgh.supabase.co`
   - **anon public** key, a long text starting with `eyJ…` (or `sb_publishable_…` on newer projects)

---

## Step 2 – Put the website and app on GitHub

1. Go to **github.com** and create a free account if you don't have one.
2. Click **+** → **New repository**. Name it `dialbook`. Choose **Public** (GitHub Pages is free only for public repositories; your data stays safe in Supabase, not on GitHub). Click **Create repository**.
3. On the new repository page, click **uploading an existing file**. Unzip this package on your computer and drag **all of its folders and files** (`android`, `supabase`, `web`, `.github`, `README.md`) into the page. Click **Commit changes**.
   - The `.github` folder is hidden on some computers. On Mac press `Cmd + Shift + .` in Finder to show it; on Windows tick **View → Hidden items**. It must be uploaded, because it tells GitHub how to build the app.
   - If `.github` did not upload: click **Add file → Create new file**, type the name `.github/workflows/build.yml` (the slashes create the folders), paste the contents of that file from this package, and click **Commit changes**.
4. In the repository, open the `web` folder → `config.js` → click the ✏️ pencil icon. Replace the two values with your **Project URL** and **anon public key** from Step 1. Click **Commit changes**.
5. Open **Settings** → **Pages**. Under **Source**, choose **GitHub Actions**.
6. Open the **Actions** tab. You'll see "Build app and website" running (if not, click it and press **Run workflow**). It takes about 5–8 minutes. A green tick means it worked.
7. Back in **Settings** → **Pages**, you'll see your website address, for example `https://yourname.github.io/dialbook/`. This is your CRM.

Every time you change a file on GitHub, the website and the app are rebuilt automatically.

---

## Step 3 – Create your admin account

1. Open your CRM website address.
2. Click **Create account**. Enter your name, email and a password.
3. The **first account becomes the admin** automatically. You're in.
4. Open **Settings** and set your company name, call outcomes, stages and WhatsApp templates. Click **Save changes**.

## Step 4 – Add your team

1. Send your website address to each telecaller and manager.
2. They click **Create account** with their own email and password. They'll see "Waiting for approval".
3. You open **Team**. Under **Waiting for approval**, pick their role and click **Approve**:
   - **Telecaller** – sees only their own leads
   - **Manager** – sees all leads, team and reports
   - **Admin** – also approves people and changes settings

## Step 5 – Import leads

**Leads** → **Import** → choose your Excel or CSV file → match the columns → choose **Share equally among telecallers** → **Import leads**. Duplicate numbers are skipped automatically. There is no limit on the number of leads.

---

## Step 6 – Install the phone app (automatic call logging and recordings)

Do this on each telecaller's **Android** phone. (iPhones do not allow apps to read the call history, so automatic logging is Android-only. iPhone users can still use the website and log calls by hand.)

1. **Turn on call recording in the phone's own dialer.** Open the Phone app → ⋮ menu → **Settings** → **Call recording** (Samsung: **Record calls** → **Auto record calls** → **All calls**; Xiaomi/Redmi/Poco, OnePlus, Oppo, Realme and Vivo have a similar switch). Recording rules differ by phone and country. Tell your customers that calls may be recorded.
2. On the phone, open your CRM website → **Settings** → **Download Android app**. Open the downloaded file. If the phone asks, allow **Install unknown apps** for your browser. Then tap **Install**.
   - If Play Protect warns you, tap **More details → Install anyway**. This happens because the app is installed from your own website, not the Play Store.
3. Open **Dialbook** on the phone. It asks for a **connection code**. On the website, go to **Settings → Phone app → Copy connection code**, send it to the phone (for example on WhatsApp), and paste it in.
4. Sign in with the same email and password as the website.
5. Allow each permission the app asks for:
   - **Phone and call history** (required)
   - **Notifications**
   - **Call recordings** (Music and audio)
   - **All files access** (recommended; some phones keep recordings where the normal permission can't see)
   - **Run in the background** (so calls are logged even when the app is closed)
6. Make a test call to one of your leads. Within a minute of hanging up:
   - a notification asks for the call outcome
   - the call appears on the lead in the website with its real duration and a **Phone app** label
   - if the phone recorded the call, a **Play recording** button appears

**Privacy:** the app only sends calls with numbers that are already leads (or, if you keep that setting on, unknown numbers that call in). Personal calls are never uploaded. You can turn off adding unknown incoming callers in **Settings**.

If recordings don't appear: open the app → **Status** and check "Can read recordings". Make sure the phone's dialer is really saving recordings. You can also type the phone's recording folder under **Status → Extra folder**. Some phones (for example Google Pixel and Motorola, which use the Google Phone app) keep recordings where other apps can't reach them. On those phones, calls are still logged but recordings can't be uploaded.

---

## Step 7 – Turn on AI calling (optional)

### 7a. Create the AI agent in Bolna
1. Sign up at **bolna.ai**.
2. Create an **agent**. In its prompt, describe your business and what the call should achieve. You can use these variables, which Dialbook fills in for each lead: `{first_name}`, `{lead_name}`, `{city}`, `{company_name}`, `{campaign}`, `{notes}`.
   Example opening: *"Namaste {first_name}, main {company_name} se bol rahi hoon. Aapne home loan ke baare mein enquiry ki thi…"*
3. Connect a phone number in Bolna (Exotel or Plivo work well in India), or use Bolna's default numbers while you test.
4. Copy the **agent ID** and create an **API key** in Bolna.

### 7b. Add the AI functions to Supabase
1. In Supabase, open **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `ai`. Delete the sample code, paste everything from `supabase/functions/ai/index.ts`, and click **Deploy**.
3. Create a second function named exactly `ai-webhook` with the code from `supabase/functions/ai-webhook/index.ts`. After deploying, open its **Details** (or settings) and turn **off** "Enforce JWT verification" / "Verify JWT". This lets Bolna send results back to it.
4. Open **Edge Functions** → **Secrets** (or **Manage secrets**) and add:
   - `BOLNA_API_KEY` = your Bolna API key
   - `WEBHOOK_SECRET` = any long random text you make up, for example `dialbook-7f3k29x-secret`
   - `ANTHROPIC_API_KEY` = your Anthropic API key (optional, from console.anthropic.com). Turns on **Suggest next step** and lets AI read each AI-call transcript to pick the right outcome and follow-up.
5. In Bolna, open your agent's settings and set the **Webhook URL** to
   `https://YOUR-PROJECT.supabase.co/functions/v1/ai-webhook?token=YOUR-WEBHOOK_SECRET`
   using your project URL and the same secret text.

### 7c. Switch it on in the CRM
0. **Calling in Tamil, Telugu, Kannada and other languages:** create one Bolna agent per language (ready-made prompts and recommended voice settings are in `ai-agents/REGIONAL-AGENTS.md`). Paste each agent ID next to its language in **Settings → AI calling → Agent for each language**. Each lead is then called in its own language automatically.
1. **Settings → AI calling**: paste the **agent ID**, and optionally your caller ID number. Set calling hours (the default is 10:00–19:00 IST). Click **Save changes**.
2. Open **AI calling**, choose a campaign and which leads to call (new leads, follow-ups due, or any open lead), set how many, and click **Start AI calls**.
3. Results appear in **AI calling** and on each lead: status, outcome, AI summary, transcript and recording. The lead's stage and follow-up update automatically.

You can also start an AI call from any lead (**AI call** button) or for selected leads in **Leads** (**AI call these**). Each campaign can have its own Bolna agent (Campaigns → Edit → AI agent ID).

**Rules for automated calls in India:** only call people who have agreed to hear from you. Respect the DND registry and TRAI rules on commercial calls and calling hours. Mark leads who ask not to be called as **Do not call**; AI calls always skip them. This is general information, not legal advice. Check the current rules for your business.

---

## Step 8 – WhatsApp (team inbox, approved templates, your own WhatsApp by QR)

Dialbook has a **WhatsApp** page: a shared inbox where every chat with a lead is saved. **Admins and managers see every employee's chats** and can filter by employee. Telecallers see chats with their own leads. Replies go to the lead's owner, and each message shows who sent it and from which number.

You can connect any mix of these:

| Option | Best for | Cost | Notes |
|---|---|---|---|
| **A. WhatsApp Business API (Meta, official)** | Company number, approved templates, campaigns | Meta charges per template message; replies within 24 hours are free or cheap. Check Meta's current rates. | No ban risk when you follow Meta's rules. Needs a verified Meta Business account. |
| **B. Twilio WhatsApp** | If you already use Twilio | Twilio fee + Meta fee | Same official platform, through Twilio. |
| **C. Any other WhatsApp API** (Interakt, AiSensy, Gupshup, WATI, 360dialog…) | If you already pay a WhatsApp provider | Your provider's plan | You fill in a short form copied from your provider's API page. |
| **D. Own WhatsApp by QR code** | Each telecaller's own WhatsApp or WhatsApp Business app | A small server, about ₹400–1,000/month | Unofficial, like WhatsApp Web. See the warning below. |

### 8a. Install the WhatsApp add-on (once)
1. Supabase → **SQL Editor** → **New query** → paste everything from `supabase/whatsapp.sql` → **Run**.
2. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**:
   - Name `whatsapp`, paste `supabase/functions/whatsapp/index.ts`, **Deploy**. Leave "Verify JWT" **on**.
   - Name `whatsapp-webhook`, paste `supabase/functions/whatsapp-webhook/index.ts`, **Deploy**. Then turn "Verify JWT" **off** for this one.
3. There are no secret keys to add in Supabase for WhatsApp. You type each provider's key into the CRM, and it is stored where only the server can read it.

### 8b. Option A – WhatsApp Business API (Meta)
1. Verify your business in **Meta Business Suite** (business.facebook.com → Settings → Business info).
2. Go to **developers.facebook.com** → **My Apps** → **Create app** → type **Business** → add the **WhatsApp** product.
3. In **WhatsApp → API setup**, add your business phone number. It must not be active in the normal WhatsApp app at the same time. Note the **Phone number ID** and the **WhatsApp Business Account ID**.
4. Create a permanent token: **Business settings → Users → System users → Add** (admin) → **Generate new token** for your app with the permissions `whatsapp_business_messaging` and `whatsapp_business_management`. Copy the token.
5. In Dialbook: **Settings → WhatsApp → Connect a number → WhatsApp Business API (Meta)**. Paste the Phone number ID, Business Account ID and token → **Save and connect**.
6. Dialbook then shows a **Callback URL** and a **Verify token**. In Meta: your app → **WhatsApp → Configuration → Webhook → Edit**, paste both, press **Verify and save**, then **subscribe to `messages`**.
7. Create message templates in **WhatsApp Manager → Message templates**. After Meta approves them, press **Templates → Sync templates** in Dialbook.

**WhatsApp's 24-hour rule:** you can send normal messages only within 24 hours of the customer's last message. To start or restart a chat, you must use an approved template. Dialbook shows this and switches to templates automatically.

### 8c. Option B – Twilio
Settings → WhatsApp → Connect a number → **Twilio**. Enter your Account SID, Auth token and WhatsApp sender number. Copy the webhook URL Dialbook shows into Twilio Console → your WhatsApp sender → **"When a message comes in"**. Press **Sync templates** to fetch your approved Content Templates.

### 8d. Option C – Any other WhatsApp API provider
Settings → WhatsApp → Connect a number → **Other WhatsApp API**. Open your provider's API page and copy its "send message" example into the form:

- **Send message URL** – for example `https://api.yourprovider.com/v1/messages`
- **API key / token** – your key. In the headers, write `{{secret.token}}` where the key goes, for example `{"Authorization":"Bearer {{secret.token}}"}`
- **Text message body** – the JSON they expect, with these placeholders: `{{to_digits}}` (919876543210), `{{to}}` (+919876543210), `{{to_local}}` (9876543210), `{{text}}`
- **Template message body** – the same, with `{{template}}`, `{{language}}`, `{{param1}}`, `{{param2}}`… or `{{params_json}}` for a list
- **Where the message ID is in the answer** – for example `data.id`
- **Incoming messages** – where the provider puts the sender number, text and message ID in its webhook. Then set the webhook URL Dialbook shows in your provider's dashboard.

Add your approved templates under **Templates** (name, language, text with {{1}}, {{2}}…). If a template has an image, video or PDF header, pick it under **Header** and give a public https link to the file (for example, upload it to the `web/media` folder of this repository and use `https://YOUR-NAME.github.io/dialbook/media/FILE`). Put `"headerValues":{{header_values_json}}` in the template message body for providers such as Interakt. Approved buttons are sent automatically.

If you're not sure what to type, send me (or your provider's support) their API page and I'll fill the form in for you.

### 8f. Nurture sequences (automatic WhatsApp follow-ups)
Send approved templates automatically over the days after a lead arrives, for example Day 0 brochure, Day 2 video, Day 5 reminder, Day 10 last call.
1. Supabase → **SQL Editor** → paste everything from `supabase/nurture.sql`. In the last block, replace `YOUR-PROJECT` with your project reference → **Run**. This creates the tables and a schedule that runs every 15 minutes.
2. Redeploy the `whatsapp` function, with "Verify JWT" **off**.
3. In the CRM: **Settings → Nurture sequences** → **Edit** the "Default follow-up" sequence (or **New sequence**). Pick the WhatsApp number, the program (or any program), the lead language (or any language), the lead city (or any city), the venue address (use it as `{address}`), a template for each step and the values for {{1}}, {{2}}… (`{first_name}`, `{program}`, `{city}`, `{address}`, `{company}`, `{agent}`). Tick **Sequence is on** → **Save**.
   For several languages, make one sequence per language (for example "Tamil follow-up" with the Tamil templates, "Telugu follow-up", and an "Any language" one in English). Each lead gets the most specific match: program first, then language, then city (from the lead's City field); a sequence with nothing set is the fallback.
4. New leads join automatically. Use **Add existing leads** for leads you already have, or **Start sequence** on a lead.

A lead's sequence stops when they reply on WhatsApp, are converted or lost, or are marked do not call. After the last step, the lead moves to today's follow-ups for a call. Messages go out between 9:00 and 20:00 IST; you can change the hours in Settings. Each lead page shows which step it is on, with a **Stop** button.

### 8e. Option D – Own WhatsApp by QR code
This links a normal WhatsApp or WhatsApp Business app, the same way WhatsApp Web does. It runs through **Evolution API**, a free, open-source WhatsApp gateway you host yourself.

> **Warning:** this is not an official WhatsApp API. WhatsApp can ban numbers that send bulk, automated or unwanted messages. Use it for one-to-one follow-ups with people who expect your message. For campaigns and bulk sending, use Option A. Only chats with numbers that are already leads are saved; personal chats and groups are ignored.

**Set up the gateway (once, by you or your IT person):**
1. Rent a small Linux server with Docker (1 GB RAM is enough to start), for example from DigitalOcean, Hostinger or AWS Lightsail.
2. Point a subdomain at it, for example `wa.yourcompany.com` (an "A record" in your domain settings).
3. Copy the `whatsapp-gateway` folder to the server. Copy `.env.example` to `.env`, fill in your domain and two long random passwords, then run `docker compose up -d`. HTTPS is set up automatically.
4. In Dialbook: **Settings → WhatsApp gateway**: enter `https://wa.yourcompany.com` and the `AUTHENTICATION_API_KEY` from `.env` → **Save gateway**.

**Each employee links their own WhatsApp:**
Settings → **My WhatsApp** → **Link my WhatsApp**. On the phone, open WhatsApp → **Linked devices** → **Link a device** and scan the code. Done. Messages they send from the CRM, and chats with leads on their phone, now appear in the WhatsApp inbox, and the admin can see them.

---

## Step 9 – Lead sources (Facebook Pages, Google Ads, websites) and language-based assignment

### 9a. Install (once)
1. Supabase → **SQL Editor** → paste everything from `supabase/leadsources.sql` → **Run**.
2. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**:
   - `leadsources` with `supabase/functions/leadsources/index.ts`. Keep "Verify JWT" **on**.
   - `leads-webhook` with `supabase/functions/leads-webhook/index.ts`. Turn "Verify JWT" **off**.

### 9b. Languages and automatic assignment
1. **Settings → Languages:** check the list (English, Hindi, Tamil, Telugu, Kannada, Malayalam… add or remove any). Save.
2. **Team → Edit** each telecaller and tick the languages they speak.
3. **Settings → Lead assignment:** switch on **Assign new leads automatically**. The first rule, "any language → telecallers who speak the lead's language", covers most teams. You can add more rules, checked from top to bottom, for example:
   - Language **Tamil** + source **Facebook – Chennai Homes** → **these people:** Priya, Kavya
   - Language **Kannada** → **these people:** Manju
   - Campaign **Home loans** → telecallers who speak the lead's language

   People in a rule take turns (round robin). **If no rule matches**, the lead is either shared among all telecallers or left unassigned for a manager.
4. Leads get their language from, in this order: a language question in the form (answers like "தமிழ்", "Tamil" or "ta" are all understood) → the form's or source's default language → the campaign's language → the Language column in an import → set by hand.
5. For leads already in the CRM: **Team → Assign unassigned by rules**, or select leads in **Leads → Assign by rules**. Filter leads by language in **Leads**.

### 9c. Facebook and Instagram lead ads (any number of Pages)
1. In **developers.facebook.com**, create an app of type **Business** (or use the one from WhatsApp). In **App settings → Basic**, copy the **App secret**.
2. In **business.facebook.com → Settings → Users → System users**, add an **Admin** system user. Assign it your **Pages** (full control) and your **ad account**. Then press **Generate new token**, pick the app, and tick `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`, `ads_management` and `business_management`. Copy the token.
3. In Dialbook: **Settings → Lead sources → Set up Facebook**. Paste the App secret and the token, then **Save**. Dialbook then shows a **Callback URL** and a **Verify token**.
4. In your app: **Webhooks** (or "Use cases → Webhooks") → pick **Page** → paste the Callback URL and the Verify token → **Verify and save** → subscribe to **leadgen**. Switch the app to **Live** mode.
5. In **Meta Business Suite → Settings → Integrations → Leads access**, make sure this app (the CRM) is allowed for each Page.
6. Back in Dialbook: **Add Pages** → tick every Page you want → **Add selected Pages**. Each Page gets its own row where you set a default language and campaign. Press **Forms** to give individual forms their own language or campaign.
7. Test it with Meta's **Lead Ads Testing Tool** (developers.facebook.com/tools/lead-ads-testing). The lead appears in Leads within seconds, already assigned. Press **Fetch last 7 days** on any Page to pull in leads from before the setup, or from a period when the connection was down. Duplicates are skipped.

### 9d. Google Ads lead forms
1. **Settings → Lead sources → Add a Google Ads lead form**. Give it a name, a default language (for example Telugu for a Hyderabad campaign) and a campaign.
2. Dialbook shows a **Webhook URL** and a **Key**. In Google Ads: **Campaigns → Assets → Lead forms** → open the form → **Export leads → Webhook integration** → paste both → **Send test data**. A test lead (tagged "Test lead") appears within seconds.
3. Add a question like "Preferred language" to the form if one campaign serves several languages.

### 9e. Website forms, IndiaMART, JustDial, Zapier and others
**Settings → Lead sources → Add a website or other source** gives you a private address that accepts new leads (POST, JSON or form data). Give it to your web developer, or use it in Zapier, Make or Pabbly ("Webhook → POST"), or in a WordPress form's webhook add-on. IndiaMART Push API leads are understood as they arrive.

**Repeat enquiries:** when someone who is already a lead fills another form, no duplicate is created. The existing lead gets a note ("Enquired again via …"), is reopened if it was Lost, and is marked for a call today.


### Old data as a contact list, and "Do not contact"
**Transferring leads.** Run `supabase/transfer.sql` once. On any lead (website or phone app) a telecaller can press **Transfer to a colleague**, pick who, and give a reason (e.g. “Telugu lead”). The lead moves to that person, shows up in their list right away, and every transfer is listed for admins in **Reports → Lead transfers** (with CSV).

**Personal calls.** Run `supabase/personal-calls.sql` once and have telecallers install the latest phone app. Only calls with numbers that are leads are saved and recorded. After a call with a number that is not in the CRM, the app asks **Add as lead** (the lead, this call and its recording are saved, and all later calls) or **Personal call, don't save** (nothing is saved, and it won't ask again for that number). Old “New caller” leads from personal calls can be removed with **This is a personal number** on the lead.

**Rejecting or removing team members, and resetting passwords.** Run `supabase/team.sql` once (run it again if you ran an older copy). Admins can set a new password for anyone in **Team → Edit → Set a new password**. After that, **Reject** / **Remove** in Team deletes the person's login too, so their email can sign up again, and anyone signed in without a team row shows up again under **Waiting for approval**.
.github/workflows/backup.yml         nightly backup to Dropbox (.github/backup.sh; setup page web/backup-setup.html)

**Contact list (old data for messages).** Run `supabase/contacts.sql` once in the SQL Editor. Then **Leads → Import → Assign to: “Don’t assign: contact list for messages only”**. These contacts are not given to telecallers and are left out of calling lists, share-outs, AI calling lists and automatic nurture. Find them with **Leads → status filter → Contact list**. Message them with a nurture sequence (**Add existing leads**) or export the filtered list for an Interakt campaign. When a contact enquires again through Facebook/Instagram/a form, or replies on WhatsApp, they become a normal new lead and are assigned by your rules. Giving one to a telecaller by hand does the same.

**Do not contact.** On a lead, tick **Do not contact**, or pick the call outcome **Asked not to be contacted**. The lead is then left out of calling lists, the phone app, AI calls, nurture and WhatsApp sending, also if they enquire again. Untick it only if the customer agrees to be contacted again.

## Backups (daily, to Dropbox)

Every night at 2:00 am India time, GitHub copies the CRM data into your Dropbox folder `/CRM` (on the PC: `F:\Dropbox\CRM`) as `dialbook-YYYY-MM-DD.zip`. Each zip has the main tables as CSV files for Excel (`csv/leads.csv`…), a full copy for restoring (`database.sql`, `logins.sql`) and a README. The last 30 days are kept. Call recordings are not included.

Set it up once:
1. Open `https://ggfacademy.github.io/dialbook/backup-setup.html` and follow it. At the end it gives two values, `DROPBOX_APP_KEY` and `DROPBOX_REFRESH_TOKEN`.
2. Supabase → **Connect** (top of the project) → **Session pooler** → copy the URI. Replace `[YOUR-PASSWORD]` with your database password (reset it in **Project Settings → Database** if needed; use only letters and numbers).
3. GitHub → this repository → **Settings → Secrets and variables → Actions → New repository secret**, three times: `SUPABASE_DB_URL` (the URI), `DROPBOX_APP_KEY`, `DROPBOX_REFRESH_TOKEN`.
4. **Actions → Daily backup to Dropbox → Run workflow** to test. A green tick means the zip is in Dropbox.

## Everyday use

**Training for telecallers:** a short video and step-by-step guide with screenshots is at `https://YOUR-NAME.github.io/dialbook/training/` (also linked from **Settings → Phone app**). Share the link with new telecallers.

- **Telecallers:** open the phone app → **My leads** → **Call**. After each call, tap the notification and pick the outcome. Overdue follow-ups are shown in red.
- **Managers:** **Dashboard** for today's numbers, **Reports** for any date range (download CSV), **Team** for per-person performance, **Leads → Share out leads** to distribute new leads.
- **WhatsApp:** press **WhatsApp** on a lead to chat. Unread replies show a green badge. Admins open **WhatsApp** and pick an employee to review their chats.
- **Recordings:** open any lead; calls with audio have a **Play recording** button (managers and the lead's owner can listen).

## Updating the app later

Edit any file on GitHub (or upload a new version). The **Actions** tab rebuilds the website and app automatically. To update phones, download the app again from Settings and install it over the old one. Your data is kept.

## Files in this package

```
supabase/schema.sql                  database tables, security rules and automation
supabase/functions/ai/index.ts       starts AI calls; "Suggest next step"
supabase/functions/ai-webhook/index.ts  receives AI call results from Bolna
supabase/search.sql                  lets the Leads search find courses (tags), notes and sources
supabase/contacts.sql                contact lists (old data) and do-not-contact blocking
supabase/team.sql                    Reject/Remove in Team also deletes the login, so the email can sign up again
supabase/personal-calls.sql          keeps telecallers' personal calls out of the CRM
supabase/transfer.sql                lets telecallers pass a lead to a colleague, with a reason
supabase/nurture.sql                 nurture sequences (automatic WhatsApp follow-ups) and their schedule
supabase/whatsapp.sql                WhatsApp tables and access rules
supabase/functions/whatsapp/         sends messages, templates, QR linking
supabase/functions/whatsapp-webhook/ receives WhatsApp replies and delivery updates
whatsapp-gateway/                    server files for QR linking (Evolution API)
supabase/leadsources.sql             languages, assignment rules, lead sources
supabase/functions/leadsources/      connects Facebook Pages, Google Ads and website sources
supabase/functions/leads-webhook/    receives new leads from all sources
ai-agents/REGIONAL-AGENTS.md         Tamil, Telugu, Kannada (and Hindi) AI agent prompts and settings
web/                                 the CRM website (index.html, app.js, config.js)
android/                             the Android app (Kotlin)
.github/workflows/build.yml          builds the app and publishes the website
```

## Troubleshooting

| Problem | What to do |
|---|---|
| Website says "Almost there" | `web/config.js` still has the placeholder values. Edit it on GitHub (Step 2.4). |
| "Waiting for approval" | An admin must approve the account in **Team**. |
| Actions build is red | Open the failed run to see the message. Most often the `.github` folder or the `android` folder was not uploaded completely. |
| App: "That code does not look right" | Copy the connection code again from **Settings → Phone app**. It must be copied in full. |
| Calls not appearing | In the app, open **Status** → **Check for new calls now**. Check that "Run in the background" is allowed. Only calls with numbers that are leads are logged. |
| AI calls don't start | The message on the AI calling page says why: missing API key, missing agent ID, or outside calling hours. |
| Facebook leads don't arrive | Check that the app is Live, **leadgen** is subscribed under Webhooks → Page, and the CRM app is allowed in **Leads access** for the Page. The Page row in Settings shows the last problem. Press **Fetch last 7 days** to catch up. |
| A lead isn't assigned | Check that assignment is switched on, the lead has a language, and at least one active telecaller has that language ticked in Team. |
| WhatsApp replies don't appear | Check the webhook URL is set in your provider, and that "Verify JWT" is off for `whatsapp-webhook`. **Edge Functions → whatsapp-webhook → Logs** shows each delivery. For QR, only chats with existing leads are saved. |
| "More than 24 hours have passed" | That's WhatsApp's rule for official numbers. Send an approved template first. |
| AI call results don't arrive | Check the webhook URL in Bolna, the `WEBHOOK_SECRET`, and that JWT verification is off for `ai-webhook`. In Supabase, **Edge Functions → ai-webhook → Logs** shows each request. |
