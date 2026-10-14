-- Dialbook Pro – call scripts for Gold Appraisal with the GJSCI certificate (English, Tamil, Telugu).
-- Run in Supabase → SQL Editor, after courses.sql. Safe to run again: it puts this version of the three GJSCI
-- scripts in place (replacing earlier copies of them) and leaves every other script as it is.
--
-- The scripts are for the course "Gold Appraisal – GJSCI" (every campaign with GJSCI in its name, see courses.sql).
-- The English one is for any language; Tamil and Telugu are used for leads with that language.
-- {fee}, {duration}, {timing}, {venue} and {dates} are filled from the lead's campaign (Campaigns → Edit).

with s(id, name, language, body, ord) as (values
  ('gj-en', 'GAC GJSCI – English', '', $gs$GOLD APPRAISAL (GJSCI CERTIFICATE) – ENGLISH CALL SCRIPT

★ 1. OPENING – say your name and the company first
"Good morning {first_name}, this is {agent} calling from {company}.
You enquired about our Gold Appraisal training.
Is this a good time to talk for 2 minutes?"
(If not: "No problem – what time shall I call you back?" Set the follow-up for that time.)

★ 2. ASK BEFORE YOU EXPLAIN – 3 quick questions
- "Which city are you from?"
- "What is your education qualification?"
- "Are you looking for a job, or do you plan to start your own gold loan business?"
Listen to the answers and use them while explaining.

3. ABOUT THE PROGRAM
"This training is conducted by Global Gold Foundation.
- It is a {duration} course, {timing}.
- Both theory and practical classes.
You will learn:
  • how to check the purity of gold
  • how to calculate stone weight
  • how to identify whether gold is original or fake.
At the end you get a certificate from GJSCI – the Gem & Jewellery Skill Council of India,
which functions under the Ministry of Skill Development & Entrepreneurship, Government of India."

4. THE CERTIFICATE – offer the specimen copy
"Let me send you a specimen copy of the certificate on WhatsApp so you can see it."
(Tap "🎓 Send certificate sample" on the lead.)
"It is a GJSCI Certificate of Participation in Gold Appraisal, with your name, your Aadhaar number and your photo, organised by Global Gold Foundation."
Tell them: "Please give your name exactly as in your Aadhaar and qualification certificate – it is printed on the certificate."

5. VENUE AND DATES
Venue: {venue}
Dates: {dates}
(If not fixed yet: "I'll send you the venue and dates on WhatsApp as soon as they are confirmed.")

6. DOCUMENTS TO BRING ON DAY 1
- 1 passport-size photo
- Aadhaar card xerox
- Qualification certificate xerox
- Address proof
- Payment receipt
- The application form, filled in and signed – both pages (tap "Send form": they fill it on the phone and print it)

7. FEES AND PAYMENT
"The fee is {fee}.
You can pay online (NEFT / GPay), or with the QR code I share on WhatsApp.
Please keep the UTR number or the payment screenshot – it goes in the application form."

★ 8. ALWAYS END WITH A NEXT STEP – never end the call without one
"I'll send you the course details and the certificate sample on WhatsApp now.
Shall I book your seat for the next batch?"
→ YES: "I'll send the payment QR now." Move the lead to Payment pending and set a follow-up to confirm the payment.
→ NEEDS TIME: "When can I call you back – today evening or tomorrow morning?" Set the follow-up for that exact time.
→ NOT INTERESTED: ask politely "May I know the reason?" and pick it as the lost reason.

------------------------------------------------------------
QUESTIONS CUSTOMERS ASK – AND WHAT TO SAY

Q: Which certificate will I get?
A: "A GJSCI certificate – Gem & Jewellery Skill Council of India. GJSCI is the nodal body for skill development in the Indian gems and jewellery industry and works under the Ministry of Skill Development & Entrepreneurship, Government of India. I'll send you the specimen copy on WhatsApp."

Q: Is there an online course?
A: "No. This course is fully practical – you test real gold with your own hands, so it is only in the classroom."

Q: Can I really learn this in 4 days?
A: "Yes, 4 days is more than enough. Learning to manufacture gold jewellery takes years, but this course teaches you to identify gold purity – and for that, 4 days of training with daily practice is fully sufficient."

Q: Is the certificate valid in other states?
A: "GJSCI is a national skill council under the Government of India, so the certificate is the same all over India."

Q: Do you provide job placement?
A: "That's a very good question. There are many job opportunities for trained Gold Appraisers – in banks, jewellery shops, finance companies and gold loan companies, and the demand keeps growing. This training and the GJSCI certificate give you the skill and recognition to get placed there through your own effort. Many people also start their own gold loan business after this course."
(If they ask "Is the job guaranteed?": "We don't arrange the job directly, and we don't give a job guarantee – but this certificate gives you a strong advantage when you apply.")

Q: Is the fee different in other cities?
A: "No, the fee is the same everywhere – Rs. 15,000."

Q: Can I get a refund, or send someone else in my place?
A: "Once paid, the fee cannot be refunded and the seat cannot be transferred to another person. So please book when you are sure of the dates."$gs$, 0),
  ('gj-ta', 'GAC GJSCI – Tamil', 'Tamil', $gs$GOLD APPRAISAL (GJSCI CERTIFICATE) – தமிழ் CALL SCRIPT

★ 1. ஆரம்பம் – முதல்ல உங்க பேரும் company பேரும் சொல்லுங்க
"வணக்கம் {first_name} sir/ma'am, நான் {agent}, {company}-ல இருந்து பேசுறேன்.
நீங்க எங்க Gold Appraisal training பத்தி enquiry பண்ணியிருந்தீங்க.
ஒரு 2 நிமிஷம் பேசலாமா?"
(இப்போ busy-னா: "பரவாயில்லை sir/ma'am, எப்போ call பண்ணட்டும்?" – அந்த நேரத்துக்கு follow-up வையுங்க.)

★ 2. விளக்குறதுக்கு முன்னாடி – 3 கேள்வி கேளுங்க
- "நீங்க எந்த ஊர்ல இருந்து பேசுறீங்க?"
- "நீங்க என்ன படிச்சிருக்கீங்க?"
- "இந்த course முடிச்சிட்டு job போகணுமா, இல்லை சொந்தமா gold loan shop வைக்கணுமா?"
அவங்க சொல்ற பதிலை வெச்சு பேசுங்க.

3. COURSE பற்றி
"இந்த training-ஐ Global Gold Foundation நடத்துது.
- {duration} training, {timing}.
- Theory-யும் practical class-ம் ரெண்டுமே இருக்கும்.
இந்த training-ல நீங்க கத்துக்கலாம்:
  • Gold-ஓட purity எப்படி check பண்றது
  • Stone weight எப்படி calculate பண்றது
  • Gold original-ஆ fake-ஆ-ன்னு எப்படி identify பண்றது
Course முடிஞ்சதும் GJSCI certificate கிடைக்கும் – Gem & Jewellery Skill Council of India.
இது Government of India-வோட Ministry of Skill Development & Entrepreneurship கீழ செயல்படுது."

4. CERTIFICATE – specimen copy அனுப்புங்க
"Certificate எப்படி இருக்கும்னு பாக்க, specimen copy-ஐ WhatsApp-ல அனுப்பறேன்."
(Lead-ல "🎓 Send certificate sample" அழுத்துங்க.)
"இது Gold Appraisal-க்கான GJSCI Certificate of Participation – உங்க பேரு, Aadhaar number, photo-வோட வரும், Global Gold Foundation organise பண்றது."
சொல்லுங்க: "உங்க Aadhaar, qualification certificate-ல இருக்கற மாதிரியே பேரு கொடுங்க – அதே பேரு தான் certificate-ல வரும்."

5. VENUE, DATES
Venue: {venue}
Dates: {dates}
(இன்னும் fix ஆகலைன்னா: "Venue, dates confirm ஆனதும் WhatsApp-ல அனுப்பறேன்.")

6. முதல் நாள் கொண்டு வர வேண்டியது
- 1 passport-size photo
- Aadhaar card xerox
- Qualification certificate xerox
- Address proof
- Payment receipt
- நிரப்பி sign பண்ண application form – ரெண்டு page-ம் ("Send form" அழுத்துங்க – phone-லயே நிரப்பி print எடுத்துக்கலாம்)

7. FEES, PAYMENT
"Fees {fee}.
Online-ஆ (NEFT / GPay) கட்டலாம், இல்லைன்னா நான் WhatsApp-ல அனுப்பற QR code மூலமா கட்டலாம்.
UTR number அல்லது payment screenshot-ஐ வெச்சுக்கோங்க – அது application form-ல எழுதணும்."

★ 8. எப்பவும் ஒரு NEXT STEP-ஓட call-ஐ முடிங்க
"இப்போ WhatsApp-ல course details-ம் certificate sample-ம் அனுப்பறேன். அடுத்த batch-க்கு உங்க seat book பண்ணட்டுமா?"
→ சரி: "இப்போ payment QR அனுப்பறேன்." Lead-ஐ Payment pending-க்கு மாத்தி, payment confirm பண்ண follow-up வையுங்க.
→ யோசிக்கணும்: "எப்போ call பண்ணட்டும் – இன்னைக்கு சாயங்காலமா, நாளைக்கு காலையிலயா?" அந்த நேரத்துக்கு follow-up வையுங்க.
→ Interest இல்லை: மரியாதையா "என்ன காரணம்னு தெரிஞ்சுக்கலாமா?"ன்னு கேட்டு, அதை lost reason-ஆ select பண்ணுங்க.

------------------------------------------------------------
CUSTOMERS கேக்கற கேள்விகள் – என்ன சொல்லணும்

கே: எந்த certificate கிடைக்கும்?
ப: "GJSCI certificate sir/ma'am – Gem & Jewellery Skill Council of India. Indian gems & jewellery industry-ல skill development-க்கு இது தான் nodal body, Government of India-வோட Ministry of Skill Development & Entrepreneurship கீழ செயல்படுது. Specimen copy-ஐ WhatsApp-ல அனுப்பறேன்."

கே: Online course இருக்கா?
ப: "இல்லை sir/ma'am. இது முழுக்க practical – real gold-ஐ நீங்களே கையால test பண்ணுவீங்க, அதனால classroom-ல மட்டும் தான்."

கே: 4 நாள்ல உண்மையிலேயே கத்துக்க முடியுமா?
ப: "கண்டிப்பா முடியும் sir/ma'am, 4 நாள் அதிகமாவே போதும். Gold jewellery செய்யக் கத்துக்க தான் வருஷக்கணக்குல ஆகும். இங்க gold purity identify பண்றது மட்டும் தான் – அதுக்கு தினமும் practice-ஓட 4 நாள் training போதும்."

கே: Certificate மத்த state-ல valid-ஆ?
ப: "GJSCI Government of India கீழ இருக்கற national skill council, அதனால இந்தியா முழுக்க இதே certificate தான்."

கே: Job placement நீங்க கொடுப்பீங்களா?
ப: "நல்ல கேள்வி sir/ma'am. Gold Appraiser-க்கு நிறைய job opportunities இருக்கு – bank, jewellery shop, finance company, gold loan company-ல. Demand-ம் அதிகமாயிட்டே இருக்கு. இந்த training-ம் GJSCI certificate-ம் உங்களுக்கு skill-ஐயும் recognition-ஐயும் கொடுக்கும். அதை வெச்சு உங்க சொந்த முயற்சியில placement வாங்கலாம். நிறைய பேர் சொந்தமா gold loan business-ம் ஆரம்பிச்சிருக்காங்க."
("Job guarantee-ஆ?"ன்னு கேட்டா: "நாங்க நேரடியா job arrange பண்றதில்லை, job guarantee-ம் கொடுக்கறதில்லை sir/ma'am – ஆனா apply பண்ணும்போது இந்த certificate உங்களுக்கு நல்ல advantage-ஆ இருக்கும்.")

கே: வேற ஊர்ல fees வேற மாதிரி இருக்குமா?
ப: "இல்லை sir/ma'am, எல்லா இடத்துலயும் fees ஒண்ணு தான் – 15,000 ரூபாய்."

கே: Refund கிடைக்குமா, இல்லை என் பதிலா வேற யாரையாவது அனுப்பலாமா?
ப: "Fees கட்டிட்டா refund கிடையாது, seat-ஐ வேற ஒருத்தருக்கு மாத்தவும் முடியாது sir/ma'am. அதனால dates உறுதியானதும் book பண்ணுங்க."$gs$, 1),
  ('gj-te', 'GAC GJSCI – Telugu', 'Telugu', $gs$GOLD APPRAISAL (GJSCI CERTIFICATE) – తెలుగు CALL SCRIPT

★ 1. OPENING – ముందు మీ పేరు, company పేరు చెప్పండి
"నమస్కారం {first_name} గారు, నేను {agent}, {company} నుండి మాట్లాడుతున్నాను.
మీరు మా Gold Appraisal training గురించి enquiry చేశారు.
ఇప్పుడు 2 నిమిషాలు మాట్లాడవచ్చా?"
(కుదరకపోతే: "పర్వాలేదు గారు – ఎప్పుడు call చేయమంటారు?" ఆ సమయానికి follow-up పెట్టండి.)

★ 2. వివరించే ముందు అడగండి – 3 చిన్న ప్రశ్నలు
- "మీది ఏ ఊరు గారు?"
- "మీరు ఏం చదువుకున్నారు?"
- "ఈ course తర్వాత job కావాలా, లేక సొంతంగా gold loan shop పెట్టాలనుకుంటున్నారా?"
వారి సమాధానం విని, దాన్నే ఉపయోగించి వివరించండి.

3. COURSE గురించి
"ఈ training ని Global Gold Foundation నిర్వహిస్తుంది.
- {duration} training, {timing}.
- Theory, practical classes రెండూ ఉంటాయి.
ఈ training లో మీరు నేర్చుకుంటారు:
  • బంగారం purity ఎలా check చేయాలి
  • Stone weight ఎలా లెక్కించాలి
  • బంగారం original ఆ fake ఆ ఎలా గుర్తించాలి
Course పూర్తయ్యాక GJSCI certificate ఇస్తారు – Gem & Jewellery Skill Council of India.
ఇది Government of India Ministry of Skill Development & Entrepreneurship కింద పనిచేస్తుంది."

4. CERTIFICATE – specimen copy పంపండి
"Certificate ఎలా ఉంటుందో చూడడానికి specimen copy ని WhatsApp లో పంపిస్తాను."
(Lead లో "🎓 Send certificate sample" నొక్కండి.)
"ఇది Gold Appraisal కి GJSCI Certificate of Participation – మీ పేరు, Aadhaar number, photo తో వస్తుంది, Global Gold Foundation organise చేస్తుంది."
చెప్పండి: "మీ Aadhaar, qualification certificate లో ఉన్నట్టే పేరు ఇవ్వండి – అదే పేరు certificate మీద వస్తుంది."

5. VENUE, DATES
Venue: {venue}
Dates: {dates}
(ఇంకా fix కాకపోతే: "Venue, dates confirm అవ్వగానే WhatsApp లో పంపిస్తాను.")

6. మొదటి రోజు తీసుకురావాల్సినవి
- 1 passport-size photo
- Aadhaar card xerox
- Qualification certificate xerox
- Address proof
- Payment receipt
- నింపి sign చేసిన application form – రెండు pages ("Send form" నొక్కండి – phone లోనే నింపి print తీసుకోవచ్చు)

7. FEES, PAYMENT
"Fees {fee}.
Online లో (NEFT / GPay) కట్టవచ్చు, లేదా నేను WhatsApp లో పంపే QR code ద్వారా కట్టవచ్చు.
UTR number లేదా payment screenshot ఉంచుకోండి – అది application form లో రాయాలి."

★ 8. ఎప్పుడూ ఒక NEXT STEP తో call ముగించండి
"ఇప్పుడే WhatsApp లో course details, certificate sample పంపిస్తాను. Next batch కి మీ seat book చేయమంటారా?"
→ సరే: "ఇప్పుడే payment QR పంపిస్తాను." Lead ని Payment pending కి మార్చి, payment confirm చేయడానికి follow-up పెట్టండి.
→ ఆలోచించాలి: "ఎప్పుడు call చేయమంటారు – ఈ రోజు సాయంత్రమా, రేపు ఉదయమా?" ఆ సమయానికి follow-up పెట్టండి.
→ Interest లేదు: మర్యాదగా "కారణం తెలుసుకోవచ్చా?" అని అడిగి, దాన్ని lost reason గా select చేయండి.

------------------------------------------------------------
CUSTOMERS అడిగే ప్రశ్నలు – ఏం చెప్పాలి

ప్ర: ఏ certificate వస్తుంది?
జ: "GJSCI certificate గారు – Gem & Jewellery Skill Council of India. Indian gems & jewellery industry లో skill development కి ఇదే nodal body, Government of India Ministry of Skill Development & Entrepreneurship కింద పనిచేస్తుంది. Specimen copy ని WhatsApp లో పంపిస్తాను."

ప్ర: Online course ఉందా?
జ: "లేదు గారు. ఇది పూర్తిగా practical – real gold ని మీరే చేతితో test చేస్తారు, అందుకే classroom లో మాత్రమే."

ప్ర: 4 రోజుల్లో నిజంగా నేర్చుకోగలమా?
జ: "తప్పకుండా గారు, 4 రోజులు చాలా ఎక్కువే. బంగారు నగలు తయారు చేయడం నేర్చుకోవడానికే సంవత్సరాలు పడుతుంది. ఇక్కడ gold purity గుర్తించడం మాత్రమే – దానికి రోజూ practice తో 4 రోజుల training సరిపోతుంది."

ప్ర: Certificate వేరే state లో valid ఆ?
జ: "GJSCI Government of India కింద ఉన్న national skill council, కాబట్టి భారతదేశం అంతటా ఇదే certificate."

ప్ర: Job placement మీరు ఇస్తారా?
జ: "మంచి ప్రశ్న గారు. Gold Appraiser కి చాలా job opportunities ఉన్నాయి – bank, jewellery shop, finance company, gold loan company లో. Demand కూడా పెరుగుతూనే ఉంది. ఈ training, GJSCI certificate మీకు skill, recognition రెండూ ఇస్తాయి. దానితో మీ సొంత ప్రయత్నంతో placement పొందవచ్చు. చాలా మంది సొంతంగా gold loan business కూడా మొదలుపెట్టారు."
("Job guarantee ఆ?" అని అడిగితే: "మేము నేరుగా job arrange చేయము, job guarantee కూడా ఇవ్వము గారు – కానీ apply చేసేటప్పుడు ఈ certificate మీకు మంచి advantage అవుతుంది.")

ప్ర: వేరే ఊళ్లలో fees వేరుగా ఉంటుందా?
జ: "లేదు గారు, అన్ని చోట్లా fees ఒకటే – 15,000 రూపాయలు."

ప్ర: Refund వస్తుందా, లేదా నా బదులు వేరే వాళ్లను పంపవచ్చా?
జ: "Fees కట్టిన తర్వాత refund ఉండదు, seat ని వేరే వాళ్లకు మార్చడం కుదరదు గారు. అందుకే dates ఖచ్చితం అయ్యాక book చేయండి."$gs$, 2)
), add as (
  select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'campaign_id', '', 'course', 'Gold Appraisal – GJSCI',
                                      'language', language, 'body', body) order by ord) as items
    from s
)
update public.settings st
   set data = jsonb_set(coalesce(st.data, '{}'::jsonb), '{scripts}',
                        coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(st.data->'scripts', '[]'::jsonb)) x
                                   where coalesce(x->>'id', '') not in (select id from s)), '[]'::jsonb) || add.items),
       updated_at = now()
  from add
 where st.id = 1;
