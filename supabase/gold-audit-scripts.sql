-- Dialbook Pro – call scripts for the Gold Audit and Appraisal course (English, Hindi, Tamil, Telugu).
-- Run once in Supabase → SQL Editor, after courses.sql. Safe to run again: a script that is already there
-- (same id) is left as it is, so edits made later in Settings → Call scripts are kept.
--
-- The scripts are for the course "Gold Audit and Appraisal", so they work for every city's campaign of that
-- course. The English one is for any language; Hindi, Tamil and Telugu are used for leads with that language.
-- {fee}, {duration}, {timing}, {venue} and {dates} are filled from the lead's campaign (Campaigns → Edit).

with s(id, name, language, body, ord) as (values
  ('ga-en', 'Gold Audit – English', '', $gs$GOLD AUDIT AND APPRAISAL – ENGLISH CALL SCRIPT

★ 1. OPENING – say your name and the company first
"Good morning {first_name}, this is {agent} calling from {company}.
You enquired about our {course} training.
Is this a good time to talk for 2 minutes?"
(If not: "No problem – what time shall I call you back?" Set the follow-up for that time.)

★ 2. ASK BEFORE YOU EXPLAIN – 3 quick questions
- "Which city are you from?"
- "What are you doing at present, and what is your qualification?"
- "What is your plan – a job as a gold appraiser or gold auditor in banks or NBFCs, your own gold loan business, or old gold buying and selling?"
Listen and use their answer while explaining.

3. ABOUT THE PROGRAM
"This training is conducted by MSME Technology Development Centre – a Government of India institution.
- It is {duration}, {timing}.
- It covers the full Gold Appraisal syllabus: checking gold purity, calculating stone weight, and identifying real and fake gold.
- On top of that, there are extra practical sessions on identifying the different varieties of fake jewellery,
  and the step-by-step procedure to follow during a gold audit in a bank or NBFC.
- Every candidate practises individually with real gold ornaments and samples of different purity.
- At the end you get the MSME certificate with the Government of India logo.
You do not need to do the GAC course first – you can join this directly."

4. WHO SHOULD JOIN
- People who want a job as a gold appraiser or gold auditor in banks and NBFCs
- People who want to start their own gold loan business
- People who want to start old gold buying and selling

5. VENUE AND DATES
Venue: {venue}
Dates: {dates}
(If they are not fixed yet: "The venue and dates for this batch will be confirmed soon. I'll note your interest and send you the details on WhatsApp as soon as they are fixed.")

6. DOCUMENTS TO BRING ON DAY 1
- 1 passport-size photo
- Aadhaar card xerox
- Qualification certificate xerox
- The MSME application form, filled in and signed (tap "Send form" – they fill it on the phone and print it)

7. FEES AND PAYMENT
"The fee is {fee}.
Payment is only through the QR code on the MSME website link. I'll send you the link on WhatsApp."
(No cash and no DD for this course.)

8. AFTER THE COURSE
"With this certificate you can get empanelled with banks and NBFCs as a gold auditor or gold appraiser.
The work and earnings depend on the business of the bank or the branches you cover.
Many people also start their own gold loan or old gold business."

★ 9. ALWAYS END WITH A NEXT STEP – never end the call without one
"I'll send you the course details on WhatsApp now. Shall I book your seat for this batch?"
→ YES: "I'll send the payment link now." Move the lead to Payment pending and set a follow-up to confirm the payment.
→ NEEDS TIME: "When can I call you back – today evening or tomorrow morning?" Set the follow-up for that exact time.
→ NOT INTERESTED: ask politely "May I know the reason?" and pick it as the lost reason.

------------------------------------------------------------
QUESTIONS CUSTOMERS ASK – AND WHAT TO SAY

Q: Why is the fee Rs. 25,000?
A: "The Rs. 25,000 includes GST. In this course every candidate gets real gold ornaments and samples of different purity to test by themselves – it is not a demo where only one or two people test. Testing causes some loss of gold, and the fee has been fixed considering all these factors."

Q: Is 2 days enough?
A: "Yes, 2 full days is more than enough. Courses on jewellery manufacturing, like goldsmithing or stone setting, need much more time. Here we only work with finished gold ornaments and check whether they are real or fake – and in these 2 days we cover every aspect an appraiser and auditor needs."

Q: Do you give a job guarantee?
A: "That's a good question. Banks and NBFCs need trained gold appraisers and gold auditors, and this Government of India certificate makes you eligible to get empanelled with them. But we do not give any job guarantee – the empanelment and the work depend on the bank and on your own effort."

Q: Do I need to finish the GAC course first?
A: "No. This course already includes the full Gold Appraisal content, so you can join directly."

Q: How is this different from the Gold Appraisal (GAC) course?
A: "GAC teaches gold appraisal. This course covers all of that, plus practical sessions on the different varieties of fake jewellery and the audit procedure followed in banks and NBFCs. It runs for 2 full days, {timing}."

Q: Is there an online course?
A: "No. It is fully practical – you test real ornaments with your own hands, so it is only in the classroom."

Q: Is the certificate valid in other states?
A: "It is a Central Government (MSME) certificate with the Government of India logo, so you can use it anywhere in India."$gs$, 0),
  ('ga-hi', 'Gold Audit – Hindi', 'Hindi', $gs$GOLD AUDIT AND APPRAISAL – HINDI CALL SCRIPT

★ 1. OPENING – पहले अपना नाम और कंपनी बताइए
"नमस्ते {first_name} जी, मैं {agent} बोल रहा/रही हूँ, {company} से।
आपने हमारे {course} training के बारे में enquiry की थी।
क्या अभी 2 मिनट बात कर सकते हैं?"
(अगर नहीं: "कोई बात नहीं – मैं आपको कब call करूँ?" उसी समय का follow-up लगाइए।)

★ 2. समझाने से पहले पूछिए – 3 छोटे सवाल
- "आप किस शहर से हैं?"
- "अभी आप क्या करते हैं, और आपकी qualification क्या है?"
- "आपका plan क्या है – bank या NBFC में gold appraiser / gold auditor की job, अपना gold loan business, या पुराना सोना खरीदने-बेचने का business?"
उनका जवाब सुनिए और समझाते समय उसी का इस्तेमाल कीजिए।

3. PROGRAM के बारे में
"यह training MSME Technology Development Centre करवाता है – यह भारत सरकार (Government of India) की संस्था है।
- यह {duration} का course है, {timing}।
- इसमें पूरा Gold Appraisal syllabus है: सोने की purity जाँचना, stone weight निकालना, और असली-नकली सोना पहचानना।
- इसके अलावा extra practical sessions हैं – अलग-अलग तरह की नकली jewellery पहचानना,
  और bank या NBFC में gold audit करते समय कौन-सी procedure follow करनी है।
- हर candidate असली gold ornaments और अलग-अलग purity के samples पर खुद अलग से practice करता है।
- आखिर में Government of India logo वाला MSME certificate मिलता है।
पहले GAC course करना ज़रूरी नहीं है – आप सीधे यह course join कर सकते हैं।"

4. कौन join करे
- जो bank और NBFC में gold appraiser या gold auditor की job चाहते हैं
- जो अपना gold loan business शुरू करना चाहते हैं
- जो पुराना सोना खरीदने-बेचने का business शुरू करना चाहते हैं

5. VENUE और DATES
Venue: {venue}
Dates: {dates}
(अगर अभी fix नहीं हैं: "इस batch का venue और dates जल्दी confirm होंगे। मैं आपका interest note कर लेता/लेती हूँ और fix होते ही WhatsApp पर details भेज दूँगा/दूँगी।")

6. पहले दिन क्या लाना है
- 1 passport-size photo
- Aadhaar card की xerox
- Qualification certificate की xerox
- भरा हुआ और sign किया हुआ MSME application form ("Send form" दबाइए – वो phone पर भरकर print कर लेंगे)

7. FEES और PAYMENT
"Fees {fee} है।
Payment सिर्फ MSME website link के QR code से होता है। मैं आपको link WhatsApp पर भेज देता/देती हूँ।"
(इस course के लिए cash या DD नहीं।)

8. COURSE के बाद
"इस certificate से आप banks और NBFCs में gold auditor या gold appraiser के रूप में empanel हो सकते हैं।
काम और कमाई उस bank या जिन branches को आप cover करते हैं, उनके business पर depend करती है।
बहुत लोग अपना gold loan या पुराने सोने का business भी शुरू करते हैं।"

★ 9. हमेशा NEXT STEP के साथ call खत्म कीजिए
"मैं अभी आपको WhatsApp पर course की details भेज रहा/रही हूँ। क्या इस batch के लिए आपकी seat book कर दूँ?"
→ हाँ: "मैं अभी payment link भेज देता/देती हूँ।" Lead को Payment pending में डालिए और payment confirm करने का follow-up लगाइए।
→ समय चाहिए: "आपको कब call करूँ – आज शाम या कल सुबह?" उसी समय का follow-up लगाइए।
→ Interest नहीं: विनम्रता से पूछिए "क्या मैं वजह जान सकता/सकती हूँ?" और वही lost reason चुनिए।

------------------------------------------------------------
लोग जो सवाल पूछते हैं – और क्या जवाब दें

सवाल: Fees 25,000 क्यों है?
जवाब: "25,000 में GST शामिल है। इस course में हर candidate को असली gold ornaments और अलग-अलग purity के samples खुद test करने के लिए मिलते हैं – ऐसा नहीं कि सिर्फ एक-दो लोग test करें और बाकी देखें। Testing में थोड़ा सोना कम (loss) होता है। इन सब बातों को ध्यान में रखकर fees तय की गई है।"

सवाल: क्या 2 दिन काफ़ी हैं?
जवाब: "जी हाँ, 2 पूरे दिन काफ़ी से ज़्यादा हैं। Jewellery manufacturing वाले courses, जैसे goldsmithing या stone setting, में बहुत ज़्यादा समय लगता है। यहाँ हम सिर्फ बने हुए gold ornaments पर काम करते हैं और देखते हैं कि वो असली हैं या नकली – और इन 2 दिनों में appraiser और auditor के लिए ज़रूरी हर चीज़ cover होती है।"

सवाल: क्या job guarantee है?
जवाब: "अच्छा सवाल है। Banks और NBFCs को trained gold appraisers और gold auditors की ज़रूरत होती है, और यह Government of India certificate आपको उनके साथ empanel होने के लिए eligible बनाता है। लेकिन हम कोई job guarantee नहीं देते – empanelment और काम bank पर और आपकी अपनी मेहनत पर depend करता है।"

सवाल: क्या पहले GAC course करना ज़रूरी है?
जवाब: "नहीं। इस course में पूरा Gold Appraisal content पहले से है, इसलिए आप सीधे join कर सकते हैं।"

सवाल: यह Gold Appraisal (GAC) course से कैसे अलग है?
जवाब: "GAC में gold appraisal सिखाया जाता है। इस course में वो सब है, साथ में अलग-अलग तरह की नकली jewellery पहचानने के practical sessions और banks/NBFCs में follow होने वाली audit procedure भी। यह 2 पूरे दिन का है, {timing}।"

सवाल: क्या online course है?
जवाब: "नहीं। यह पूरी तरह practical है – आप असली ornaments अपने हाथ से test करते हैं, इसलिए यह सिर्फ classroom में होता है।"

सवाल: क्या certificate दूसरे राज्यों में valid है?
जवाब: "यह Central Government (MSME) का certificate है, Government of India logo के साथ, इसलिए आप इसे पूरे भारत में इस्तेमाल कर सकते हैं।"$gs$, 1),
  ('ga-ta', 'Gold Audit – Tamil', 'Tamil', $gs$GOLD AUDIT AND APPRAISAL – TAMIL CALL SCRIPT

★ 1. OPENING – முதல்ல உங்க பேரையும் company பேரையும் சொல்லுங்க
"வணக்கம் {first_name} sir/ma'am, நான் {agent}, {company}-ல இருந்து பேசறேன்.
நீங்க எங்க {course} training பத்தி enquiry பண்ணியிருந்தீங்க.
இப்போ 2 நிமிஷம் பேசலாமா?"
(முடியலைன்னா: "பரவாயில்லை sir/ma'am – எப்போ call பண்ணட்டும்?" அந்த நேரத்துக்கு follow-up வெச்சுக்கோங்க.)

★ 2. விளக்கறதுக்கு முன்னாடி கேளுங்க – 3 சின்ன கேள்விகள்
- "நீங்க எந்த ஊர் sir/ma'am?"
- "இப்போ என்ன பண்றீங்க, உங்க qualification என்ன?"
- "உங்க plan என்ன – bank அல்லது NBFC-ல gold appraiser / gold auditor job-ஆ, சொந்தமா gold loan business-ஆ, இல்ல பழைய தங்கம் வாங்கி விக்கற business-ஆ?"
அவங்க பதிலை கேட்டு, அதை வெச்சே விளக்குங்க.

3. PROGRAM பத்தி
"இந்த training-ஐ MSME Technology Development Centre நடத்துது – இது Government of India நிறுவனம்.
- இது {duration} course, {timing}.
- இதுல முழு Gold Appraisal syllabus-ம் இருக்கு: தங்கத்தோட purity check பண்றது, stone weight கணக்கு பண்றது, original-ஆ fake-ஆன்னு கண்டுபிடிக்கறது.
- அதோட சேர்த்து extra practical sessions இருக்கு – பல வகையான fake jewellery-ஐ கண்டுபிடிக்கறது,
  bank அல்லது NBFC-ல gold audit பண்ணும்போது follow பண்ண வேண்டிய procedure.
- ஒவ்வொரு candidate-ம் தனித்தனியா real gold ornaments, வேற வேற purity samples-ல practice பண்ணுவாங்க.
- கடைசியில Government of India logo-வோட MSME certificate கிடைக்கும்.
முதல்ல GAC course பண்ணனும்னு அவசியம் இல்லை – நேரடியா இதை join பண்ணலாம்."

4. யார் join பண்ணலாம்
- Bank, NBFC-ல gold appraiser அல்லது gold auditor job வேணும்னு நினைக்கறவங்க
- சொந்தமா gold loan business ஆரம்பிக்க நினைக்கறவங்க
- பழைய தங்கம் வாங்கி விக்கற business ஆரம்பிக்க நினைக்கறவங்க

5. VENUE, DATES
Venue: {venue}
Dates: {dates}
(இன்னும் fix ஆகலைன்னா: "இந்த batch-ஓட venue, dates சீக்கிரம் confirm ஆகும். உங்க interest-ஐ note பண்ணிக்கறேன், fix ஆனதும் WhatsApp-ல details அனுப்பறேன்.")

6. முதல் நாள் கொண்டு வர வேண்டியது
- 1 passport-size photo
- Aadhaar card xerox
- Qualification certificate xerox
- நிரப்பி sign பண்ண MSME application form ("Send form" அழுத்துங்க – phone-லயே நிரப்பி print எடுத்துக்கலாம்)

7. FEES, PAYMENT
"Fees {fee}.
Payment MSME website link-ல இருக்கற QR code மூலமா மட்டும் தான். Link-ஐ WhatsApp-ல அனுப்பறேன்."
(இந்த course-க்கு cash, DD கிடையாது.)

8. COURSE முடிஞ்ச பிறகு
"இந்த certificate வெச்சு banks, NBFCs-ல gold auditor அல்லது gold appraiser-ஆ empanel ஆகலாம்.
வேலையும் வருமானமும் அந்த bank அல்லது நீங்க cover பண்ற branches-ஓட business-ஐ பொறுத்து இருக்கும்.
நிறைய பேர் சொந்தமா gold loan அல்லது பழைய தங்க business-ம் ஆரம்பிக்கறாங்க."

★ 9. எப்பவும் ஒரு NEXT STEP-ஓட call-ஐ முடிங்க
"இப்போ WhatsApp-ல course details அனுப்பறேன். இந்த batch-க்கு உங்க seat book பண்ணட்டுமா?"
→ சரி: "இப்போ payment link அனுப்பறேன்." Lead-ஐ Payment pending-க்கு மாத்தி, payment confirm பண்ண follow-up வெச்சுக்கோங்க.
→ யோசிக்கணும்: "எப்போ call பண்ணட்டும் – இன்னைக்கு சாயங்காலமா, நாளைக்கு காலையிலயா?" அந்த நேரத்துக்கு follow-up வெச்சுக்கோங்க.
→ Interest இல்லை: மரியாதையா "என்ன காரணம்னு தெரிஞ்சுக்கலாமா?"ன்னு கேட்டு, அதை lost reason-ஆ select பண்ணுங்க.

------------------------------------------------------------
CUSTOMERS கேக்கற கேள்விகள் – என்ன சொல்லணும்

கே: Fees ஏன் 25,000?
ப: "25,000-ல GST சேர்ந்திருக்கு sir/ma'am. இந்த course-ல ஒவ்வொரு candidate-க்கும் real gold ornaments, வேற வேற purity samples தனியா test பண்ண கொடுப்போம் – ஒண்ணு ரெண்டு பேர் மட்டும் test பண்ணி மத்தவங்க பாக்கற மாதிரி இல்லை. Testing-ல கொஞ்சம் தங்கம் loss ஆகும். இதெல்லாம் கணக்குல எடுத்து தான் fees fix பண்ணியிருக்காங்க."

கே: 2 நாள் போதுமா?
ப: "கண்டிப்பா போதும் sir/ma'am, 2 முழு நாள் அதிகமாவே போதும். Goldsmithing, stone setting மாதிரி jewellery manufacturing course-க்கு தான் நிறைய நாள் தேவைப்படும். இங்க ready-ஆ இருக்கற gold ornaments original-ஆ fake-ஆன்னு மட்டும் தான் பாக்கறோம் – ஒரு appraiser, auditor-க்கு தேவையான எல்லாத்தையும் இந்த 2 நாள்ல cover பண்ணிடுவோம்."

கே: Job guarantee இருக்கா?
ப: "நல்ல கேள்வி sir/ma'am. Banks, NBFCs-க்கு trained gold appraisers, gold auditors தேவைப்படறாங்க. இந்த Government of India certificate அவங்களோட empanel ஆக உங்களை eligible ஆக்கும். ஆனா நாங்க எந்த job guarantee-யும் கொடுக்கறதில்லை – empanelment-ம் வேலையும் அந்த bank-ஐயும் உங்க முயற்சியையும் பொறுத்து தான்."

கே: முதல்ல GAC course பண்ணணுமா?
ப: "இல்லை sir/ma'am. இந்த course-லயே முழு Gold Appraisal content-ம் இருக்கு, அதனால நேரடியா join பண்ணலாம்."

கே: இது Gold Appraisal (GAC) course-ல இருந்து எப்படி வேற?
ப: "GAC-ல gold appraisal கத்துக்குவீங்க. இந்த course-ல அது எல்லாமும் இருக்கு, கூடவே பல வகையான fake jewellery கண்டுபிடிக்கற practical sessions, banks/NBFCs-ல follow பண்ற audit procedure-ம் இருக்கு. இது 2 முழு நாள், {timing}."

கே: Online course இருக்கா?
ப: "இல்லை sir/ma'am. இது முழுக்க practical – real ornaments-ஐ நீங்களே கையால test பண்ணுவீங்க, அதனால classroom-ல மட்டும் தான்."

கே: Certificate மத்த state-ல valid-ஆ?
ப: "இது Central Government (MSME) certificate, Government of India logo-வோட. இந்தியா முழுக்க use பண்ணலாம்."$gs$, 2),
  ('ga-te', 'Gold Audit – Telugu', 'Telugu', $gs$GOLD AUDIT AND APPRAISAL – TELUGU CALL SCRIPT

★ 1. OPENING – ముందు మీ పేరు, company పేరు చెప్పండి
"నమస్కారం {first_name} గారు, నేను {agent}, {company} నుండి మాట్లాడుతున్నాను.
మీరు మా {course} training గురించి enquiry చేశారు.
ఇప్పుడు 2 నిమిషాలు మాట్లాడవచ్చా?"
(కుదరకపోతే: "పర్వాలేదు గారు – ఎప్పుడు call చేయమంటారు?" ఆ సమయానికి follow-up పెట్టండి.)

★ 2. వివరించే ముందు అడగండి – 3 చిన్న ప్రశ్నలు
- "మీది ఏ ఊరు గారు?"
- "ప్రస్తుతం మీరు ఏం చేస్తున్నారు, మీ qualification ఏమిటి?"
- "మీ plan ఏమిటి – bank లేదా NBFC లో gold appraiser / gold auditor job ఆ, సొంత gold loan business ఆ, లేక పాత బంగారం కొని అమ్మే business ఆ?"
వారి సమాధానం విని, దాన్నే ఉపయోగించి వివరించండి.

3. PROGRAM గురించి
"ఈ training ని MSME Technology Development Centre నిర్వహిస్తుంది – ఇది Government of India సంస్థ.
- ఇది {duration} course, {timing}.
- ఇందులో పూర్తి Gold Appraisal syllabus ఉంది: బంగారం purity check చేయడం, stone weight లెక్కించడం, original ఆ fake ఆ గుర్తించడం.
- దానితో పాటు extra practical sessions ఉన్నాయి – రకరకాల fake jewellery ని గుర్తించడం,
  bank లేదా NBFC లో gold audit చేసేటప్పుడు పాటించాల్సిన procedure.
- ప్రతి candidate విడిగా real gold ornaments, వేర్వేరు purity samples మీద practice చేస్తారు.
- చివరలో Government of India logo తో MSME certificate ఇస్తారు.
ముందు GAC course చేయాల్సిన అవసరం లేదు – నేరుగా ఇది join అవ్వవచ్చు."

4. ఎవరు join అవ్వవచ్చు
- Bank, NBFC లో gold appraiser లేదా gold auditor job కావాలనుకునే వారు
- సొంత gold loan business మొదలుపెట్టాలనుకునే వారు
- పాత బంగారం కొని అమ్మే business మొదలుపెట్టాలనుకునే వారు

5. VENUE, DATES
Venue: {venue}
Dates: {dates}
(ఇంకా fix కాకపోతే: "ఈ batch venue, dates త్వరలో confirm అవుతాయి. మీ interest note చేసుకుంటాను, fix అవ్వగానే WhatsApp లో details పంపిస్తాను.")

6. మొదటి రోజు తీసుకురావాల్సినవి
- 1 passport-size photo
- Aadhaar card xerox
- Qualification certificate xerox
- నింపి sign చేసిన MSME application form ("Send form" నొక్కండి – phone లోనే నింపి print తీసుకోవచ్చు)

7. FEES, PAYMENT
"Fees {fee}.
Payment MSME website link లో ఉన్న QR code ద్వారా మాత్రమే. Link ని WhatsApp లో పంపిస్తాను."
(ఈ course కి cash, DD ఉండదు.)

8. COURSE తర్వాత
"ఈ certificate తో banks, NBFCs లో gold auditor లేదా gold appraiser గా empanel అవ్వవచ్చు.
పని, సంపాదన ఆ bank లేదా మీరు cover చేసే branches business మీద ఆధారపడి ఉంటుంది.
చాలా మంది సొంతంగా gold loan లేదా పాత బంగారం business కూడా మొదలుపెడతారు."

★ 9. ఎప్పుడూ ఒక NEXT STEP తో call ముగించండి
"ఇప్పుడే WhatsApp లో course details పంపిస్తాను. ఈ batch కి మీ seat book చేయమంటారా?"
→ సరే: "ఇప్పుడే payment link పంపిస్తాను." Lead ని Payment pending కి మార్చి, payment confirm చేయడానికి follow-up పెట్టండి.
→ ఆలోచించాలి: "ఎప్పుడు call చేయమంటారు – ఈ రోజు సాయంత్రమా, రేపు ఉదయమా?" ఆ సమయానికి follow-up పెట్టండి.
→ Interest లేదు: మర్యాదగా "కారణం తెలుసుకోవచ్చా?" అని అడిగి, దాన్ని lost reason గా select చేయండి.

------------------------------------------------------------
CUSTOMERS అడిగే ప్రశ్నలు – ఏం చెప్పాలి

ప్ర: Fees 25,000 ఎందుకు?
జ: "25,000 లో GST కలిసి ఉంది గారు. ఈ course లో ప్రతి candidate కి real gold ornaments, వేర్వేరు purity samples విడిగా test చేయడానికి ఇస్తాము – ఒకరిద్దరు మాత్రమే test చేసి మిగతావారు చూసే లాగా కాదు. Testing లో కొంత బంగారం loss అవుతుంది. ఇవన్నీ లెక్కలోకి తీసుకునే fees fix చేశారు."

ప్ర: 2 రోజులు సరిపోతాయా?
జ: "తప్పకుండా సరిపోతాయి గారు, 2 పూర్తి రోజులు చాలా ఎక్కువే. Goldsmithing, stone setting లాంటి jewellery manufacturing courses కి మాత్రమే ఎక్కువ సమయం కావాలి. ఇక్కడ తయారైన gold ornaments original ఆ fake ఆ అని మాత్రమే చూస్తాము – ఒక appraiser, auditor కి కావాల్సినవన్నీ ఈ 2 రోజుల్లో cover చేస్తాము."

ప్ర: Job guarantee ఉందా?
జ: "మంచి ప్రశ్న గారు. Banks, NBFCs కి trained gold appraisers, gold auditors అవసరం. ఈ Government of India certificate వారితో empanel అవ్వడానికి మిమ్మల్ని eligible చేస్తుంది. కానీ మేము ఎలాంటి job guarantee ఇవ్వము – empanelment, పని ఆ bank మీద, మీ సొంత ప్రయత్నం మీద ఆధారపడి ఉంటాయి."

ప్ర: ముందు GAC course చేయాలా?
జ: "లేదు గారు. ఈ course లోనే పూర్తి Gold Appraisal content ఉంది, కాబట్టి నేరుగా join అవ్వవచ్చు."

ప్ర: ఇది Gold Appraisal (GAC) course నుండి ఎలా వేరు?
జ: "GAC లో gold appraisal నేర్పిస్తారు. ఈ course లో అదంతా ఉంటుంది, దానితో పాటు రకరకాల fake jewellery గుర్తించే practical sessions, banks/NBFCs లో పాటించే audit procedure కూడా ఉంటాయి. ఇది 2 పూర్తి రోజులు, {timing}."

ప్ర: Online course ఉందా?
జ: "లేదు గారు. ఇది పూర్తిగా practical – real ornaments ని మీరే చేతితో test చేస్తారు, అందుకే classroom లో మాత్రమే."

ప్ర: Certificate వేరే state లో valid ఆ?
జ: "ఇది Central Government (MSME) certificate, Government of India logo తో. భారతదేశం అంతటా ఉపయోగించవచ్చు."$gs$, 3)
), add as (
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'campaign_id', '', 'course', 'Gold Audit and Appraisal',
                                               'language', s.language, 'body', s.body) order by s.ord), '[]'::jsonb) as items
    from s, public.settings st
   where st.id = 1
     and not exists (select 1 from jsonb_array_elements(coalesce(st.data->'scripts', '[]'::jsonb)) x where x->>'id' = s.id)
)
update public.settings st
   set data = jsonb_set(coalesce(st.data, '{}'::jsonb), '{scripts}', coalesce(st.data->'scripts', '[]'::jsonb) || add.items),
       updated_at = now()
  from add
 where st.id = 1 and jsonb_array_length(add.items) > 0;
