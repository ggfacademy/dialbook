/* Dialbook Pro – web CRM (Supabase) */
(()=>{
'use strict';
/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gid=p=>(p||'')+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const now=()=>Date.now();
const DAY=864e5;
const clone=o=>JSON.parse(JSON.stringify(o));
const sod=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
const ts=v=>v?new Date(v).getTime():null;
const iso=t=>new Date(t).toISOString();
const fmtD=t=>t?new Date(t).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'';
const fmtDT=t=>t?new Date(t).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'';
const rel=t=>{t=ts(t);if(!t)return'';const d=t-now(),m=Math.round(Math.abs(d)/6e4);if(m<1)return'just now';const s=m<60?m+'m':m<1440?Math.round(m/60)+'h':Math.round(m/1440)+'d';return d<0?s+' ago':'in '+s};
const dur=s=>{s=Math.round(s||0);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}h ${m}m`:m?`${m}m ${String(x).padStart(2,'0')}s`:`${x}s`};
const mmss=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const inr=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const pct=x=>Math.round((x||0)*100)+'%';
const pad=n=>String(n).padStart(2,'0');
const ymd=t=>{const d=new Date(t);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const normPhone=p=>{let d=String(p??'').trim().replace(/[^\d+]/g,'');if(!d)return'';if(d.startsWith('+'))return d;d=d.replace(/^0+/,'');if(d.length===12&&d.startsWith('91'))return'+'+d;if(d.length===10)return'+91'+d;return d};
const pkey=p=>String(p||'').replace(/\D/g,'').slice(-10);
const waLink=(p,t)=>`https://wa.me/${normPhone(p).replace(/\D/g,'')}${t?'?text='+encodeURIComponent(t):''}`;
const toLocalInput=t=>{if(!t)return'';const d=new Date(t);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
const toDateInput=t=>toLocalInput(t).slice(0,10);
const TZ=(()=>{try{const z=Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Kolkata';return z==='Asia/Calcutta'?'Asia/Kolkata':z}catch(e){return'Asia/Kolkata'}})();
const chunk=(a,n)=>{const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o};

const I={
home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
leads:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
cols:'<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
flag:'<path d="M5 21V4h11l-2 4 2 4H5"/>',
team:'<circle cx="12" cy="7" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
up:'<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
down:'<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
msg:'<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/>',
copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
x:'<path d="M6 6l12 12M18 6L6 18"/>',
skip:'<path d="M5 5l10 7-10 7zM19 5v14"/>',
more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
play:'<path d="M7 4l13 8-13 8z"/>'
};
const ic=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

const DEF={company:'Dialbook',
  stages:[{id:'new',name:'New'},{id:'contacted',name:'Contacted'},{id:'interested',name:'Interested'},{id:'followup',name:'Follow-up'},{id:'negotiation',name:'Negotiation'},{id:'won',name:'Converted'},{id:'lost',name:'Lost'}],
  dispositions:[{id:'interested',name:'Interested',connected:true,stage:'interested',fu:true},{id:'callback',name:'Call back later',connected:true,stage:'followup',fu:true},{id:'info_shared',name:'Details shared',connected:true,stage:'contacted',fu:true},{id:'converted',name:'Converted / Sale',connected:true,stage:'won',fu:false},{id:'not_interested',name:'Not interested',connected:true,stage:'lost',fu:false},{id:'no_answer',name:'Did not pick',connected:false,stage:'',fu:true},{id:'busy',name:'Busy / Cut the call',connected:false,stage:'',fu:true},{id:'unreachable',name:'Switched off / Not reachable',connected:false,stage:'',fu:true},{id:'wrong_number',name:'Wrong number',connected:false,stage:'lost',fu:false},{id:'dnd',name:'Asked not to be contacted',connected:true,stage:'lost',fu:false}],
  sources:['Facebook Ads','Google Ads','Website','IndiaMART','JustDial','Referral','Walk-in','Incoming call','Excel import'],
  templates:[{id:'t1',name:'Intro after call',channel:'whatsapp',body:'Hi {name}, this is {agent} from {company}. Thanks for your time on the call. Sharing the details we discussed.'}],
  autoCreateIncoming:true,ai:{agentId:'',fromNumber:'',startHour:10,endHour:19,maxBatch:50,agents:{}},
  languages:['English','Hindi','Tamil','Telugu','Kannada','Malayalam','Marathi','Bengali','Gujarati','Punjabi','Odia'],
  assignment:{enabled:false,fallback:'all',rules:[{id:'r1',language:'',source:'',campaign:'',mode:'speakers',agents:[]}]}};
const langOpts=(sel,blank)=>(blank?opt('',blank,sel):'')+(S.cfg.languages||[]).map(l=>opt(l,l,sel)).join('')+(sel&&!(S.cfg.languages||[]).includes(sel)?opt(sel,sel,sel):'');

/* ---------- state ---------- */
const CFG=window.DIALBOOK_CONFIG||{};
let sb=null;
const S={me:null,team:[],campaigns:[],cfg:clone(DEF),view:'home',
  lf:{q:'',stage:'',camp:'',agent:'',source:'',prio:'',fu:'',lang:''},sel:new Set(),page:0,PS:50,
  range:'7',hAgent:'',pf:{camp:'',agent:''},rep:{from:sod(now()-6*DAY),to:sod(now()),agent:'',camp:''},
  fuAgent:'',openLead:null,dialer:null,dialSetup:{camp:'',queue:'fresh',order:'old',who:'me'},
  pick:{},tm:{},rv:0,badge:0,sd:null,sdirty:false,ai:{camp:'',queue:'fresh',n:10}};

const member=id=>S.team.find(m=>m.id===id);
const camp=id=>S.campaigns.find(c=>c.id===id);
const stage=id=>S.cfg.stages.find(s=>s.id===id);
const stageIdx=id=>Math.max(0,S.cfg.stages.findIndex(s=>s.id===id));
const stageColor=id=>id==='won'?'var(--s3)':id==='lost'?'var(--s7)':`var(--s${[1,2,6,4,5,8,2,6][stageIdx(id)%8]})`;
const dispo=id=>S.cfg.dispositions.find(d=>d.id===id);
const role=()=>S.me?.role||'telecaller';
const isMgr=()=>['admin','manager'].includes(role());
const isAdmin=()=>role()==='admin';
const agents=()=>S.team.filter(m=>m.active);
const nameOf=id=>id?(member(id)?.name||'Former member'):'Unassigned';
const callerOf=c=>c.source==='ai'?'AI agent':nameOf(c.agent_id);
const aiSetUp=()=>!!(S.cfg.ai&&S.cfg.ai.agentId);
const aiOn=()=>S.cfg.ai?.enabled!==false;
const aiReady=()=>aiSetUp()&&aiOn();
const stagePill=id=>`<span class="pill" style="color:${stageColor(id)}"><span class="dot"></span><span style="color:var(--fg)">${esc(stage(id)?.name||id||'New')}</span></span>`;
const prioLabel=p=>p?`<span class="small prio-${esc(p)}">● ${esc(p[0].toUpperCase()+p.slice(1))}</span>`:'';
const isOpen=l=>!['won','lost'].includes(l.stage);
const srcBadge=s=>s==='phone'?'<span class="src phone">Phone app</span>':s==='ai'?'<span class="src ai">AI agent</span>':'<span class="src">Logged by hand</span>';

/* ---------- toast / confirm / errors ---------- */
let toastT;
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3000)}
function fail(e){console.error(e);toast(e&&e.message?e.message:'Something went wrong. Try again.')}
function arm(btn,fn,label='Click again to confirm'){
  if(btn.dataset.armed){delete btn.dataset.armed;fn();return}
  const orig=btn.innerHTML;btn.dataset.armed='1';btn.textContent=label;
  setTimeout(()=>{if(btn.dataset.armed){delete btn.dataset.armed;btn.innerHTML=orig}},4000);
}
async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Copied')}catch(e){toast('Copy failed. Select the text and copy it.')}}
async function R(p){const r=await p;if(r.error)throw r.error;return r}
async function rpc(n,a){const{data,error}=await sb.rpc(n,a);if(error)throw error;return data}
async function fn(body){
  const{data,error}=await sb.functions.invoke('ai',{body});
  if(error){let m=error.message;try{const j=await error.context.json();if(j&&j.error)m=j.error}catch(_){}throw new Error(m)}
  if(data&&data.error)throw new Error(data.error);return data;
}
const loadingHTML='<div class="loading">Loading…</div>';

/* ---------- charts ---------- */
function niceMax(v){if(v<=4)return 4;const p=Math.pow(10,Math.floor(Math.log10(v)));const n=v/p;return (n<=2?2:n<=5?5:10)*p}
function barChart(b){
  const W=640,H=210,L=34,B=24,T=10,R_=6;const mx=niceMax(Math.max(1,...b.map(x=>x.a+x.b)));
  const iw=W-L-R_,ih=H-T-B,bw=iw/Math.max(1,b.length),gap=Math.min(10,bw*.3);const tk=mx%4===0?4:5;
  let g='';for(let k=0;k<=tk;k++){const v=mx*k/tk,y=T+ih-ih*k/tk;g+=`<line x1="${L}" x2="${W-R_}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${y+3}" text-anchor="end">${Math.round(v)}</text>`}
  const every=Math.ceil(b.length/12);
  b.forEach((x,i)=>{const X=L+i*bw+gap/2,w=bw-gap,ha=ih*x.a/mx,hb=ih*x.b/mx,y0=T+ih;
    g+=`<rect x="${X}" y="${y0-ha}" width="${w}" height="${ha}" fill="var(--call)" rx="2"><title>${esc(x.label)}: ${x.a} connected</title></rect><rect x="${X}" y="${y0-ha-hb}" width="${w}" height="${hb}" fill="var(--warn)" opacity=".75" rx="2"><title>${esc(x.label)}: ${x.b} not connected</title></rect>`;
    if(i%every===0)g+=`<text x="${X+w/2}" y="${H-6}" text-anchor="middle">${esc(x.label)}</text>`});
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calls over time">${g}</svg><div class="legend"><span><i style="background:var(--call)"></i>Connected</span><span><i style="background:var(--warn);opacity:.75"></i>Not connected</span></div></div>`;
}
function hbars(rows){const mx=Math.max(1,...rows.map(r=>r.v));
  return rows.map(r=>`<div class="hbar"><span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.label)}">${esc(r.label)}</span><div class="track"><div class="fill" style="width:${r.v/mx*100}%;background:${r.color||'var(--accent)'}"></div></div><span class="num small" style="text-align:right">${r.v}</span></div>`).join('')||'<p class="muted small">No data yet.</p>'}
function buckets(st,from,to){
  if(to-from<=DAY){const out=[];for(let h=8;h<=21;h++){const v=st.by_hour?.[h]||{a:0,b:0};out.push({label:(h%12||12)+(h<12?'a':'p'),a:v.a,b:v.b})}
    Object.entries(st.by_hour||{}).forEach(([h,v])=>{h=+h;if(h<8){out[0].a+=v.a;out[0].b+=v.b}if(h>21){out[13].a+=v.a;out[13].b+=v.b}});return out}
  const out=[];for(let t=from;t<to;t+=DAY){const v=st.by_day?.[ymd(t)]||{a:0,b:0};out.push({label:fmtD(t),a:v.a,b:v.b})}return out;
}

/* ---------- selects ---------- */
const opt=(v,l,sel)=>`<option value="${esc(v)}"${String(v)===String(sel??'')?' selected':''}>${esc(l)}</option>`;
const stageOpts=(sel,blank)=>(blank?opt('',blank,sel):'')+S.cfg.stages.map(s=>opt(s.id,s.name,sel)).join('');
const campOpts=(sel,blank)=>(blank?opt('',blank,sel):'')+S.campaigns.map(c=>opt(c.id,c.name,sel)).join('');
const agentOpts=(sel,blank)=>(blank?opt('',blank,sel):'')+agents().map(m=>opt(m.id,m.name,sel)).join('');
const srcOpts=(sel,blank)=>(blank?opt('',blank,sel):'')+[...new Set([...S.cfg.sources,...(S.lsNames||[])])].map(s=>opt(s,s,sel)).join('');
const prioOpts=(sel,blank)=>(blank?opt('',blank,sel):'')+opt('hot','Hot',sel)+opt('warm','Warm',sel)+opt('cold','Cold',sel);
const head=(title,sub,actions='')=>`<div class="page-head"><div><h1>${esc(title)}</h1>${sub?`<p class="muted">${sub}</p>`:''}</div><div class="row">${actions}</div></div>`;
const endToday=()=>sod(now())+DAY;

/* ---------- data operations ---------- */
async function addActivity(leadId,kind,text='',data={}){return R(sb.from('activities').insert({lead_id:leadId,actor_id:S.me.id,kind,text,data}))}
async function changeStage(l,to){if(!l||l.stage===to)return;await R(sb.from('leads').update({stage:to}).eq('id',l.id));await addActivity(l.id,'stage','',{from:l.stage,to})}
async function assignLeads(ids,to){if(!ids.length)return;for(const c of chunk(ids,200)){await R(sb.from('leads').update({assigned_to:to||null}).in('id',c));await R(sb.from('activities').insert(c.map(id=>({lead_id:id,actor_id:S.me.id,kind:'assign',data:{to:to||''}}))))}}
async function roundRobin(ids,agentIds){if(!agentIds.length)return toast('Pick at least one person');for(let k=0;k<agentIds.length;k++)await assignLeads(ids.filter((_,i)=>i%agentIds.length===k),agentIds[k]);toast(`${ids.length} leads shared between ${agentIds.length} people`)}
async function logManualCall(leadId,{outcome,secs,note,fu}){
  return R(sb.from('calls').insert({lead_id:leadId,agent_id:S.me.id,source:'manual',direction:'outgoing',started_at:iso(now()-(secs||0)*1000),duration:secs||0,outcome,note:note||'',follow_up_at:fu?iso(fu):null}));
}
async function updateBadge(){try{const s=await rpc('lead_summary',{p_agent:isMgr()?null:S.me.id,p_campaign:null,p_tz:TZ});S.badge=(s.overdue||0)+(s.today||0);renderNav()}catch(e){}}

/* ---------- views ---------- */
const V={};

/* HOME */
V.home={mount(){
  const hr=new Date().getHours();const greet=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
  const chips=[['0','Today'],['7','7 days'],['30','30 days']].map(([v,l])=>`<button class="chip-toggle" data-act="range" data-v="${v}" aria-pressed="${S.range===v}">${l}</button>`).join('');
  return head(`${greet}, ${S.me.name||'there'}`,new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}),chips+(isMgr()?`<select class="input" id="hAgent" style="width:auto" aria-label="Caller">${agentOpts(S.hAgent,'Whole team')}</select>`:''))+`<div id="vb">${loadingHTML}</div>`;
},async load(){
  const rv=S.rv;const to=endToday(),from=S.range==='0'?sod(now()):sod(now())-(+S.range-1)*DAY;
  const agent=isMgr()?(S.hAgent||null):S.me.id;
  const [st,ls,fu,inl]=await Promise.all([
    rpc('dashboard_stats',{p_from:iso(from),p_to:iso(to),p_agent:agent,p_campaign:null,p_tz:TZ}),
    rpc('lead_summary',{p_agent:agent,p_campaign:null,p_tz:TZ}),
    (()=>{let q=sb.from('leads').select('*').not('stage','in','(won,lost)').not('next_follow_up_at','is',null).lt('next_follow_up_at',iso(now()+7*DAY)).order('next_follow_up_at').limit(6);if(agent)q=q.eq('assigned_to',agent);return R(q)})(),
    // new leads that arrived in the period (the contact list of imported old data is not counted)
    fetchAll(()=>{let q=sb.from('leads').select('source').gte('created_at',iso(from)).lt('created_at',iso(to)).order('created_at');if(S.hasContacts)q=q.eq('contact_only',false);if(agent)q=q.eq('assigned_to',agent);return q})]);
  if(rv!==S.rv)return;const vb=$('#vb');if(!vb)return;
  const t=st.totals||{};let html='';
  {const by={};for(const l of inl){const k=(l.source||'').trim()||'Source not set';by[k]=(by[k]||0)+1}
   const col=k=>/facebook|instagram/i.test(k)?'#3a7bd5':/whatsapp|interakt/i.test(k)?'var(--call)':/google/i.test(k)?'var(--warn)':'var(--accent)';
   const rows=Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([label,v])=>({label,v,color:col(label)}));
   const per=S.range==='0'?'today':`in the last ${S.range} days`;
   html+=`<div class="card" style="margin-bottom:16px"><div class="row" style="align-items:flex-start;gap:24px;flex-wrap:wrap"><div style="min-width:180px"><h2 style="margin:0">Leads received</h2><div class="num" style="font-size:3rem;font-weight:700;line-height:1.1;margin-top:6px">${inl.length}</div><div class="small muted">${per}${agent?' · assigned to '+esc(nameOf(agent)):''}</div><button class="btn sm" data-act="nav" data-v="leads" style="margin-top:10px">Open Leads</button></div>
     <div class="hbar-wide" style="flex:1;min-width:260px"><div class="small muted" style="margin-bottom:6px">By source</div>${rows.length?hbars(rows):'<p class="muted small">No new leads in this period.</p>'}</div></div></div>`}
  if(!ls.total&&isMgr())html+=`<div class="card" style="margin-bottom:16px"><h2>Get your calling team started</h2><div class="grid3">
    <div><b>1. Invite your team</b><p class="muted small">Send them this website's link. They create an account and you approve them in Team.</p><button class="btn" data-act="nav" data-v="team">${ic('team')}Open Team</button></div>
    <div><b>2. Import leads</b><p class="muted small">Upload an Excel or CSV file and share the leads out to callers automatically.</p><button class="btn primary" data-act="import">${ic('up')}Import leads</button></div>
    <div><b>3. Install the phone app</b><p class="muted small">It logs every call and uploads recordings on its own. Get the connection code in Settings.</p><button class="btn" data-act="nav" data-v="settings">${ic('phone')}Phone app setup</button></div></div></div>`;
  html+=`<div class="kpis">
    <div class="kpi"><div class="lbl">Calls</div><div class="val">${t.n||0}</div><div class="sub">${t.auto||0} auto-logged · ${t.ai||0} by AI</div></div>
    <div class="kpi"><div class="lbl">Connected</div><div class="val">${t.conn||0}</div><div class="sub">${pct(t.n?t.conn/t.n:0)} connect rate</div></div>
    <div class="kpi"><div class="lbl">Talk time</div><div class="val">${dur(t.talk).replace(/ \d+s$/,'')}</div><div class="sub">avg ${dur(t.conn?t.talk/t.conn:0)} per call</div></div>
    <div class="kpi"><div class="lbl">Interested</div><div class="val">${t.intr||0}</div><div class="sub">${t.recorded||0} calls recorded</div></div>
    <div class="kpi"><div class="lbl">Converted</div><div class="val">${t.conv||0}</div><div class="sub">${t.conn?pct(t.conv/t.conn):'0%'} of connected</div></div>
    <div class="kpi ${ls.overdue?'alert':''}"><div class="lbl">Follow-ups due</div><div class="val">${(ls.overdue||0)+(ls.today||0)}</div><div class="sub">${ls.overdue||0} overdue</div></div></div>`;
  const drows=[...S.cfg.dispositions.map(d=>({label:d.name,v:st.outcomes?.[d.id]||0,color:d.connected?'var(--call)':'var(--warn)'})),{label:'Outcome not logged yet',v:st.outcomes?._none||0,color:'var(--muted)'}].filter(r=>r.v).sort((a,b)=>b.v-a.v);
  const srows=S.cfg.stages.map(s=>({label:s.name,v:ls.stages?.[s.id]?.n||0,color:stageColor(s.id)}));
  html+=`<div class="dash-grid"><div class="card"><h2>${S.range==='0'?'Calls by hour':'Calls per day'}</h2>${barChart(buckets(st,from,to))}</div>
    <div class="card"><h2>Call outcomes</h2>${hbars(drows)}</div>
    <div class="card"><h2>Lead pipeline</h2>${hbars(srows)}<p class="small muted">${ls.total} leads · ${inr(ls.stages?.won?.value)} won value · ${ls.fresh||0} never called</p></div>
    <div class="card"><h2>Next follow-ups</h2>${fuList(fu.data,true)}<button class="btn sm" data-act="nav" data-v="followups" style="margin-top:8px">See all follow-ups</button></div>`;
  if(isMgr()&&!S.hAgent){
    const rows=[...agents().map(m=>({name:m.name,sub:m.role,s:st.by_agent?.[m.id]||{}})),...(st.by_agent?.ai?[{name:'AI agent',sub:'voice AI',s:st.by_agent.ai}]:[])].sort((a,b)=>(b.s.n||0)-(a.s.n||0));
    html+=`<div class="card wide"><h2>Team leaderboard</h2><div class="tbl-wrap"><table><thead><tr><th>Caller</th><th class="r">Calls</th><th class="r">Connected</th><th class="r hide-sm">Connect %</th><th class="r">Talk time</th><th class="r hide-sm">Interested</th><th class="r">Converted</th></tr></thead><tbody>${rows.map(({name,sub,s})=>`<tr><td><b>${esc(name)}</b> <span class="small muted">${esc(sub)}</span></td><td class="r num">${s.n||0}</td><td class="r num">${s.conn||0}</td><td class="r num hide-sm">${pct(s.n?s.conn/s.n:0)}</td><td class="r num">${dur(s.talk)}</td><td class="r num hide-sm">${s.intr||0}</td><td class="r num">${s.conv||0}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  vb.innerHTML=html+'</div>';
}};
function fuList(list,compact){
  if(!list||!list.length)return '<p class="muted small">Nothing scheduled.</p>';
  return `<div class="list">${list.map(l=>{const f=ts(l.next_follow_up_at),late=f<now();return `<div class="li"><div class="grow"><div class="lead-name">${esc(l.name||'Unnamed')} ${prioLabel(l.priority)}</div><div class="lead-phone">${esc(l.phone)}${!compact&&isMgr()?' · '+esc(nameOf(l.assigned_to)):''}</div>${!compact&&l.last_outcome?`<div class="small muted">Last: ${esc(dispo(l.last_outcome)?.name||l.last_outcome)}</div>`:''}</div>
    <span class="small ${late?'prio-hot':'muted'}">${late?'Overdue ':''}${esc(fmtDT(f))}</span>
    <a class="btn sm call" href="tel:${esc(normPhone(l.phone))}">${ic('phone')}Call</a><button class="btn sm" data-act="lead" data-id="${l.id}">Open</button></div>`}).join('')}</div>`;
}

/* LEADS */
function leadQuery(select='*',opts){
  let q=sb.from('leads').select(select,opts);const f=S.lf;
  if(!isMgr())q=q.eq('assigned_to',S.me.id);
  if(f.stage)q=q.eq('stage',f.stage);
  if(f.camp)q=f.camp==='_none'?q.is('campaign_id',null):q.eq('campaign_id',f.camp);
  if(f.agent)q=f.agent==='_none'?q.is('assigned_to',null):q.eq('assigned_to',f.agent);
  if(f.source)q=q.eq('source',f.source);
  if(f.prio)q=q.eq('priority',f.prio);
  if(f.lang)q=f.lang==='_none'?q.eq('language',''):q.eq('language',f.lang);
  if(f.fu==='due')q=q.lt('next_follow_up_at',iso(endToday())).not('stage','in','(won,lost)');
  if(f.fu==='over')q=q.lt('next_follow_up_at',iso(now())).not('stage','in','(won,lost)');
  if(f.fu==='fresh')q=q.eq('call_count',0);
  if(f.fu==='contacts')q=q.eq('contact_only',true).eq('dnd',false);
  if(S.hasContacts&&!['contacts','dnd','all'].includes(f.fu)&&!f.q.trim())q=q.eq('contact_only',false); // the contact list is hidden unless asked for or searched
  if(f.fu==='dnd')q=q.eq('dnd',true);
  const s=f.q.replace(/[%,()*\\"]/g,' ').trim();
  if(s){const d=s.replace(/\D/g,'');const lc=s.toLowerCase();const camps=S.campaigns.filter(c=>c.name.toLowerCase().includes(lc)).map(c=>c.id);
    // name, phone, city, company, email, course (tags), notes, source and campaign name
    q=q.or([`name.ilike.%${s}%`,`city.ilike.%${s}%`,`company.ilike.%${s}%`,`email.ilike.%${s}%`,`source.ilike.%${s}%`,`note.ilike.%${s}%`,...(S.hasTagsText?[`tags_text.ilike.%${s}%`]:[]),...(camps.length?[`campaign_id.in.(${camps.join(',')})`]:[]),...(d.length>=3?[`phone_key.like.%${d}%`]:[])].join(','))}
  return q;
}
V.leads={mount(){const f=S.lf;
  return head('Leads','<span id="lcount">&nbsp;</span>',`<button class="btn" data-act="import">${ic('up')}Import</button><button class="btn" data-act="exportLeads">${ic('down')}Export</button><button class="btn primary" data-act="addLead">${ic('plus')}Add lead</button>`)+
  `<div class="toolbar"><input class="input" id="lq" type="search" placeholder="Search name, phone, city, course, notes" value="${esc(f.q)}" aria-label="Search leads">
   <select class="input" id="lf-stage" aria-label="Stage">${stageOpts(f.stage,'All stages')}</select>
   <select class="input" id="lf-camp" aria-label="Campaign">${campOpts(f.camp,'All campaigns')}${opt('_none','No campaign',f.camp)}</select>
   ${isMgr()?`<select class="input" id="lf-agent" aria-label="Assigned to">${agentOpts(f.agent,'Anyone')}${opt('_none','Unassigned',f.agent)}</select>`:''}
   <select class="input" id="lf-source" aria-label="Source">${srcOpts(f.source,'All sources')}</select>
   <select class="input" id="lf-prio" aria-label="Priority">${prioOpts(f.prio,'Any priority')}</select>
   <select class="input" id="lf-lang" aria-label="Language">${langOpts(f.lang,'Any language')}${opt('_none','Language not set',f.lang)}</select>
   <select class="input" id="lf-fu" aria-label="Status">${opt('','Any status',f.fu)}${opt('fresh','Never called',f.fu)}${opt('due','Follow-up due today',f.fu)}${opt('over','Follow-up overdue',f.fu)}${S.hasContacts&&isMgr()?opt('contacts','Contact list (old data), can be messaged',f.fu)+opt('all','Everything, including the contact list',f.fu):''}${opt('dnd','Do not contact',f.fu)}</select></div><div id="vb">${loadingHTML}</div>`;
},async load(){
  const rv=S.rv;const from=S.page*S.PS;
  const {data,count}=await R(leadQuery('*',{count:'exact'}).order('updated_at',{ascending:false}).range(from,from+S.PS-1));
  if(rv!==S.rv)return;S.pageLeads=data;const vb=$('#vb');if(!vb)return;
  const lc=$('#lcount');if(lc)lc.textContent=`${count} ${S.lf.q||Object.values(S.lf).some(Boolean)?'matching leads':isMgr()?'leads in total':'leads assigned to you'}`;
  let html='';
  if(S.sel.size&&isMgr())html+=`<div class="bulk"><b>${S.sel.size} selected</b>
    <select id="bk-agent" aria-label="Assign to"><option value="">Assign to…</option>${agents().map(m=>opt(m.id,m.name)).join('')}<option value="_rr">Share equally among telecallers</option><option value="_none">Unassign</option></select>
    <select id="bk-stage" aria-label="Move to stage"><option value="">Move to stage…</option>${S.cfg.stages.map(s=>opt(s.id,s.name)).join('')}</select>
    <select id="bk-camp" aria-label="Campaign"><option value="">Add to campaign…</option>${S.campaigns.map(c=>opt(c.id,c.name)).join('')}<option value="_none">Remove campaign</option></select>
    <span class="spacer"></span><button class="btn sm" data-act="bkAuto">Assign by rules</button><button class="btn sm" data-act="bkDial">${ic('phone')}Call these</button>${aiReady()?`<button class="btn sm" data-act="bkAI">${ic('spark')}AI call these</button>`:''}<button class="btn sm danger" data-act="bkDel" style="background:var(--surface)">Delete</button><button class="btn sm ghost" data-act="bkClear" style="color:var(--bg)">Clear</button></div>`;
  if(!data.length){vb.innerHTML=html+`<div class="empty"><h3>${count===0&&!Object.values(S.lf).some(Boolean)?'No leads yet':'No leads match these filters'}</h3><p>${isMgr()?'Import an Excel or CSV file, or add a lead by hand.':'Your manager has not assigned leads to you yet, or none match.'}</p></div>`;return}
  const all=data.every(l=>S.sel.has(l.id));const pages=Math.ceil(count/S.PS);
  html+=`<div class="tbl-wrap"><table><thead><tr>${isMgr()?`<th style="width:34px"><input type="checkbox" id="selAll" aria-label="Select all on this page" ${all?'checked':''}></th>`:''}<th>Lead</th><th>Stage</th>${isMgr()?'<th class="hide-sm">Assigned</th>':''}<th class="hide-sm">Campaign</th><th>Last call</th><th>Follow-up</th><th class="r hide-sm">Calls</th></tr></thead><tbody>
  ${data.map(l=>{const fu=ts(l.next_follow_up_at);return `<tr class="click" data-act="lead" data-id="${l.id}">${isMgr()?`<td><input type="checkbox" class="selOne" data-id="${l.id}" aria-label="Select ${esc(l.name)}" ${S.sel.has(l.id)?'checked':''}></td>`:''}
   <td><div class="lead-name">${esc(l.name||'Unnamed')} ${prioLabel(l.priority)}${l.language?` <span class="tag">${esc(l.language)}</span>`:''}${l.dnd?' <span class="tag">Do not contact</span>':''}${l.contact_only?' <span class="tag">Contact list</span>':''}</div><div class="lead-phone">${esc(l.phone)}${l.city?' · '+esc(l.city):''}</div>${(l.tags||[]).length?`<div class="row" style="gap:4px;margin-top:3px">${l.tags.slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`:''}</td>
   <td>${stagePill(l.stage)}</td>${isMgr()?`<td class="hide-sm">${esc(nameOf(l.assigned_to))}</td>`:''}<td class="hide-sm small">${esc(camp(l.campaign_id)?.name||'—')}</td>
   <td class="small">${l.last_call_at?`${esc(dispo(l.last_outcome)?.name||l.last_outcome||'Outcome not logged')}<div class="muted">${rel(l.last_call_at)}</div>`:'<span class="muted">Not called</span>'}</td>
   <td class="small ${fu&&fu<now()&&isOpen(l)?'prio-hot':''}">${fu&&isOpen(l)?esc(fmtDT(fu)):'<span class="muted">—</span>'}</td><td class="r num hide-sm">${l.call_count||0}</td></tr>`}).join('')}
  </tbody></table></div><div class="pager"><button class="btn sm" data-act="pg" data-v="-1" ${S.page?'':'disabled'}>Previous</button><span class="small muted">Page ${S.page+1} of ${pages} · ${count} leads</span><button class="btn sm" data-act="pg" data-v="1" ${S.page+1<pages?'':'disabled'}>Next</button></div>`;
  vb.innerHTML=html;
}};

/* FOLLOW-UPS */
V.followups={mount(){
  return head('Follow-ups','Callbacks you promised, sorted by time.',`${isMgr()?`<select class="input" id="fuAgent" style="width:auto" aria-label="Caller">${agentOpts(S.fuAgent,'Whole team')}</select>`:''}<button class="btn call" data-act="fuDial">${ic('phone')}Call all due now</button>`)+`<div id="vb">${loadingHTML}</div>`;
},async load(){
  const rv=S.rv;const agent=isMgr()?S.fuAgent:S.me.id;
  const base=()=>{let q=sb.from('leads').select('*').not('stage','in','(won,lost)').not('next_follow_up_at','is',null).order('next_follow_up_at').limit(200);if(agent)q=q.eq('assigned_to',agent);return q};
  const n=iso(now()),e=iso(endToday()),w=iso(endToday()+7*DAY);
  const [o,t,u]=await Promise.all([R(base().lt('next_follow_up_at',n)),R(base().gte('next_follow_up_at',n).lt('next_follow_up_at',e)),R(base().gte('next_follow_up_at',e).lt('next_follow_up_at',w))]);
  if(rv!==S.rv)return;const vb=$('#vb');if(!vb)return;
  vb.innerHTML=`<div class="fu-sec"><h2>Overdue <span class="badge">${o.data.length}</span></h2>${fuList(o.data)}</div><div class="fu-sec"><h2>Today <span class="pill">${t.data.length}</span></h2>${fuList(t.data)}</div><div class="fu-sec"><h2>Next 7 days <span class="pill">${u.data.length}</span></h2>${fuList(u.data)}</div>`;
}};

/* PIPELINE */
V.pipeline={mount(){
  return head('Pipeline','Drag a card to move the lead to another stage.',`<select class="input" id="pfCamp" style="width:auto" aria-label="Campaign">${campOpts(S.pf.camp,'All campaigns')}</select>${isMgr()?`<select class="input" id="pfAgent" style="width:auto" aria-label="Caller">${agentOpts(S.pf.agent,'Anyone')}</select>`:''}`)+`<div id="vb">${loadingHTML}</div>`;
},async load(){
  const rv=S.rv;const agent=isMgr()?(S.pf.agent||null):S.me.id;
  const summ=await rpc('lead_summary',{p_agent:agent,p_campaign:S.pf.camp||null,p_tz:TZ});
  const cols=await Promise.all(S.cfg.stages.map(s=>{let q=sb.from('leads').select('*').eq('stage',s.id).order('updated_at',{ascending:false}).limit(40);if(agent)q=q.eq('assigned_to',agent);if(S.pf.camp)q=q.eq('campaign_id',S.pf.camp);return R(q).then(r=>r.data)}));
  if(rv!==S.rv)return;const vb=$('#vb');if(!vb)return;
  vb.innerHTML=`<div class="kanban">${S.cfg.stages.map((s,i)=>{const ls=cols[i],n=summ.stages?.[s.id]?.n||0,val=summ.stages?.[s.id]?.value||0;
    return `<div class="col" data-stage="${s.id}"><div class="col-head"><span style="color:${stageColor(s.id)}">● <span style="color:var(--fg)">${esc(s.name)}</span></span><span class="small muted num">${n}${val?' · '+inr(val):''}</span></div>
    ${ls.map(l=>`<div class="kcard" draggable="true" data-id="${l.id}" data-act="lead"><b>${esc(l.name||'Unnamed')}</b><span class="lead-phone">${esc(l.phone)}</span><span class="small muted">${isMgr()?esc(nameOf(l.assigned_to))+' · ':''}${l.next_follow_up_at&&isOpen(l)?'Follow-up '+esc(fmtD(l.next_follow_up_at)):l.last_call_at?'Called '+rel(l.last_call_at):'Not called'}</span>${+l.value?`<span class="small num">${inr(l.value)}</span>`:''}</div>`).join('')}
    ${n>ls.length?`<button class="btn sm" data-act="stageLeads" data-v="${s.id}">+${n-ls.length} more in Leads</button>`:''}</div>`}).join('')}</div>`;
}};

/* CAMPAIGNS */
V.campaigns={mount(){
  return head('Campaigns','Group leads by product or ad. Each campaign has its own call script and can use its own AI agent.',isMgr()?`<button class="btn primary" data-act="campEdit">${ic('plus')}New campaign</button>`:'')+`<div id="vb">${loadingHTML}</div>`;
},async load(){
  const rv=S.rv;const st=await rpc('campaign_stats',{});if(rv!==S.rv)return;const vb=$('#vb');if(!vb)return;
  if(!S.campaigns.length){vb.innerHTML=`<div class="empty"><h3>No campaigns yet</h3><p>Create one for each product or lead source you call for, then add its call script.</p></div>`;return}
  vb.innerHTML=`<div class="grid2">${S.campaigns.map(c=>{const s=st[c.id]||{n:0,called:0,intr:0,won:0,due:0};
    return `<div class="card"><div class="row"><h2 style="margin:0">${esc(c.name)}</h2><span class="spacer"></span><span class="pill" style="color:${c.active?'var(--call)':'var(--muted)'}"><span class="dot"></span><span style="color:var(--fg)">${c.active?'Active':'Paused'}</span></span></div>
    ${c.description?`<p class="muted small">${esc(c.description)}</p>`:''}
    <div class="grid3" style="margin:12px 0"><div><div class="small muted">Leads</div><b class="num">${s.n}</b></div><div><div class="small muted">Interested</div><b class="num">${s.intr}</b></div><div><div class="small muted">Converted</div><b class="num">${s.won}</b></div></div>
    <div class="small muted">${s.called} of ${s.n} called · ${s.due} follow-ups due${c.ai_agent_id?' · own AI agent':''}</div><div class="progress" style="margin:6px 0 12px"><div style="width:${s.n?s.called/s.n*100:0}%"></div></div>
    <div class="row"><button class="btn sm call" data-act="campDial" data-id="${c.id}">${ic('phone')}Start calling</button><button class="btn sm" data-act="campLeads" data-id="${c.id}">View leads</button>${isMgr()?`<button class="btn sm ghost" data-act="campEdit" data-id="${c.id}">${ic('edit')}Edit</button>`:''}</div></div>`}).join('')}</div>`;
}};
function campModal(id){
  const c=id?camp(id):{name:'',description:'',script:'',ai_agent_id:'',active:true};
  modal(`<h2>${id?'Edit campaign':'New campaign'}</h2><form id="campForm" style="display:flex;flex-direction:column;gap:12px;margin-top:14px">
  <label class="field"><span>Name</span><input class="input" id="cName" required value="${esc(c.name)}"></label>
  <label class="field"><span>Description</span><input class="input" id="cDesc" value="${esc(c.description)}"></label>
  <label class="field"><span>Call script</span><textarea class="input" id="cScript" rows="8" placeholder="Opening line, questions, objections and answers. {name} becomes the lead's first name.">${esc(c.script)}</textarea></label>
  <label class="field"><span>Language of these leads (optional)</span><select class="input" id="cLang">${langOpts(c.language||'','Mixed / not set')}</select></label>
  <label class="field"><span>AI agent ID for this campaign (optional)</span><input class="input mono" id="cAgent" value="${esc(c.ai_agent_id)}" placeholder="Leave empty to use the default from Settings"></label>
  <label class="row"><input type="checkbox" id="cActive" ${c.active?'checked':''}> Active</label>
  <div class="row"><button class="btn primary" type="submit">Save campaign</button><button class="btn" type="button" data-act="closeMd">Cancel</button>${id?`<span class="spacer"></span><button class="btn danger" type="button" data-act="campDel" data-id="${id}">Delete</button>`:''}</div></form>`);
  $('#campForm').onsubmit=async e=>{e.preventDefault();const d={name:$('#cName').value.trim(),description:$('#cDesc').value.trim(),script:$('#cScript').value,ai_agent_id:$('#cAgent').value.trim(),language:$('#cLang').value,active:$('#cActive').checked};if(!d.name)return;
    try{if(id)await R(sb.from('campaigns').update(d).eq('id',id));else await R(sb.from('campaigns').insert(d));await loadBase();closeModal();toast('Campaign saved');render()}catch(err){fail(err)}};
}

/* TEAM */
V.team={mount(){
  return head('Team','Your callers and managers.',isMgr()?`<button class="btn" data-act="autoAll">Assign unassigned by rules</button><button class="btn" data-act="distribute">Share out leads</button>`:'')+`<div id="vb">${loadingHTML}</div>`;
},async load(){
  const rv=S.rv;await loadBase();
  const t0=sod(now()),t1=endToday();
  const [a,b,wc]=await Promise.all([rpc('dashboard_stats',{p_from:iso(t0),p_to:iso(t1),p_agent:null,p_campaign:null,p_tz:TZ}),rpc('dashboard_stats',{p_from:iso(t0-6*DAY),p_to:iso(t1),p_agent:null,p_campaign:null,p_tz:TZ}),workCalls(t0,t1,null)]);
  const wk=Object.fromEntries(workDays(wc).map(d=>[d.agent,d]));
  if(rv!==S.rv)return;const vb=$('#vb');if(!vb)return;
  const pending=S.team.filter(m=>!m.active),act=S.team.filter(m=>m.active);
  let html='';
  if(pending.length&&isAdmin())html+=`<div class="card" style="margin-bottom:16px"><h2>Waiting for approval</h2><div class="list">${pending.map(m=>`<div class="li"><div class="grow"><b>${esc(m.name)}</b><div class="small muted">${esc(m.email||'')} · signed up ${esc(fmtD(m.created_at))}</div></div><select class="input" style="width:auto" id="ap-${m.id}" aria-label="Role">${opt('telecaller','Telecaller')}${opt('manager','Manager')}${opt('admin','Admin')}</select><button class="btn sm primary" data-act="approve" data-id="${m.id}">Approve</button><button class="btn sm danger" data-act="memberDel" data-id="${m.id}">Reject</button></div>`).join('')}</div></div>`;
  html+=`<div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Role</th><th class="hide-sm">Languages</th><th class="r">Calls today</th><th class="r hide-sm">Today: first call · last call</th><th class="r hide-sm">Idle today</th><th class="r hide-sm">Calls 7d</th><th class="r hide-sm">Connect % 7d</th><th class="r hide-sm">Talk 7d</th><th class="r hide-sm">Converted 7d</th><th></th></tr></thead><tbody>
  ${act.map(m=>{const s1=a.by_agent?.[m.id]||{},s7=b.by_agent?.[m.id]||{};return `<tr><td><b>${esc(m.name)}</b>${m.id===S.me.id?' <span class="tag">You</span>':''}<div class="small muted">${esc(m.email||'')}${m.phone?' · '+esc(m.phone):''}</div></td><td>${esc(m.role)}</td><td class="hide-sm small">${(m.languages||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join(' ')||'<span class="muted">—</span>'}</td><td class="r num">${s1.n||0}</td><td class="r num hide-sm small">${wk[m.id]?`${esc(fmtTm(wk[m.id].first))} · ${esc(rel(wk[m.id].last))}`:'<span class="muted">—</span>'}</td><td class="r num hide-sm">${wk[m.id]?dur(wk[m.id].idle):'<span class="muted">—</span>'}</td><td class="r num hide-sm">${s7.n||0}</td><td class="r num hide-sm">${pct(s7.n?s7.conn/s7.n:0)}</td><td class="r num hide-sm">${dur(s7.talk)}</td><td class="r num hide-sm">${s7.conv||0}</td><td>${isAdmin()||m.id===S.me.id?`<button class="btn sm ghost" data-act="memberEdit" data-id="${m.id}">${ic('edit')}Edit</button>`:''}</td></tr>`}).join('')}</tbody></table></div>
  <p class="small muted" style="margin-top:10px">To add someone, send them this website's address. They choose “Create account”, and you approve them here. Then they install the phone app and sign in with the same email and password.</p>`;
  vb.innerHTML=html;
}};
function memberModal(id){
  const m=member(id);if(!m)return;const self=m.id===S.me.id;
  modal(`<h2>Edit ${esc(m.name)}</h2><form id="mForm" style="display:flex;flex-direction:column;gap:12px;margin-top:14px">
  <label class="field"><span>Full name</span><input class="input" id="mName" required value="${esc(m.name)}"></label>
  <label class="field"><span>Phone</span><input class="input" id="mPhone" value="${esc(m.phone||'')}" inputmode="tel"></label>
  <div class="field"><span>Languages they speak (used to assign leads)</span><div class="row">${(S.cfg.languages||[]).map(x=>`<label class="row small" style="gap:4px"><input type="checkbox" class="mLang" value="${esc(x)}" ${(m.languages||[]).includes(x)?'checked':''} ${isAdmin()?'':'disabled'}>${esc(x)}</label>`).join('')}</div></div>
  ${isAdmin()?`<label class="field"><span>Role</span><select class="input" id="mRole">${opt('telecaller','Telecaller – sees only their own leads',m.role)}${opt('manager','Manager – sees all leads and reports',m.role)}${opt('admin','Admin – also approves people and changes settings',m.role)}</select></label>
  ${self?'':`<label class="row"><input type="checkbox" id="mActive" ${m.active?'checked':''}> Can sign in (untick to block access)</label>`}`:''}
  <div class="row"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-act="closeMd">Cancel</button>${isAdmin()&&!self?`<span class="spacer"></span><button class="btn danger" type="button" data-act="memberDel" data-id="${m.id}">Remove</button>`:''}</div></form>`);
  $('#mForm').onsubmit=async e=>{e.preventDefault();const d={name:$('#mName').value.trim(),phone:$('#mPhone').value.trim()};
    if(isAdmin()){d.languages=$$('.mLang:checked').map(x=>x.value);d.role=$('#mRole').value;if($('#mActive'))d.active=$('#mActive').checked}
    try{await R(sb.from('profiles').update(d).eq('id',m.id));await loadBase();closeModal();toast('Saved');render()}catch(err){fail(err)}};
}
function distributeModal(){
  modal(`<h2>Share out leads</h2><p class="muted small">Give leads to callers one by one in turn, so everyone gets an equal share.</p><div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
  <label class="field"><span>Which leads</span><select class="input" id="dsWhich">${opt('unassigned','Unassigned leads')}${opt('fresh','All leads never called')}${opt('open','All open leads (reassign)')}</select></label>
  <label class="field"><span>Campaign</span><select class="input" id="dsCamp">${campOpts('','Any campaign')}</select></label>
  <div class="field"><span>Give to</span>${agents().map(m=>`<label class="row"><input type="checkbox" class="dsA" value="${m.id}" ${m.role==='telecaller'?'checked':''}> ${esc(m.name)} <span class="small muted">${esc(m.role)}</span></label>`).join('')}</div>
  <div class="row"><button class="btn primary" data-act="dsRun">Share out</button><button class="btn" data-act="closeMd">Cancel</button></div></div>`);
}

/* WORKING TIME: first/last call, talk and idle time per caller per day (phone app and logged calls, not AI) */
const BREAK_SECS=15*60;
const fmtTm=t=>t?new Date(t).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}):'';
async function workCalls(from,to,agent){const out=[];for(let i=0;;i+=1000){let q=sb.from('calls').select('agent_id,started_at,duration').neq('source','ai').not('agent_id','is',null).gte('started_at',iso(from)).lt('started_at',iso(to)).order('started_at').range(i,i+999);if(agent)q=q.eq('agent_id',agent);const {data}=await R(q);out.push(...data);if(data.length<1000)break}return out}
function workDays(calls){const g={};for(const c of calls){const st=ts(c.started_at),k=c.agent_id+'|'+sod(st);(g[k]||(g[k]={agent:c.agent_id,day:sod(st),list:[]})).list.push([st,st+(c.duration||0)*1000])}
  return Object.values(g).map(d=>{d.list.sort((a,b)=>a[0]-b[0]);const first=d.list[0][0];let end=first,talk=0,idle=0,longest=0,breaks=0;
    for(const [st,en] of d.list){const gap=Math.max(0,st-end)/1000;idle+=gap;if(gap>longest)longest=gap;if(gap>=BREAK_SECS)breaks++;talk+=(en-st)/1000;if(en>end)end=en}
    return {agent:d.agent,day:d.day,first,last:end,calls:d.list.length,talk,idle,longest,breaks,span:(end-first)/1000}}).sort((a,b)=>b.day-a.day||nameOf(a.agent).localeCompare(nameOf(b.agent)))}
function exportWork(){const w=S.repWork;if(!w)return;saveCSV(`working-time-${toDateInput(S.rep.from)}-to-${toDateInput(S.rep.to)}.csv`,[['Date','Caller','First call','Last call ended','Calls','Talk time (min)','Idle time (min)','Idle %','Longest gap (min)','Breaks of 15 min+'],...w.map(d=>[toDateInput(d.day),nameOf(d.agent),fmtTm(d.first),fmtTm(d.last),d.calls,Math.round(d.talk/60),Math.round(d.idle/60),d.span?Math.round(d.idle/d.span*100):0,Math.round(d.longest/60),d.breaks])])}

/* CONVERSIONS: per caller by month and by program (campaign). A conversion is a lead moved to the "won" stage,
   credited to whoever moved it (by a call outcome or by hand). Conversion % = converted leads ÷ different leads they called. */
async function allRows(mk){const out=[];for(let i=0;;i+=1000){const {data}=await R(mk().range(i,i+999));out.push(...data);if(data.length<1000)break}return out}
const monthKey=t=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
const monthName=k=>new Date(k+'-01T00:00').toLocaleDateString('en-IN',{month:'short',year:'numeric'});
const progName=id=>id?(camp(id)?.name||'Other program'):'No program';
async function convData(from,to,agent,campId){
  const [wins,called]=await Promise.all([
    allRows(()=>{let q=sb.from('activities').select('lead_id,actor_id,created_at,lead:leads(campaign_id,value)').eq('kind','stage').eq('data->>to','won').not('actor_id','is',null).gte('created_at',iso(from)).lt('created_at',iso(to)).order('created_at');if(agent)q=q.eq('actor_id',agent);return q}),
    allRows(()=>{let q=sb.from('calls').select('agent_id,lead_id,started_at,lead:leads(campaign_id)').neq('source','ai').not('agent_id','is',null).gte('started_at',iso(from)).lt('started_at',iso(to)).order('started_at');if(agent)q=q.eq('agent_id',agent);return q})]);
  const g={month:{},prog:{}};
  const row=(kind,key,agentId,label)=>{const k=key+'|'+agentId;return g[kind][k]||(g[kind][k]={key,label,agent:agentId,called:new Set(),won:new Set(),value:0})};
  for(const c of called){const pc=c.lead?.campaign_id||'';if(campId&&pc!==campId)continue;
    row('month',monthKey(c.started_at),c.agent_id,monthName(monthKey(c.started_at))).called.add(c.lead_id);row('prog',pc,c.agent_id,progName(pc)).called.add(c.lead_id)}
  for(const w of wins){const pc=w.lead?.campaign_id||'';if(campId&&pc!==campId)continue;
    for(const r of [row('month',monthKey(w.created_at),w.actor_id,monthName(monthKey(w.created_at))),row('prog',pc,w.actor_id,progName(pc))])if(!r.won.has(w.lead_id)){r.won.add(w.lead_id);r.value+=+w.lead?.value||0}}
  const fin=o=>Object.values(o).map(r=>({...r,called:r.called.size,won:r.won.size}));
  return {month:fin(g.month).sort((a,b)=>b.key.localeCompare(a.key)||b.won-a.won),prog:fin(g.prog).sort((a,b)=>a.label.localeCompare(b.label)||b.won-a.won)};
}
function convTable(rows,first){return `<div class="tbl-wrap"><table><thead><tr><th>${first}</th><th>Caller</th><th class="r">Leads called</th><th class="r">Converted</th><th class="r">Conversion %</th><th class="r">Value</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${esc(r.label)}</td><td><b>${esc(nameOf(r.agent))}</b></td><td class="r num">${r.called}</td><td class="r num">${r.won}</td><td class="r num">${r.called?pct(r.won/r.called):'—'}</td><td class="r num">${r.value?inr(r.value):'—'}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No calls or conversions in this range.</td></tr>'}</tbody></table></div>`}
function exportConv(){const c=S.repConv;if(!c)return;const line=(kind,r)=>[kind,r.label,nameOf(r.agent),r.called,r.won,r.called?Math.round(r.won/r.called*100):'',r.value||0];
  saveCSV(`conversions-${toDateInput(S.rep.from)}-to-${toDateInput(S.rep.to)}.csv`,[['By','Month / program','Caller','Leads called','Converted','Conversion %','Value (₹)'],...c.month.map(r=>line('Month',r)),...c.prog.map(r=>line('Program',r))])}

/* REPORTS */
function callsQuery(){
  const r=S.rep;const inner=!!r.camp;
  let q=sb.from('calls').select(`*, lead:leads${inner?'!inner':''}(id,name,phone,campaign_id,source)`).gte('started_at',iso(r.from)).lt('started_at',iso(r.to+DAY));
  const agent=isMgr()?r.agent:S.me.id;if(agent)q=q.eq('agent_id',agent);if(r.camp)q=q.eq('lead.campaign_id',r.camp);
  return q.order('started_at',{ascending:false});
}
V.reports={mount(){const r=S.rep;
  return head('Reports','Calling performance for any date range.',`<button class="btn" data-act="expCalls">${ic('down')}Call log CSV</button><button class="btn" data-act="expAgents">${ic('down')}Summary CSV</button><button class="btn" data-act="expWork">${ic('down')}Working time CSV</button><button class="btn" data-act="expConv">${ic('down')}Conversions CSV</button>`)+
  `<div class="toolbar"><label class="field" style="flex:0 1 160px"><span>Quick range</span><select class="input" id="rPreset">${opt('','Custom')}${opt('m0','This month')}${opt('m1','Last month')}${opt('m3','Last 3 months')}${opt('m6','Last 6 months')}${opt('y0','This year')}</select></label><label class="field" style="flex:0 1 160px"><span>From</span><input class="input" type="date" id="rFrom" value="${toDateInput(r.from)}"></label><label class="field" style="flex:0 1 160px"><span>To</span><input class="input" type="date" id="rTo" value="${toDateInput(r.to)}"></label>
  ${isMgr()?`<label class="field" style="flex:0 1 180px"><span>Caller</span><select class="input" id="rAgent">${agentOpts(r.agent,'Whole team')}</select></label>`:''}<label class="field" style="flex:0 1 180px"><span>Campaign</span><select class="input" id="rCamp">${campOpts(r.camp,'All campaigns')}</select></label></div><div id="vb">${loadingHTML}</div>`;
},async load(){
  const rv=S.rv;const r=S.rep;const from=r.from,to=r.to+DAY;
  const [st,cl,wc,cv]=await Promise.all([rpc('dashboard_stats',{p_from:iso(from),p_to:iso(to),p_agent:isMgr()?(r.agent||null):S.me.id,p_campaign:r.camp||null,p_tz:TZ}),R(callsQuery().limit(200)),workCalls(from,to,isMgr()?(r.agent||null):S.me.id),convData(from,to,isMgr()?(r.agent||null):S.me.id,r.camp||null)]);
  if(rv!==S.rv)return;const vb=$('#vb');if(!vb)return;S.repStats=st;const work=S.repWork=workDays(wc);S.repConv=cv;
  const t=st.totals||{};const ag=[...(isMgr()?(r.agent?S.team.filter(m=>m.id===r.agent):agents()):[S.me]).map(m=>({name:m.name,s:st.by_agent?.[m.id]||{}})),...(st.by_agent?.ai&&!r.agent?[{name:'AI agent',s:st.by_agent.ai}]:[])];
  vb.innerHTML=`<div class="kpis"><div class="kpi"><div class="lbl">Calls</div><div class="val">${t.n||0}</div><div class="sub">${t.auto||0} phone app · ${t.ai||0} AI</div></div><div class="kpi"><div class="lbl">Connected</div><div class="val">${t.conn||0}</div><div class="sub">${pct(t.n?t.conn/t.n:0)}</div></div><div class="kpi"><div class="lbl">Talk time</div><div class="val">${dur(t.talk).replace(/ \d+s$/,'')}</div><div class="sub">avg ${dur(t.conn?t.talk/t.conn:0)}</div></div><div class="kpi"><div class="lbl">Converted</div><div class="val">${t.conv||0}</div></div><div class="kpi"><div class="lbl">Recorded</div><div class="val">${t.recorded||0}</div><div class="sub">calls with audio</div></div></div>
  <div class="card" style="margin-bottom:16px"><h2>${to-from<=DAY?'Calls by hour':'Calls per day'}</h2>${barChart(buckets(st,from,to))}</div>
  <div class="card" style="margin-bottom:16px"><h2>Caller performance</h2><div class="tbl-wrap"><table><thead><tr><th>Caller</th><th class="r">Calls</th><th class="r">Connected</th><th class="r">Connect %</th><th class="r">Talk time</th><th class="r">Avg call</th><th class="r">Interested</th><th class="r">Converted</th><th class="r">Follow-ups</th></tr></thead><tbody>
  ${ag.map(({name,s})=>`<tr><td><b>${esc(name)}</b></td><td class="r num">${s.n||0}</td><td class="r num">${s.conn||0}</td><td class="r num">${pct(s.n?s.conn/s.n:0)}</td><td class="r num">${dur(s.talk)}</td><td class="r num">${dur(s.conn?s.talk/s.conn:0)}</td><td class="r num">${s.intr||0}</td><td class="r num">${s.conv||0}</td><td class="r num">${s.fus||0}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card" style="margin-bottom:16px"><h2>Conversions by month</h2><p class="small muted">A conversion is a lead moved to “Won” (by a call outcome such as Converted / Sale, or by hand), credited to the person who moved it. Conversion % = converted leads ÷ different leads that person called. Value is the leads' deal value.</p>${convTable(cv.month,'Month')}</div>
  <div class="card" style="margin-bottom:16px"><h2>Conversions by program</h2><p class="small muted">Program is the lead's campaign. Create one campaign per program in Campaigns and put leads in it.</p>${convTable(cv.prog,'Program')}</div>
  <div class="card" style="margin-bottom:16px"><h2>Working time</h2><p class="small muted">Per caller per day, from their phone-app and logged calls (all campaigns). Idle time is the time between the end of one call and the start of the next; a gap of 15 minutes or more counts as a break.</p><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Caller</th><th class="r">First call</th><th class="r">Last call ended</th><th class="r">Calls</th><th class="r">Talk time</th><th class="r">Idle time</th><th class="r">Idle %</th><th class="r hide-sm">Longest gap</th><th class="r hide-sm">Breaks</th></tr></thead><tbody>
  ${work.slice(0,150).map(d=>`<tr><td class="small">${esc(fmtD(d.day))}</td><td><b>${esc(nameOf(d.agent))}</b></td><td class="r num">${esc(fmtTm(d.first))}</td><td class="r num">${esc(fmtTm(d.last))}</td><td class="r num">${d.calls}</td><td class="r num">${dur(d.talk)}</td><td class="r num">${dur(d.idle)}</td><td class="r num">${pct(d.span?d.idle/d.span:0)}</td><td class="r num hide-sm">${dur(d.longest)}</td><td class="r num hide-sm">${d.breaks}</td></tr>`).join('')||'<tr><td colspan="10" class="muted">No calls in this range.</td></tr>'}</tbody></table></div>${work.length>150?'<p class="small muted">Showing the latest 150 rows. Download the Working time CSV for all of them.</p>':''}</div>
  <div class="card" style="margin-bottom:16px"><h2>Call outcomes</h2><div class="tbl-wrap"><table><thead><tr><th>Outcome</th><th class="r">Calls</th><th class="r">Share</th></tr></thead><tbody>${[...S.cfg.dispositions,{id:'_none',name:'Outcome not logged yet'}].map(d=>{const n=st.outcomes?.[d.id]||0;return `<tr><td>${esc(d.name)}</td><td class="r num">${n}</td><td class="r num">${t.n?pct(n/t.n):'0%'}</td></tr>`}).join('')}</tbody></table></div></div>
  <div class="card"><h2>Call log</h2><div class="tbl-wrap"><table><thead><tr><th>When</th><th>Lead</th><th class="hide-sm">Caller</th><th>Outcome</th><th class="r">Duration</th><th class="hide-sm">Recording</th></tr></thead><tbody>${cl.data.map(c=>`<tr class="click" data-act="lead" data-id="${c.lead_id}"><td class="small">${esc(fmtDT(c.started_at))}<div>${srcBadge(c.source)}</div></td><td><b>${esc(c.lead?.name||'')}</b><div class="lead-phone">${esc(c.lead?.phone||'')}</div></td><td class="hide-sm">${esc(callerOf(c))}</td><td class="small">${esc(dispo(c.outcome)?.name||(c.outcome?c.outcome:'Not logged'))}${c.note?`<div class="muted">${esc(c.note.slice(0,70))}</div>`:''}</td><td class="r num">${dur(c.duration)}</td><td class="hide-sm small">${c.recording_path||c.recording_url?'Yes':'<span class="muted">—</span>'}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No calls in this range.</td></tr>'}</tbody></table></div>${cl.data.length>=200?'<p class="small muted">Showing the latest 200 calls. Download the CSV for all of them.</p>':''}</div>`;
}};

/* AI CALLING */
V.ai={mount(){
  const a=S.ai;
  return head('AI calling','An AI voice agent calls your leads, talks to them, and logs the outcome, summary, transcript and recording here.')+
  `<div class="card" style="margin-bottom:16px;max-width:760px"><div class="row"><div class="grow"><h2 style="margin:0">AI calling is ${aiOn()?'<span style="color:var(--call)">ON</span>':'<span class="prio-hot">OFF</span>'}</h2><p class="small muted" style="margin:4px 0 0">${aiOn()?'Managers can start AI calling lists, and AI call buttons show on leads.':'No AI calls can be started by anyone until an admin turns it on. Calls already in progress finish normally.'}</p></div>
    ${isAdmin()?`<button class="btn ${aiOn()?'danger':'primary'}" data-act="aiToggle">${aiOn()?'Turn AI calling off':'Turn AI calling on'}</button>`:''}</div></div>`+
  (!aiSetUp()?`<div class="banner warn"><b>Not set up yet.</b><span>Add your Bolna agent ID in Settings → AI calling, and your Bolna API key in Supabase. The setup guide walks you through it.</span>${isAdmin()?'<button class="btn sm" data-act="nav" data-v="settings">Open Settings</button>':''}</div>`:'')+
  (isMgr()?`<div class="card" style="margin-bottom:16px;max-width:760px"><h2>Start an AI calling list</h2><div class="grid3">
    <label class="field"><span>Campaign</span><select class="input" id="aiCamp">${campOpts(a.camp,'All campaigns')}</select></label>
    <label class="field"><span>Who to call</span><select class="input" id="aiQueue">${opt('fresh','New leads, never called',a.queue)}${opt('due','Follow-ups due today',a.queue)}${opt('open','Any open lead',a.queue)}</select></label>
    <label class="field"><span>How many</span><input class="input" type="number" id="aiN" min="1" max="${S.cfg.ai?.maxBatch||50}" value="${a.n}"></label></div>
    <p class="small muted">Calls go out between ${S.cfg.ai?.startHour??10}:00 and ${S.cfg.ai?.endHour??19}:00 IST, skip leads marked DND, and use the campaign's own AI agent when it has one. Only call people who have agreed to hear from you.</p>
    <div class="row"><button class="btn primary" data-act="aiStart" ${aiReady()?'':'disabled'}>${ic('spark')}Start AI calls</button><span id="aiMsg" class="small"></span></div></div>`:'')+
  `<div class="card"><div class="row"><h2 style="margin:0">Recent AI calls</h2><span class="spacer"></span><button class="btn sm" data-act="reload">Refresh</button></div><div id="vb" style="margin-top:12px">${loadingHTML}</div></div>`;
},async load(){
  const rv=S.rv;const {data}=await R(sb.from('ai_calls').select('*, lead:leads(id,name,phone)').order('created_at',{ascending:false}).limit(100));
  if(rv!==S.rv)return;const vb=$('#vb');if(!vb)return;
  if(!data.length){vb.innerHTML='<p class="muted">No AI calls yet.</p>';return}
  const color=s=>s==='completed'?'var(--call)':['failed','error','balance-low'].includes(s)?'var(--danger)':['no-answer','busy','canceled','stopped'].includes(s)?'var(--warn)':'var(--accent)';
  vb.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>When</th><th>Lead</th><th>Status</th><th>Outcome</th><th class="hide-sm">Summary</th></tr></thead><tbody>${data.map(a=>`<tr class="click" data-act="lead" data-id="${a.lead_id}"><td class="small">${esc(fmtDT(a.created_at))}</td><td><b>${esc(a.lead?.name||'')}</b><div class="lead-phone">${esc(a.lead?.phone||'')}</div></td><td><span class="pill" style="color:${color(a.status)}"><span class="dot"></span><span style="color:var(--fg)">${esc(a.status)}</span></span>${a.error?`<div class="small prio-hot">${esc(a.error.slice(0,90))}</div>`:''}</td><td class="small">${esc(dispo(a.outcome)?.name||a.outcome||'—')}</td><td class="hide-sm small muted">${esc((a.summary||'').slice(0,140))}</td></tr>`).join('')}</tbody></table></div>`;
}};

/* SETTINGS */
function setPath(o,p,v){const k=p.split('.');let x=o;for(let i=0;i<k.length-1;i++)x=x[isNaN(k[i])?k[i]:+k[i]];x[k[k.length-1]]=v}
const connCode=()=>btoa(JSON.stringify({u:CFG.url,k:CFG.anonKey}));
V.settings={live:false,mount(){
  const phone=`<div class="card"><h2>Phone app</h2><p class="small muted" style="margin-top:-6px">The Android app logs every call to and from your leads with its real duration, uploads the phone's call recording, and asks the caller for the outcome.</p>
    <div class="row" style="margin-bottom:10px"><a class="btn primary" href="download/dialbook.apk">${ic('down')}Download Android app</a><a class="btn" href="training/" target="_blank" rel="noopener">Telecaller training (video)</a><button class="btn" data-act="copy" data-v="${esc(connCode())}">${ic('copy')}Copy connection code</button></div>
    <p class="small">Connection code (paste it into the app the first time it opens):</p><div class="code-box">${esc(connCode())}</div></div>`;
  if(!isAdmin())return head('Settings','')+`<div style="display:flex;flex-direction:column;gap:16px"><div id="waSet">${loadingHTML}</div>${phone}<div class="empty"><h3>Only admins can change settings</h3></div></div>`;
  if(!S.sd)S.sd=clone(S.cfg);const d=S.sd;d.ai=d.ai||clone(DEF.ai);d.ai.agents=d.ai.agents||{};d.languages=d.languages||clone(DEF.languages);d.assignment=d.assignment||clone(DEF.assignment);d.assignment.rules=d.assignment.rules||[];d.nurture=d.nurture||{startHour:9,endHour:20};
  const stOpts=sel=>opt('','No stage change',sel)+d.stages.map(s=>opt(s.id,'→ '+s.name,sel)).join('');
  return head('Settings','Shape the CRM around how your team sells.',`<button class="btn primary" data-act="saveSet" ${S.sdirty?'':'disabled'}>Save changes</button>`)+`<div style="display:flex;flex-direction:column;gap:16px">
  <div class="card"><h2>Business</h2><label class="field" style="max-width:420px"><span>Company name (used in messages and by the AI agent)</span><input class="input" data-sp="company" value="${esc(d.company)}"></label>
  <label class="row" style="margin-top:12px"><input type="checkbox" data-sp="autoCreateIncoming" ${d.autoCreateIncoming?'checked':''}> When an unknown number calls a telecaller's phone, add it as a new lead</label></div>
  <div id="waSet">${loadingHTML}</div>
  <div id="nuSet">${loadingHTML}</div>
  ${phone}
  <div class="card"><h2>AI calling</h2><label class="row" style="margin:-4px 0 10px"><input type="checkbox" data-sp="ai.enabled" ${d.ai.enabled!==false?'checked':''}> <b>AI calling is on</b> <span class="small muted">(untick to stop anyone starting AI calls)</span></label><p class="small muted" style="margin-top:-6px">Uses Bolna voice agents. Create the agent at bolna.ai, then paste its ID here. The API key goes into Supabase secrets, never here.</p>
  <div class="grid2"><label class="field"><span>Default Bolna agent ID</span><input class="input mono" data-sp="ai.agentId" value="${esc(d.ai.agentId)}"></label><label class="field"><span>Caller ID number (optional)</span><input class="input mono" data-sp="ai.fromNumber" value="${esc(d.ai.fromNumber)}" placeholder="+91…"></label>
  <label class="field"><span>Start calling at (hour, IST)</span><input class="input" type="number" min="0" max="23" data-sp="ai.startHour" value="${esc(d.ai.startHour)}"></label><label class="field"><span>Stop calling at (hour, IST)</span><input class="input" type="number" min="1" max="24" data-sp="ai.endHour" value="${esc(d.ai.endHour)}"></label>
  <label class="field"><span>Most calls per list</span><input class="input" type="number" min="1" max="200" data-sp="ai.maxBatch" value="${esc(d.ai.maxBatch)}"></label></div>
  <h3 style="margin-top:16px">Agent for each language</h3><p class="small muted">Leads are called by the agent for their language (for example a Tamil-speaking agent for Tamil leads). Empty = use the campaign's or the default agent. Ready-made Tamil, Telugu and Kannada prompts are in the ai-agents folder of the package.</p>
  <div class="grid3">${d.languages.map(x=>`<label class="field"><span>${esc(x)}</span><input class="input mono" data-sp="ai.agents.${esc(x)}" value="${esc(d.ai.agents[x]||'')}" placeholder="Bolna agent ID"></label>`).join('')}</div></div>
  ${assignmentCard(d)}
  <div id="lsSet">${loadingHTML}</div>
  <div class="card"><h2>Call outcomes</h2><p class="small muted" style="margin-top:-6px">“Connected” counts toward connect rate. The stage moves the lead automatically. “Ask follow-up” pre-fills a callback time.</p>
  ${d.dispositions.map((x,i)=>`<div class="set-row"><input class="input" data-sp="dispositions.${i}.name" value="${esc(x.name)}" aria-label="Outcome name"><label class="row small"><input type="checkbox" data-sp="dispositions.${i}.connected" ${x.connected?'checked':''}>Connected</label><select class="input" data-sp="dispositions.${i}.stage" aria-label="Moves lead to">${stOpts(x.stage)}</select><label class="row small"><input type="checkbox" data-sp="dispositions.${i}.fu" ${x.fu?'checked':''}>Ask follow-up</label><button class="btn sm ghost" data-act="setDel" data-v="dispositions.${i}" aria-label="Remove">${ic('x')}</button></div>`).join('')}
  <button class="btn sm" data-act="setAdd" data-v="dispositions">${ic('plus')}Add outcome</button></div>
  <div class="card"><h2>Lead stages</h2>${d.stages.map((x,i)=>`<div class="row" style="margin-bottom:8px"><input class="input" style="max-width:320px" data-sp="stages.${i}.name" value="${esc(x.name)}" aria-label="Stage name">${['won','lost','new'].includes(x.id)?'<span class="small muted">fixed</span>':`<button class="btn sm ghost" data-act="setUp" data-v="${i}" aria-label="Move up">↑</button><button class="btn sm ghost" data-act="setDel" data-v="stages.${i}" aria-label="Remove">${ic('x')}</button>`}</div>`).join('')}
  <button class="btn sm" data-act="setAdd" data-v="stages">${ic('plus')}Add stage</button></div>
  <div class="card"><h2>Languages</h2><label class="field" style="max-width:420px"><span>Languages your team works in, one per line</span><textarea class="input" rows="6" data-sp="languagesText">${esc(d.languages.join('\n'))}</textarea></label><p class="small muted">Save to update the language lists everywhere.</p></div>
  <div class="card"><h2>Source names</h2><label class="field" style="max-width:420px"><span>One per line (used in lists and filters)</span><textarea class="input" rows="6" data-sp="sourcesText">${esc(d.sources.join('\n'))}</textarea></label></div>
  <div class="card"><h2>Quick messages (WhatsApp app and SMS)</h2><p class="small muted" style="margin-top:-6px">Ready-made texts that open in the phone's WhatsApp or SMS app. Use {name}, {agent}, {company} and {phone}. Approved WhatsApp API templates are managed under WhatsApp above.</p>
  ${d.templates.map((x,i)=>`<div style="border-top:1px solid var(--line);padding:10px 0;display:flex;flex-direction:column;gap:6px"><div class="row"><input class="input" style="max-width:260px" data-sp="templates.${i}.name" value="${esc(x.name)}" aria-label="Template name"><select class="input" style="width:auto" data-sp="templates.${i}.channel" aria-label="Channel">${opt('whatsapp','WhatsApp',x.channel)}${opt('sms','SMS',x.channel)}</select><button class="btn sm ghost" data-act="setDel" data-v="templates.${i}" aria-label="Remove">${ic('x')}</button></div><textarea class="input" rows="3" data-sp="templates.${i}.body" aria-label="Message">${esc(x.body)}</textarea></div>`).join('')}
  <button class="btn sm" data-act="setAdd" data-v="templates">${ic('plus')}Add template</button></div></div>`;
}};

V.settings.load=async()=>{waSettings();if(isAdmin()){lsSettings();nuSettings()}};
/* ---------- modal & drawer ---------- */
function modal(html){$('#md').innerHTML=`<div class="overlay modal-ov" data-act="closeMd"></div><div class="modal" role="dialog" aria-modal="true"><button class="btn sm ghost x" data-act="closeMd" aria-label="Close">${ic('x')}</button>${html}</div>`;setTimeout(()=>$('#md .modal input:not([type=checkbox]),#md .modal select')?.focus(),30)}
function closeModal(){$('#md').innerHTML=''}
function fuTime(v){const d=new Date();const at11=n=>{d.setDate(d.getDate()+n);d.setHours(11,0,0,0);return d.getTime()};return v==='1h'?now()+36e5:v==='3h'?now()+3*36e5:v==='tmr'?at11(1):v==='2d'?at11(2):v==='7d'?at11(7):null}
function outcomeForm(p,noTimer){return `<div class="field"><span>Call outcome</span><div class="dispo-grid">${S.cfg.dispositions.map(d=>`<button type="button" class="dispo" data-act="pick" data-p="${p}" data-v="${d.id}" aria-pressed="false">${esc(d.name)}<small>${d.connected?'Connected':'Not connected'}${d.stage?' · to '+esc(stage(d.stage)?.name||''):''}</small></button>`).join('')}</div></div>
<div class="grid2" style="margin-top:12px">${noTimer?'':`<div class="field"><span>Call duration (mm:ss)</span><div class="row"><input class="input mono" id="${p}Dur" value="00:00" style="width:90px" aria-label="Call duration"><button type="button" class="btn sm" data-act="timer" data-p="${p}" id="${p}TBtn">Start timer</button></div></div>`}
<div class="field"><span>Next follow-up</span><input class="input" type="datetime-local" id="${p}Fu" aria-label="Next follow-up"><div class="row" style="gap:2px">${[['1h','1 hr'],['3h','3 hrs'],['tmr','Tomorrow'],['2d','2 days'],['7d','1 week'],['none','None']].map(([v,l])=>`<button type="button" class="btn sm ghost" data-act="fuq" data-p="${p}" data-v="${v}">${l}</button>`).join('')}</div></div></div>
<div class="field" style="margin-top:12px"><span>Notes</span><textarea class="input" id="${p}Note" placeholder="What did they say? Budget, timeline, objections"></textarea></div>`}
function parseDur(s){s=String(s||'').trim();if(s.includes(':')){const[a,b]=s.split(':');return(+a||0)*60+(+b||0)}return Math.round((+s||0)*60)}
function tStart(p){const t=S.tm[p]||(S.tm[p]={});if(t.iv)return;t.start=now()-parseDur($('#'+p+'Dur')?.value)*1000;t.iv=setInterval(()=>{const s=Math.round((now()-t.start)/1000);const inp=$('#'+p+'Dur');if(!inp){tStop(p);return}inp.value=mmss(s);const big=$('#'+p+'Big');if(big)big.textContent=mmss(s)},1000);const b=$('#'+p+'TBtn');if(b)b.textContent='Stop timer';$('#'+p+'Big')?.classList.add('live')}
function tStop(p){const t=S.tm[p];if(t&&t.iv){clearInterval(t.iv);t.iv=null}const b=$('#'+p+'TBtn');if(b)b.textContent='Start timer';$('#'+p+'Big')?.classList.remove('live')}
function readOutcome(p){const fv=$('#'+p+'Fu').value;return{outcome:S.pick[p],secs:$('#'+p+'Dur')?parseDur($('#'+p+'Dur').value):0,note:$('#'+p+'Note').value.trim(),fu:fv?new Date(fv).getTime():null}}

function openLead(id){S.openLead=id;S.pick.dw=null;tStop('dw');
  $('#dw').innerHTML=`<div class="overlay" data-act="closeDw"></div><div class="drawer" role="dialog" aria-modal="true" aria-label="Lead details">
    <button class="btn sm ghost x" data-act="closeDw" aria-label="Close">${ic('x')}</button><div id="dwHead">${loadingHTML}</div>
    <div class="card" style="margin-top:14px"><h2>Log a call</h2><p class="small muted" style="margin-top:-6px">Calls made with the phone app are logged on their own. Use this for calls from other phones.</p>${outcomeForm('dw')}<div class="row" style="margin-top:12px"><button class="btn primary" data-act="saveCall" data-p="dw">Save call</button></div></div>
    <div class="card" style="margin-top:14px"><h2>Details</h2><div id="dwInfo"></div></div>
    <div id="dwNu"></div>
    <div class="card" style="margin-top:14px"><h2>Activity</h2><div class="row" style="margin:10px 0 14px;align-items:flex-start"><textarea class="input" id="dwNoteAdd" rows="2" placeholder="Add a note" style="flex:1;min-height:44px"></textarea><button class="btn" data-act="addNote">Add note</button></div><div id="dwTl"></div></div>
    <div class="card" style="margin-top:14px"><div class="row"><h2 style="margin:0">AI assistant</h2><span class="spacer"></span><button class="btn sm" data-act="aiAssist">${ic('spark')}Suggest next step</button></div><div id="aiOut" class="small muted" style="margin-top:8px">Reads this lead's calls, transcripts and notes and suggests what to do next, with a ready-to-send message.</div></div>
    ${isMgr()?`<div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn sm danger" data-act="leadDel">Delete lead</button></div>`:''}</div>`;
  loadDrawer().catch(fail);
}
function closeDrawer(){tStop('dw');S.openLead=null;S.lead=null;$('#dw').innerHTML=''}
async function loadDrawer(){
  const id=S.openLead;if(!id)return;
  const [lr,cr,ar,air]=await Promise.all([sb.from('leads').select('*').eq('id',id).maybeSingle(),sb.from('calls').select('*').eq('lead_id',id).order('started_at',{ascending:false}).limit(100),sb.from('activities').select('*').eq('lead_id',id).order('created_at',{ascending:false}).limit(100),sb.from('ai_calls').select('*').eq('lead_id',id).is('call_id',null).order('created_at',{ascending:false}).limit(5)]);
  if(S.openLead!==id)return;
  if(lr.error)throw lr.error;const l=lr.data;if(!l){closeDrawer();toast('This lead is not available to you.');return}
  S.lead=l;nuLeadBox(l).catch(()=>{});
  const aiBtn=aiReady()&&(isMgr()||l.assigned_to===S.me.id)&&!l.dnd?`<button class="btn" data-act="aiOne">${ic('spark')}AI call</button>`:'';
  $('#dwHead').innerHTML=`<div style="padding-right:44px"><h1>${esc(l.name||'Unnamed')}</h1><div class="row" style="margin-top:6px">${stagePill(l.stage)}${prioLabel(l.priority)}${l.campaign_id?`<span class="tag">${esc(camp(l.campaign_id)?.name||'')}</span>`:''}${l.dnd?'<span class="tag">Do not contact</span>':''}${l.contact_only?'<span class="tag">Contact list</span>':''}</div></div>
    <div class="dial-phone" style="margin-top:12px;font-size:1.3rem">${esc(l.phone)}</div>
    <div class="row" style="margin-top:10px"><a class="btn call" href="tel:${esc(normPhone(l.phone))}" data-act="dial" data-p="dw">${ic('phone')}Call</a><button class="btn" data-act="wa">${ic('msg')}WhatsApp / SMS</button><button class="btn" data-act="copy" data-v="${esc(l.phone)}">${ic('copy')}Copy</button><button class="btn" data-act="editLead">${ic('edit')}Edit</button>${aiBtn}</div>`;
  const f=(k,v)=>`<div><div class="small muted">${k}</div><div>${v||'<span class="muted">—</span>'}</div></div>`;
  $('#dwInfo').innerHTML=`<div class="grid2">
    <label class="field"><span>Stage</span><select class="input" data-lset="stage">${stageOpts(l.stage)}</select></label>
    <label class="field"><span>Priority</span><select class="input" data-lset="priority">${prioOpts(l.priority,'Not set')}</select></label>
    <label class="field"><span>Language</span><select class="input" data-lset="language">${langOpts(l.language||'','Not set')}</select></label>
    ${isMgr()?`<label class="field"><span>Assigned to</span><select class="input" data-lset="assigned_to">${agentOpts(l.assigned_to||'','Unassigned')}</select></label><label class="field"><span>Campaign</span><select class="input" data-lset="campaign_id">${campOpts(l.campaign_id||'','No campaign')}</select></label>`:f('Assigned to',esc(nameOf(l.assigned_to)))+f('Campaign',esc(camp(l.campaign_id)?.name||''))}
    ${f('Next follow-up',l.next_follow_up_at?esc(fmtDT(l.next_follow_up_at))+` <span class="small muted">(${rel(l.next_follow_up_at)})</span>`:'')}
    ${f('Calls made',`<span class="num">${l.call_count}</span>${l.last_call_at?' · last '+rel(l.last_call_at):''}`)}
    ${f('Alternate phone',esc(l.alt_phone))}${f('Email',esc(l.email))}${f('City',esc(l.city))}${f('Company',esc(l.company))}
    ${f('Source',esc(l.source))}${f('Deal value',+l.value?inr(l.value):'')}${f('Added',esc(fmtDT(l.created_at)))}${f('Tags',(l.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join(' '))}</div>
    <label class="row" style="margin-top:12px"><input type="checkbox" data-lset="dnd" ${l.dnd?'checked':''}> Do not contact: the customer asked us to stop (blocks calls, AI calls, WhatsApp and nurture)</label>
    ${l.note?`<div style="margin-top:12px"><div class="small muted">Notes</div><div style="white-space:pre-wrap">${esc(l.note)}</div></div>`:''}`;
  const items=[...cr.data.map(c=>({at:ts(c.started_at),c})),...ar.data.map(a=>({at:ts(a.created_at),a})),...air.data.map(x=>({at:ts(x.created_at),x}))].sort((a,b)=>b.at-a.at);
  $('#dwTl').innerHTML=items.length?`<div class="timeline">${items.map(it=>{
    if(it.c){const c=it.c,d=dispo(c.outcome);const canLog=!c.outcome&&(isMgr()||c.agent_id===S.me.id);
      return `<div class="tl ${c.connected?'call-ok':'call-no'}"><b>${c.direction==='incoming'?'Incoming':c.direction==='missed'?'Missed':c.direction==='rejected'?'Rejected':'Call'} · ${esc(d?.name||(c.outcome||'Outcome not logged'))}</b> <span class="num small">${dur(c.duration)}</span> ${srcBadge(c.source)}
        ${c.follow_up_at?`<div class="small">Follow-up set for ${esc(fmtDT(c.follow_up_at))}</div>`:''}${c.note?`<div style="white-space:pre-wrap">${esc(c.note)}</div>`:''}
        ${c.recording_path?`<div data-rec="${esc(c.recording_path)}"><button class="btn sm" data-act="playRec" data-v="${esc(c.recording_path)}">${ic('play')}Play recording</button></div>`:''}
        ${c.recording_url?`<audio controls preload="none" src="${esc(c.recording_url)}"></audio>`:''}
        ${c.transcript?`<details class="tx"><summary>Transcript</summary><pre>${esc(c.transcript)}</pre></details>`:''}
        ${canLog?`<div style="margin-top:4px"><button class="btn sm primary" data-act="logPending" data-id="${c.id}">Add outcome</button></div>`:''}
        <div class="meta">${esc(callerOf(c))} · ${esc(fmtDT(c.started_at))}</div></div>`}
    if(it.x)return `<div class="tl"><b>AI call ${esc(it.x.status)}</b>${it.x.error?`<div class="small prio-hot">${esc(it.x.error)}</div>`:''}<div class="meta">${esc(fmtDT(it.x.created_at))}</div></div>`;
    const a=it.a;let txt='';
    if(a.kind==='stage')txt=`Moved from <b>${esc(stage(a.data.from)?.name||a.data.from||'New')}</b> to <b>${esc(stage(a.data.to)?.name||a.data.to)}</b>`;
    else if(a.kind==='assign')txt=a.data.to?`Assigned to <b>${esc(nameOf(a.data.to))}</b>`:'Unassigned';
    else if(a.kind==='msg')txt=`Sent ${a.data.channel==='sms'?'SMS':'WhatsApp'} · ${esc(a.text)}`;
    else if(a.kind==='created')txt=`Lead added${a.text?' · '+esc(a.text):''}`;
    else if(a.kind==='ai')txt=esc(a.text);
    else txt=`<div style="white-space:pre-wrap">${esc(a.text)}</div>`;
    return `<div class="tl">${txt}<div class="meta">${esc(nameOf(a.actor_id))} · ${esc(fmtDT(a.created_at))}</div></div>`}).join('')}</div>`:'<p class="muted small">No activity yet.</p>';
}
function pendingModal(callId){
  modal(`<h2>Add call outcome</h2><div style="margin-top:12px">${outcomeForm('pm',true)}</div><div class="row" style="margin-top:12px"><button class="btn primary" data-act="savePending" data-id="${callId}">Save</button><button class="btn" data-act="closeMd">Cancel</button></div>`);
}
function leadModal(id){
  const l=id?S.lead:{name:'',phone:'',stage:'new',assigned_to:isMgr()?'':S.me.id,source:'',campaign_id:S.lf.camp&&S.lf.camp!=='_none'?S.lf.camp:'',tags:[]};
  modal(`<h2>${id?'Edit lead':'Add lead'}</h2><form id="lForm" style="display:flex;flex-direction:column;gap:12px;margin-top:14px">
  <div class="grid2"><label class="field"><span>Name</span><input class="input" id="fName" value="${esc(l.name)}" required></label><label class="field"><span>Phone</span><input class="input" id="fPhone" value="${esc(l.phone)}" inputmode="tel" required></label>
  <label class="field"><span>Alternate phone</span><input class="input" id="fAlt" value="${esc(l.alt_phone||'')}" inputmode="tel"></label><label class="field"><span>Email</span><input class="input" id="fEmail" type="email" value="${esc(l.email||'')}"></label>
  <label class="field"><span>City</span><input class="input" id="fCity" value="${esc(l.city||'')}"></label><label class="field"><span>Company</span><input class="input" id="fCompany" value="${esc(l.company||'')}"></label>
  <label class="field"><span>Source</span><select class="input" id="fSource">${srcOpts(l.source,'Not set')}${l.source&&!S.cfg.sources.includes(l.source)?opt(l.source,l.source,l.source):''}</select></label><label class="field"><span>Campaign</span><select class="input" id="fCamp">${campOpts(l.campaign_id||'','No campaign')}</select></label>
  ${isMgr()?`<label class="field"><span>Assigned to</span><select class="input" id="fAgent">${agentOpts(l.assigned_to||'','Unassigned')}</select></label>`:''}<label class="field"><span>Stage</span><select class="input" id="fStage">${stageOpts(l.stage)}</select></label>
  <label class="field"><span>Priority</span><select class="input" id="fPrio">${prioOpts(l.priority,'Not set')}</select></label><label class="field"><span>Language</span><select class="input" id="fLang">${langOpts(l.language||'','Not set')}</select></label><label class="field"><span>Deal value (₹)</span><input class="input" id="fValue" type="number" min="0" value="${esc(+l.value||'')}"></label></div>
  <label class="field"><span>Tags (comma separated)</span><input class="input" id="fTags" value="${esc((l.tags||[]).join(', '))}"></label>
  <label class="field"><span>Notes</span><textarea class="input" id="fNote">${esc(l.note||'')}</textarea></label><p id="fMsg" class="small prio-hot"></p>
  <div class="row"><button class="btn primary" type="submit" id="fSave">${id?'Save changes':'Add lead'}</button><button class="btn" type="button" data-act="closeMd">Cancel</button></div></form>`);
  $('#lForm').onsubmit=async e=>{e.preventDefault();
    const d={name:$('#fName').value.trim(),phone:normPhone($('#fPhone').value),alt_phone:normPhone($('#fAlt').value),email:$('#fEmail').value.trim(),city:$('#fCity').value.trim(),company:$('#fCompany').value.trim(),source:$('#fSource').value,campaign_id:$('#fCamp').value||null,stage:$('#fStage').value,priority:$('#fPrio').value,language:$('#fLang').value,value:+$('#fValue').value||0,tags:$('#fTags').value.split(',').map(s=>s.trim()).filter(Boolean),note:$('#fNote').value.trim()};
    if(isMgr())d.assigned_to=$('#fAgent').value||null;else if(!id)d.assigned_to=S.me.id;if(!id&&!d.assigned_to)delete d.assigned_to;
    if(pkey(d.phone).length<6){$('#fMsg').textContent='Enter a valid phone number.';return}
    const btn=$('#fSave');
    try{
      const {data:dups}=await R(sb.from('leads').select('id,name,assigned_to').eq('phone_key',pkey(d.phone)).neq('id',id||'00000000-0000-0000-0000-000000000000').limit(1));
      if(dups.length&&!btn.dataset.force){$('#fMsg').textContent=`${dups[0].name||'A lead'} already has this number (${nameOf(dups[0].assigned_to)}). Press save again to add it anyway.`;btn.dataset.force='1';return}
      if(id){const o=S.lead;await R(sb.from('leads').update(d).eq('id',id));if(o.stage!==d.stage)await addActivity(id,'stage','',{from:o.stage,to:d.stage});if(isMgr()&&(o.assigned_to||null)!==(d.assigned_to||null))await addActivity(id,'assign','',{to:d.assigned_to||''});closeModal();toast('Lead updated');loadDrawer()}
      else{d.created_by=S.me.id;const {data}=await R(sb.from('leads').insert(d).select('id').single());await addActivity(data.id,'created',d.source);closeModal();toast('Lead added');openLead(data.id);if(S.view==='leads')V.leads.load()}
    }catch(err){fail(err)}
  };
}
function fillTpl(b,l){return String(b).replace(/\{name\}/g,(l.name||'').split(' ')[0]||'there').replace(/\{agent\}/g,S.me.name||'our team').replace(/\{company\}/g,S.cfg.company||'').replace(/\{phone\}/g,l.phone||'')}
function msgModal(){
  const l=S.lead;if(!l)return;const ph=normPhone(l.phone);
  modal(`<h2>Message ${esc(l.name)}</h2><p class="muted small">Opens WhatsApp or your SMS app with the message filled in.</p><div class="list" style="margin-top:12px">
  ${S.cfg.templates.map(t=>{const txt=fillTpl(t.body,l);const href=t.channel==='sms'?`sms:${ph}?body=${encodeURIComponent(txt)}`:waLink(ph,txt);return `<div class="li" style="flex-direction:column;align-items:stretch"><div class="row"><b>${esc(t.name)}</b><span class="pill">${t.channel==='sms'?'SMS':'WhatsApp'}</span><span class="spacer"></span><a class="btn sm ${t.channel==='sms'?'':'call'}" href="${esc(href)}" target="_blank" rel="noopener" data-act="msgSent" data-v="${esc(t.name)}" data-p="${t.channel}">Open ${t.channel==='sms'?'SMS':'WhatsApp'}</a><button class="btn sm" data-act="copy" data-v="${esc(txt)}">${ic('copy')}Copy</button></div><div class="small muted">${esc(txt)}</div></div>`}).join('')}
  <div class="li"><b class="grow">Blank WhatsApp chat</b><a class="btn sm" href="${esc(waLink(ph))}" target="_blank" rel="noopener">Open WhatsApp</a></div></div>`);
}

/* ---------- calling mode ---------- */
function queueQuery(select='id',opts){
  const d=S.dialSetup;let q=sb.from('leads').select(select,opts).not('stage','in','(won,lost)').eq('dnd',false);if(S.hasContacts)q=q.eq('contact_only',false);
  if(d.camp)q=q.eq('campaign_id',d.camp);
  if(!isMgr()||d.who==='me')q=q.eq('assigned_to',S.me.id);
  if(d.queue==='fresh')q=q.eq('call_count',0);
  else if(d.queue==='due')q=q.lt('next_follow_up_at',iso(endToday()));
  else q=q.or(`last_call_at.is.null,last_call_at.lt.${iso(sod(now()))}`);
  return q;
}
async function startDialer(ids){if(!ids.length)return toast('No leads to call in this list');S.dialer={ids,i:0,saved:0,conn:0,skipped:0,start:now()};S.pick.dc=null;go('dialer')}
V.dialer={live:false,mount(){
  const D=S.dialer;
  if(!D){const d=S.dialSetup;
    return head('Calling mode','One lead at a time: call, pick the outcome, set the follow-up, next.')+`<div class="card" style="max-width:640px"><h2>Build your calling list</h2><div style="display:flex;flex-direction:column;gap:12px">
    <label class="field"><span>Campaign</span><select class="input" id="dsC">${campOpts(d.camp,'All campaigns')}</select></label>
    <div class="field"><span>Who to call</span><div class="row">${[['fresh','New leads, never called'],['due','Follow-ups due today'],['open','All open leads not called today']].map(([v,l])=>`<button class="chip-toggle" data-act="dsQ" data-v="${v}" aria-pressed="${d.queue===v}">${l}</button>`).join('')}</div></div>
    ${isMgr()?`<label class="field"><span>Whose leads</span><select class="input" id="dsW">${opt('me','Leads assigned to me',d.who)}${opt('all','All leads',d.who)}</select></label>`:''}
    <label class="field"><span>Order</span><select class="input" id="dsO">${opt('old','Oldest first',d.order)}${opt('new','Newest first',d.order)}${opt('hot','Hot leads first',d.order)}</select></label>
    <div class="row"><button class="btn call lg" data-act="dStart" id="dStartBtn" disabled>${ic('phone')}Counting leads…</button></div>
    <p class="small muted">Tip: on a phone, the Dialbook Android app logs calls and recordings for you automatically.</p></div></div>`}
  if(D.i>=D.ids.length)return head('Calling mode','List finished')+`<div class="card" style="max-width:560px"><h2>List done</h2><div class="grid3" style="margin:12px 0"><div><div class="small muted">Calls logged</div><b class="num" style="font-size:1.6rem">${D.saved}</b></div><div><div class="small muted">Connected</div><b class="num" style="font-size:1.6rem">${D.conn}</b></div><div><div class="small muted">Skipped</div><b class="num" style="font-size:1.6rem">${D.skipped}</b></div></div><p class="muted small">Time in session: ${dur((now()-D.start)/1000)}</p><div class="row"><button class="btn primary" data-act="dEnd">Build another list</button><button class="btn" data-act="nav" data-v="followups">See follow-ups</button></div></div>`;
  return head('Calling mode',`Lead ${D.i+1} of ${D.ids.length} · ${D.saved} logged`,`<button class="btn" data-act="dEnd">End session</button>`)+`<div class="progress" style="margin-bottom:16px"><div style="width:${D.i/D.ids.length*100}%"></div></div><div id="vb">${loadingHTML}</div>`;
},async load(){
  const D=S.dialer;
  if(!D){const {count}=await R(queueQuery('id',{count:'exact',head:true}));const b=$('#dStartBtn');if(b){b.innerHTML=`${ic('phone')}Start calling ${Math.min(count,500)} leads`;b.disabled=!count}return}
  if(D.i>=D.ids.length)return;
  const rv=S.rv;const id=D.ids[D.i];
  const [lr,cr]=await Promise.all([sb.from('leads').select('*').eq('id',id).maybeSingle(),sb.from('calls').select('*').eq('lead_id',id).order('started_at',{ascending:false}).limit(5)]);
  if(rv!==S.rv)return;
  const l=lr.data;if(!l){D.i++;render();return}
  S.dialLead=l;const c=camp(l.campaign_id);const vb=$('#vb');if(!vb)return;
  vb.innerHTML=`<div class="dialer"><div class="dial-card">
    <div class="row">${stagePill(l.stage)}${prioLabel(l.priority)}<span class="spacer"></span><span class="small muted">${esc([l.source,c?.name,l.city].filter(Boolean).join(' · '))}</span></div>
    <div class="dial-name" style="margin-top:8px">${esc(l.name||'Unnamed')}</div><div class="dial-phone">${esc(l.phone)}</div>
    ${l.call_count?`<div class="small muted">Called ${l.call_count} time${l.call_count>1?'s':''} · last: ${esc(dispo(l.last_outcome)?.name||'')} ${rel(l.last_call_at)}</div>`:'<div class="small muted">First call</div>'}
    <div class="row" style="margin-top:14px"><a class="btn call lg" href="tel:${esc(normPhone(l.phone))}" data-act="dial" data-p="dc">${ic('phone')}Call now</a><button class="btn" data-act="waDial">${ic('msg')}WhatsApp</button><button class="btn" data-act="copy" data-v="${esc(l.phone)}">${ic('copy')}Copy</button><button class="btn ghost" data-act="dSkip">${ic('skip')}Skip</button></div>
    <div class="row" style="margin:16px 0 4px;align-items:baseline"><span class="timer" id="dcBig">00:00</span><span class="small muted">the timer starts when you tap Call now</span></div>
    <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">${outcomeForm('dc')}
    <div class="row" style="margin-top:14px"><button class="btn primary lg" data-act="saveCall" data-p="dc">Save and next lead</button><button class="btn" data-act="lead" data-id="${l.id}">Full details</button></div></div>
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
    <div class="card"><h2>Call script${c?' · '+esc(c.name):''}</h2><div class="script">${c&&c.script?esc(fillTpl(c.script,l)):'No script for this campaign yet. Add one under Campaigns → Edit.'}</div></div>
    ${l.note?`<div class="card"><h2>About this lead</h2><p style="white-space:pre-wrap;margin:0">${esc(l.note)}</p></div>`:''}
    <div class="card"><h2>Recent calls</h2>${cr.data.length?cr.data.map(x=>`<div class="small" style="margin-bottom:8px"><b>${esc(dispo(x.outcome)?.name||'Outcome not logged')}</b> · ${dur(x.duration)} ${srcBadge(x.source)}<div class="muted">${esc(callerOf(x))} · ${esc(fmtDT(x.started_at))}</div>${x.note?`<div>${esc(x.note)}</div>`:''}</div>`).join(''):'<p class="muted small">No calls yet.</p>'}</div></div></div>`;
}};
async function saveCall(p){
  const leadId=p==='dc'?S.dialLead?.id:S.openLead;if(!leadId)return;
  const o=readOutcome(p);if(!o.outcome)return toast('Pick a call outcome first');
  tStop(p);
  try{await logManualCall(leadId,o)}catch(e){return fail(e)}
  toast('Call saved'+(o.fu?' · follow-up '+fmtDT(o.fu):''));
  if(p==='dc'){const D=S.dialer;D.saved++;if(dispo(o.outcome)?.connected)D.conn++;D.i++;S.pick.dc=null;render()}
  else{S.pick.dw=null;$$('#dw .dispo').forEach(b=>b.setAttribute('aria-pressed','false'));$('#dwDur').value='00:00';$('#dwNote').value='';$('#dwFu').value='';loadDrawer()}
}

/* ---------- import / export ---------- */
const FIELDS=[['alt_phone','Alternate phone',/alt|alternate|second|other/i],['email','Email',/mail/i],['company','Company',/company|business|firm|organi/i],['phone','Phone (required)',/phone|mobile|contact.?n|number|whatsapp|cell/i],['name','Name',/name|customer|contact|lead/i],['city','City',/city|location|place|area|state/i],['source','Source',/source|platform|channel/i],['tags','Tags',/tag|product|interest|course|service/i],['note','Notes',/note|remark|comment|message|requirement|query/i],['value','Deal value',/value|amount|budget|price/i],['language','Language',/lang|bhasha/i]];
function parseCSV(text){
  const first=text.split(/\r?\n/)[0]||'';const cnt=c=>(first.match(new RegExp(c,'g'))||[]).length;const dl=cnt(';')>cnt(',')?';':cnt('\t')>cnt(',')?'\t':',';
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;else if(c===dl){row.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}else f+=c}
  if(f||row.length){row.push(f);rows.push(row)}
  return rows.filter(r=>r.some(x=>String(x).trim()));
}
function loadXLSX(){return new Promise((res,rej)=>{if(window.XLSX)return res(window.XLSX);const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>res(window.XLSX);s.onerror=()=>rej(new Error('Could not load the Excel reader. Save the file as CSV and try again.'));document.head.appendChild(s)})}
function importModal(){
  modal(`<h2>Import leads</h2><p class="muted small">Upload an Excel (.xlsx) or CSV file with column names in the first row. There is no limit on how many leads you keep.</p>
  <label class="field" style="margin-top:14px"><span>File</span><input class="input" type="file" id="impFile" accept=".csv,.xlsx,.xls,.txt"></label><p id="impMsg" class="small muted"></p>
  <details style="margin-top:8px"><summary class="small">Or paste rows from Excel</summary><textarea class="input" id="impPaste" rows="5" placeholder="Name, Phone, City&#10;Asha Rao, 9876543210, Pune"></textarea><button class="btn sm" data-act="impPaste" style="margin-top:6px">Use pasted rows</button></details>`);
  $('#impFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;$('#impMsg').textContent='Reading '+file.name+'…';
    try{let rows;if(/\.xlsx?$/i.test(file.name)){const X=await loadXLSX();const wb=X.read(await file.arrayBuffer(),{type:'array'});rows=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:''})}else rows=parseCSV(await file.text());
      rows=rows.filter(r=>r.some(x=>String(x).trim()));if(rows.length<2)throw new Error('That file needs a header row and at least one lead.');mapStep(rows)}
    catch(err){$('#impMsg').textContent=err.message}};
}
function mapStep(rows){
  const hdr=rows[0].map(h=>String(h).trim());const body=rows.slice(1);S.imp={hdr,body};const used=new Set();const guess={};
  for(const[k,,re]of FIELDS){const i=hdr.findIndex((h,j)=>!used.has(j)&&re.test(h));if(i>=0){guess[k]=i;used.add(i)}}
  if(guess.phone===undefined){const i=hdr.findIndex((h,j)=>!used.has(j)&&body.slice(0,5).some(r=>pkey(r[j]).length===10));if(i>=0)guess.phone=i}
  const colOpts=sel=>opt('','— skip —',sel===undefined?'':sel)+hdr.map((h,i)=>opt(i,h||'Column '+(i+1),sel)).join('');
  const order=['name','phone',...FIELDS.map(f=>f[0]).filter(k=>k!=='name'&&k!=='phone')];
  modal(`<h2>Match your columns</h2><p class="muted small">${body.length} rows found.</p>
  <div class="grid2" style="margin-top:12px">${order.map(k=>{const f=FIELDS.find(x=>x[0]===k);return `<label class="field"><span>${f[1]}</span><select class="input imap" data-k="${k}">${colOpts(guess[k])}</select></label>`}).join('')}</div>
  <h3 style="margin-top:16px">Import options</h3><div class="grid2" style="margin-top:8px">
  <label class="field"><span>Add to campaign</span><select class="input" id="iCamp">${campOpts(S.lf.camp&&S.lf.camp!=='_none'?S.lf.camp:'','No campaign')}</select></label>
  <label class="field"><span>Source (if the file has none)</span><select class="input" id="iSrc">${srcOpts('Excel import','Not set')}</select></label>
  <label class="field"><span>Assign to</span><select class="input" id="iAssign">${isMgr()?(S.hasContacts?opt('_contacts','Don’t assign: contact list for messages only (old data)'):'')+(S.cfg.assignment?.enabled?opt('','Use assignment rules (language, source…)'):'')+opt('rr','Share equally among telecallers')+opt('',S.cfg.assignment?.enabled?'Leave unassigned (rules still apply)':'Leave unassigned')+agents().map(m=>opt(m.id,m.name)).join(''):opt(S.me.id,'Me')}</select></label>
  <label class="field"><span>Duplicates</span><select class="input" id="iDup">${opt('skip','Skip numbers already in the CRM')}${opt('keep','Import them anyway')}</select></label></div>
  <p id="iMsg" class="small muted" style="margin-top:12px"></p><div class="row"><button class="btn primary" data-act="impRun" id="iRun">Import leads</button><button class="btn" data-act="closeMd">Cancel</button></div>`);
  const upd=()=>{const r=prepImport();$('#iMsg').textContent=`${r.list.length} rows ready${r.dupFile?`, ${r.dupFile} repeated numbers in the file skipped`:''}${r.bad?`, ${r.bad} rows without a valid phone skipped`:''}. Numbers already in the CRM are checked when you import.`};
  $$('.imap,#iDup').forEach(s=>s.onchange=upd);upd();
}
function prepImport(){
  const m={};$$('.imap').forEach(s=>{if(s.value!=='')m[s.dataset.k]=+s.value});
  const skip=$('#iDup').value==='skip';const list=[];let dupFile=0,bad=0;const seen=new Set();
  for(const r of S.imp.body){const g=k=>m[k]===undefined?'':String(r[m[k]]??'').trim();const ph=normPhone(g('phone'));const k=pkey(ph);
    if(k.length<6){bad++;continue}if(skip&&seen.has(k)){dupFile++;continue}seen.add(k);
    list.push({name:g('name')||'Unnamed',phone:ph,alt_phone:normPhone(g('alt_phone')),email:g('email'),city:g('city'),company:g('company'),source:g('source'),tags:g('tags')?g('tags').split(/[,;|]/).map(s=>s.trim()).filter(Boolean):[],note:g('note'),language:g('language'),value:+(g('value').replace(/[^\d.]/g,''))||0})}
  return{list,dupFile,bad};
}
async function runImport(btn){
  let {list}=prepImport();if(!list.length)return toast('Nothing to import');
  const cid=$('#iCamp').value||null,src=$('#iSrc').value,as=$('#iAssign').value,skip=$('#iDup').value==='skip';
  btn.disabled=true;let dups=0;
  try{
    if(skip){btn.textContent='Checking duplicates…';const exist=new Set();
      for(const c of chunk(list.map(l=>pkey(l.phone)),300)){const {data}=await R(sb.from('leads').select('phone_key').in('phone_key',c));data.forEach(d=>exist.add(d.phone_key))}
      const before=list.length;list=list.filter(l=>!exist.has(pkey(l.phone)));dups=before-list.length}
    let pool=agents().filter(m=>m.role==='telecaller');if(!pool.length)pool=agents();
    const contacts=as==='_contacts';
    const rows=list.map((d,i)=>{const r={...d,source:d.source||src,campaign_id:cid,created_by:S.me.id,assigned_to:contacts?null:as==='rr'?(pool.length?pool[i%pool.length].id:null):(as||null)};if(contacts)r.contact_only=true;if(!r.assigned_to)delete r.assigned_to;return r});
    let done=0;for(const c of chunk(rows,500)){await R(sb.from('leads').insert(c));done+=c.length;btn.textContent=`Importing… ${done}/${rows.length}`}
    closeModal();toast(`${rows.length} ${contacts?'contacts added to the contact list':'leads imported'}${dups?`, ${dups} already in the CRM skipped`:''}`);if(contacts)S.lf.fu='contacts';go('leads');
  }catch(e){btn.disabled=false;btn.textContent='Import leads';fail(e)}
}
const csvCell=v=>{v=v==null?'':String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function saveCSV(name,rows){const csv='﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
async function fetchAll(mk,onProg){const out=[];for(let p=0;;p++){const {data}=await R(mk().range(p*1000,p*1000+999));out.push(...data);onProg&&onProg(out.length);if(data.length<1000)break}return out}
async function exportLeads(){toast('Preparing export…');try{
  const ls=await fetchAll(()=>leadQuery('*').order('created_at'));
  saveCSV(`leads-${toDateInput(now())}.csv`,[['Name','Phone','Alternate phone','Email','City','Company','Source','Campaign','Assigned to','Stage','Priority','Deal value','Tags','Notes','Calls','Last outcome','Last call','Next follow-up','Added','Do not call'],...ls.map(l=>[l.name,l.phone,l.alt_phone,l.email,l.city,l.company,l.source,camp(l.campaign_id)?.name||'',nameOf(l.assigned_to),stage(l.stage)?.name||l.stage,l.priority,l.value||'',(l.tags||[]).join('; '),l.note,l.call_count,dispo(l.last_outcome)?.name||'',fmtDT(l.last_call_at),fmtDT(l.next_follow_up_at),fmtDT(l.created_at),l.dnd?'Yes':''])])}catch(e){fail(e)}}
async function exportCalls(){toast('Preparing export…');try{
  const cs=await fetchAll(()=>callsQuery());
  saveCSV(`call-log-${toDateInput(S.rep.from)}-to-${toDateInput(S.rep.to)}.csv`,[['Date & time','Lead','Phone','Caller','Logged by','Direction','Outcome','Connected','Duration (sec)','Follow-up','Notes','Recording'],...cs.map(c=>[new Date(c.started_at).toLocaleString('en-IN'),c.lead?.name,c.lead?.phone,callerOf(c),c.source==='phone'?'Phone app':c.source==='ai'?'AI agent':'By hand',c.direction,dispo(c.outcome)?.name||c.outcome||'',c.connected?'Yes':'No',c.duration,fmtDT(c.follow_up_at),c.note,c.recording_path||c.recording_url?'Yes':''])])}catch(e){fail(e)}}
function exportAgents(){const st=S.repStats;if(!st)return;saveCSV(`caller-summary-${toDateInput(S.rep.from)}-to-${toDateInput(S.rep.to)}.csv`,[['Caller','Calls','Connected','Connect %','Talk time (min)','Avg call (sec)','Interested','Converted','Follow-ups set'],...[...S.team.map(m=>[m.name,st.by_agent?.[m.id]]),['AI agent',st.by_agent?.ai]].filter(x=>x[1]).map(([n,s])=>[n,s.n,s.conn,Math.round(s.n?s.conn/s.n*100:0),Math.round(s.talk/60),Math.round(s.conn?s.talk/s.conn:0),s.intr,s.conv,s.fus])])}

/* ---------- navigation & render ---------- */
const NAV=[['home','Dashboard','home'],['leads','Leads','leads'],['dialer','Calling mode','phone'],['followups','Follow-ups','clock'],['wa','WhatsApp','msg'],['pipeline','Pipeline','cols'],['campaigns','Campaigns','flag'],['ai','AI calling','spark'],['team','Team','team'],['reports','Reports','chart'],['settings','Settings','gear']];
const TABS=['home','leads','dialer','followups','wa'];
function renderNav(){
  const badge=v=>v==='followups'&&S.badge?`<span class="badge">${S.badge>99?'99+':S.badge}</span>`:v==='wa'&&S.wa&&S.wa.unread?`<span class="badge" style="background:var(--call)">${S.wa.unread>99?'99+':S.wa.unread}</span>`:'';
  const cur=v=>S.view===v?' aria-current="page"':'';
  $('#sideNav').innerHTML=NAV.map(([v,l,i])=>`<button class="nav-btn" data-act="nav" data-v="${v}"${cur(v)}>${ic(i)}<span>${l}</span>${badge(v)}</button>`).join('');
  $('#tabNav').innerHTML=TABS.map(v=>{const[,l,i]=NAV.find(n=>n[0]===v);return `<button data-act="nav" data-v="${v}"${cur(v)}>${ic(i)}<span>${v==='dialer'?'Call':v==='followups'?'Follow-ups':l}</span>${badge(v)}</button>`}).join('')+`<button data-act="moreNav"${TABS.includes(S.view)?'':' aria-current="page"'}>${ic('more')}<span>More</span></button>`;
  $('#brandName').textContent=S.cfg.company||'Dialbook';$('#meName').textContent=S.me?.name||'';$('#meRole').textContent=role()[0].toUpperCase()+role().slice(1);
}
function render(){const v=V[S.view]||V.home;S.rv++;$('#main').innerHTML=v.mount();renderNav();if(v.load)v.load().catch(fail)}
function go(v){if(v!=='settings'){S.sd=null;S.sdirty=false}if(v!=='leads')S.sel.clear();S.view=v;render();window.scrollTo(0,0);try{history.replaceState(null,'','#'+v)}catch(e){}}
let liveT;
function onLive(){clearTimeout(liveT);liveT=setTimeout(()=>{const v=V[S.view];if(v&&v.live!==false&&v.load&&!$('#md').innerHTML)v.load().catch(()=>{});if(S.openLead)loadDrawer().catch(()=>{});updateBadge();waBadge()},1500)}
async function loadBase(){
  const [t,c,s]=await Promise.all([R(sb.from('profiles').select('*').order('created_at')),R(sb.from('campaigns').select('*').order('created_at',{ascending:false})),R(sb.from('settings').select('data').eq('id',1).maybeSingle())]);
  S.team=t.data;S.campaigns=c.data;S.cfg={...clone(DEF),...(s.data?.data||{})};S.cfg.ai={...DEF.ai,...(S.cfg.ai||{})};
  const me=S.team.find(m=>m.id===S.me.id);if(me)S.me=me;
  if(S.hasContacts===undefined){const {error}=await sb.from('leads').select('contact_only').limit(1);S.hasContacts=!error}
  if(S.hasTagsText===undefined){const {error}=await sb.from('leads').select('tags_text').limit(1);S.hasTagsText=!error}
}

/* ---------- sign in ---------- */
function showAuth(msg){
  $('#app').hidden=true;const a=$('#auth');a.hidden=false;
  a.innerHTML=`<form class="auth" id="authForm"><div class="brand"><span class="brand-mark">${ic('phone')}</span><span>Dialbook</span></div>
  <div class="row"><button type="button" class="chip-toggle" data-act="authMode" data-v="in" aria-pressed="${S.authMode!=='up'}">Sign in</button><button type="button" class="chip-toggle" data-act="authMode" data-v="up" aria-pressed="${S.authMode==='up'}">Create account</button></div>
  ${S.authMode==='up'?'<label class="field"><span>Your full name</span><input class="input" id="aName" required autocomplete="name"></label>':''}
  <label class="field"><span>Email</span><input class="input" id="aEmail" type="email" required autocomplete="email"></label>
  <label class="field"><span>Password</span><input class="input" id="aPass" type="password" required minlength="6" autocomplete="${S.authMode==='up'?'new-password':'current-password'}"></label>
  <p class="small ${msg&&msg.ok?'':'prio-hot'}" id="aMsg">${esc(msg?.text||'')}</p>
  <button class="btn primary lg" type="submit">${S.authMode==='up'?'Create account':'Sign in'}</button>
  ${S.authMode==='up'?'<p class="small muted">The first account becomes the admin. Everyone after that is approved by the admin in Team.</p>':''}</form>`;
  $('#authForm').onsubmit=async e=>{e.preventDefault();const email=$('#aEmail').value.trim(),password=$('#aPass').value;const m=$('#aMsg');m.className='small muted';m.textContent='Please wait…';
    try{
      if(S.authMode==='up'){const {data,error}=await sb.auth.signUp({email,password,options:{data:{name:$('#aName').value.trim()}}});if(error)throw error;if(!data.session){S.authMode='in';return showAuth({ok:true,text:'Account created. Check your email to confirm it, then sign in.'})}}
      else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error}
      await afterLogin();
    }catch(err){m.className='small prio-hot';m.textContent=err.message==='Invalid login credentials'?'Wrong email or password.':err.message}};
}
function showPending(email){
  $('#app').hidden=true;const a=$('#auth');a.hidden=false;
  a.innerHTML=`<div class="auth"><div class="brand"><span class="brand-mark">${ic('phone')}</span><span>Dialbook</span></div><h2>Waiting for approval</h2><p>Your account <b>${esc(email)}</b> is created. Ask your admin to approve you in <b>Team</b>, then press Check again.</p><p class="small muted">Wrong email? Press <b>Sign out</b>, then <b>Create account</b> with the right one.</p><div class="row"><button class="btn primary" data-act="recheck">Check again</button><button class="btn" data-act="logout">Sign out</button></div></div>`;
}
function showSetupMissing(){const a=$('#auth');a.hidden=false;a.innerHTML=`<div class="auth"><h2>Almost there</h2><p>Open <b>config.js</b> and paste your Supabase project URL and anon key. The setup guide shows where to find them.</p></div>`}
let subscribed=false;
async function afterLogin(){
  const {data:{user}}=await sb.auth.getUser();if(!user)return showAuth();
  let {data:p}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(!p){await sb.rpc('request_access');({data:p}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle())}
  if(!p||!p.active)return showPending(user.email);
  S.me=p;await loadBase();
  $('#auth').hidden=true;$('#app').hidden=false;
  const h=(location.hash||'').slice(1);if(V[h])S.view=h;
  await loadWa();await loadSourceNames();
  render();updateBadge();waBadge();
  if(!subscribed){subscribed=true;sb.channel('dialbook').on('postgres_changes',{event:'*',schema:'public',table:'leads'},onLive).on('postgres_changes',{event:'*',schema:'public',table:'calls'},onLive).on('postgres_changes',{event:'*',schema:'public',table:'ai_calls'},onLive).on('postgres_changes',{event:'*',schema:'public',table:'wa_messages'},onLive).subscribe()}
}

/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-act]');if(!t)return;
  const a=t.dataset.act,id=t.dataset.id,v=t.dataset.v,p=t.dataset.p;
  if(a==='lead'&&e.target.closest('input,select,textarea,a,button:not([data-act="lead"])'))return;
  try{switch(a){
    case'nav':closeModal();go(v);break;
    case'moreNav':modal(`<h2>More</h2><div class="list" style="margin-top:12px">${NAV.filter(([k])=>!TABS.includes(k)).map(([k,l,i])=>`<button class="li btn" style="justify-content:flex-start" data-act="nav" data-v="${k}">${ic(i)}${l}</button>`).join('')}<button class="li btn" style="justify-content:flex-start" data-act="logout">Sign out</button></div>`);break;
    case'authMode':S.authMode=v;showAuth();break;
    case'recheck':afterLogin();break;
    case'logout':closeModal();closeDrawer();await sb.auth.signOut();S.me=null;showAuth();break;
    case'range':S.range=v;render();break;
    case'reload':V[S.view].load().catch(fail);break;
    case'lead':openLead(id);break;
    case'closeDw':closeDrawer();break;
    case'closeMd':closeModal();break;
    case'import':importModal();break;
    case'impPaste':{const r=parseCSV($('#impPaste').value);if(r.length<2)return toast('Paste a header row and at least one lead');mapStep(r);break}
    case'impRun':runImport(t);break;
    case'exportLeads':exportLeads();break;
    case'expCalls':exportCalls();break;
    case'expAgents':exportAgents();break;
    case'expWork':exportWork();break;
    case'expConv':exportConv();break;
    case'addLead':leadModal();break;
    case'editLead':leadModal(S.openLead);break;
    case'pg':S.page=Math.max(0,S.page+(+v));S.sel.clear();V.leads.load().catch(fail);window.scrollTo(0,0);break;
    case'bkClear':S.sel.clear();V.leads.load();break;
    case'bkDel':arm(t,async()=>{const ids=[...S.sel];for(const c of chunk(ids,200))await R(sb.from('leads').delete().in('id',c));S.sel.clear();toast(ids.length+' leads deleted');V.leads.load()},`Delete ${S.sel.size}? Click again`);break;
    case'bkDial':startDialer([...S.sel]);break;
    case'bkAI':{t.disabled=true;const r=await fn({action:'call',lead_ids:[...S.sel],limit:S.sel.size});toast(`${r.queued} AI calls started${r.errors.length?`, ${r.errors.length} failed`:''}`);S.sel.clear();V.leads.load();break}
    case'stageLeads':S.lf={q:'',stage:v,camp:S.pf.camp,agent:S.pf.agent,source:'',prio:'',fu:''};S.page=0;go('leads');break;
    case'copy':copyText(v);break;
    case'wa':if(waUsable().length)openChat(S.openLead);else msgModal();break;
    case'waDial':S.lead=S.dialLead;msgModal();break;
    case'msgSent':if(S.lead)addActivity(S.lead.id,'msg',v,{channel:p}).catch(()=>{});break;
    case'dial':if(p)tStart(p);break;
    case'pick':S.pick[p]=v;$$(`.dispo[data-p="${p}"]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===v)));
      {const d=dispo(v);const fi=$('#'+p+'Fu');if(d&&fi){if(d.fu&&!fi.value)fi.value=toLocalInput(d.connected?fuTime('tmr'):fuTime('3h'));if(!d.fu)fi.value=''}}break;
    case'timer':(S.tm[p]&&S.tm[p].iv)?tStop(p):tStart(p);break;
    case'fuq':$('#'+p+'Fu').value=v==='none'?'':toLocalInput(fuTime(v));break;
    case'saveCall':saveCall(p);break;
    case'logPending':S.pick.pm=null;pendingModal(id);break;
    case'savePending':{const o=readOutcome('pm');if(!o.outcome)return toast('Pick a call outcome first');await rpc('set_call_outcome',{p_call:id,p_outcome:o.outcome,p_note:o.note,p_follow_up:o.fu?iso(o.fu):null});closeModal();toast('Outcome saved');loadDrawer();break}
    case'playRec':{const {data,error}=await sb.storage.from('recordings').createSignedUrl(v,3600);if(error)throw error;const box=t.parentElement;box.innerHTML=`<audio controls autoplay src="${esc(data.signedUrl)}"></audio>`;break}
    case'addNote':{const tx=$('#dwNoteAdd').value.trim();if(!tx||!S.openLead)return;await addActivity(S.openLead,'note',tx);$('#dwNoteAdd').value='';loadDrawer();break}
    case'leadDel':arm(t,async()=>{const lid=S.openLead;closeDrawer();await R(sb.from('leads').delete().eq('id',lid));toast('Lead deleted');const v2=V[S.view];if(v2.load)v2.load()});break;
    case'aiOne':{t.disabled=true;const r=await fn({action:'call',lead_ids:[S.openLead],limit:1});toast(r.queued?'AI call started. The result will appear here.':(r.errors[0]||'Could not start the call'));loadDrawer();break}
    case'aiAssist':{const out=$('#aiOut');out.className='ai-out';out.textContent='Thinking…';t.disabled=true;try{const r=await fn({action:'assist',lead_id:S.openLead});out.textContent=r.text}catch(err){out.textContent=err.message}t.disabled=false;break}
    case'aiToggle':{if(!isAdmin())break;t.disabled=true;const {data:cur}=await R(sb.from('settings').select('data').eq('id',1).single());const d=cur.data||{};d.ai={...(d.ai||{}),enabled:!aiOn()};await R(sb.from('settings').update({data:d,updated_at:iso(now())}).eq('id',1));S.sd=null;S.sdirty=false;await loadBase();toast(d.ai.enabled?'AI calling turned on':'AI calling turned off');render();break}
    case'aiStart':{const n=Math.max(1,+$('#aiN').value||1);S.ai={camp:$('#aiCamp').value,queue:$('#aiQueue').value,n};t.disabled=true;$('#aiMsg').textContent='Starting calls…';
      try{const r=await fn({action:'call',filter:{campaign:S.ai.camp||null,queue:S.ai.queue},limit:n});$('#aiMsg').textContent=`${r.queued} calls started.${r.errors.length?' '+r.errors.length+' failed: '+r.errors.slice(0,2).join('; '):''}`;V.ai.load()}catch(err){$('#aiMsg').textContent=err.message}t.disabled=false;break}
    case'campEdit':campModal(id);break;
    case'campDel':arm(t,async()=>{await R(sb.from('campaigns').delete().eq('id',id));await loadBase();closeModal();toast('Campaign deleted. Its leads were kept.');render()});break;
    case'campLeads':S.lf={q:'',stage:'',camp:id,agent:'',source:'',prio:'',fu:''};S.page=0;go('leads');break;
    case'campDial':S.dialSetup.camp=id;S.dialer=null;go('dialer');break;
    case'memberEdit':memberModal(id);break;
    case'memberDel':arm(t,async()=>{const{error}=await sb.rpc('remove_member',{p_id:id});if(error){if(!/remove_member|function/i.test(error.message))throw error;await R(sb.from('profiles').delete().eq('id',id))}await loadBase();closeModal();toast('Removed. Their leads are now unassigned.');render()});break;
    case'approve':{await R(sb.from('profiles').update({active:true,role:$('#ap-'+id).value}).eq('id',id));toast('Approved');render();break}
    case'distribute':distributeModal();break;
    case'dsRun':{const ids=$$('.dsA:checked').map(x=>x.value);if(!ids.length)return toast('Pick at least one person');t.disabled=true;const n=await rpc('distribute_leads',{p_which:$('#dsWhich').value,p_campaign:$('#dsCamp').value||null,p_agents:ids});closeModal();toast(`${n} leads shared out`);render();break}
    case'fuDial':{const agent=isMgr()?S.fuAgent:S.me.id;let q=sb.from('leads').select('id').not('stage','in','(won,lost)').eq('dnd',false).lt('next_follow_up_at',iso(endToday())).order('next_follow_up_at').limit(500);if(agent)q=q.eq('assigned_to',agent);const {data}=await R(q);startDialer(data.map(x=>x.id));break}
    case'dsQ':S.dialSetup.queue=v;render();break;
    case'dStart':{t.disabled=true;const d=S.dialSetup;let q=queueQuery('id');q=d.order==='new'?q.order('created_at',{ascending:false}):d.order==='hot'?q.order('priority_rank').order('next_follow_up_at',{nullsFirst:false}):d.queue==='due'?q.order('next_follow_up_at'):q.order('created_at');const {data}=await R(q.limit(500));startDialer(data.map(x=>x.id));break}
    case'dSkip':tStop('dc');S.dialer.skipped++;S.dialer.i++;S.pick.dc=null;render();break;
    case'dEnd':tStop('dc');S.dialer=null;render();break;
    case'saveSet':{const d=clone(S.sd);delete d.languagesText;delete d.sourcesText;d.sources=d.sources.filter(Boolean);d.languages=(d.languages||[]).filter(Boolean);(d.assignment?.rules||[]).forEach(r=>{if(r.mode!=='people')r.agents=[]});['startHour','endHour','maxBatch'].forEach(k=>d.ai[k]=+d.ai[k]||DEF.ai[k]);await R(sb.from('settings').update({data:d,updated_at:iso(now())}).eq('id',1));S.sdirty=false;S.sd=null;await loadBase();toast('Settings saved');render();break}
    case'setAdd':{const d=S.sd;if(v==='dispositions')d.dispositions.push({id:gid('d'),name:'New outcome',connected:true,stage:'',fu:false});if(v==='stages')d.stages.splice(d.stages.length-2,0,{id:gid('s'),name:'New stage'});if(v==='templates')d.templates.push({id:gid('t'),name:'New template',channel:'whatsapp',body:'Hi {name}, '});S.sdirty=true;render();break}
    case'setDel':{const[k,i]=v.split('.');if(k==='stages'){const sid=S.sd.stages[+i].id;const {count}=await R(sb.from('leads').select('id',{count:'exact',head:true}).eq('stage',sid));if(count)return toast(`${count} leads are in this stage. Move them first.`)}S.sd[k].splice(+i,1);S.sdirty=true;render();break}
    case'setUp':{const i=+v;const s=S.sd.stages;if(i>1&&!['won','lost'].includes(s[i-1].id)){[s[i-1],s[i]]=[s[i],s[i-1]];S.sdirty=true;render()}break}
  }}catch(err){fail(err);if(t.disabled)t.disabled=false}
});
let qT;
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='lq'){S.lf.q=t.value;S.page=0;clearTimeout(qT);qT=setTimeout(()=>V.leads.load().catch(fail),350)}
  else if(t.dataset.sp&&t.type!=='checkbox'&&t.tagName!=='SELECT'){if(t.dataset.sp==='sourcesText')S.sd.sources=t.value.split('\n').map(s=>s.trim());else if(t.dataset.sp==='languagesText')S.sd.languages=t.value.split('\n').map(s=>s.trim()).filter(Boolean);else if(t.dataset.sp.startsWith('ai.agents.')){S.sd.ai.agents[t.dataset.sp.slice(10)]=t.value.trim()}else setPath(S.sd,t.dataset.sp,t.value);if(!S.sdirty){S.sdirty=true;const b=$('[data-act="saveSet"]');if(b)b.disabled=false}}
});
document.addEventListener('change',async e=>{
  const t=e.target,id=t.id;
  try{
  if(id==='hAgent'){S.hAgent=t.value;return V.home.load()}
  if(id&&id.startsWith('lf-')){S.lf[id.slice(3)]=t.value;S.page=0;S.sel.clear();return V.leads.load()}
  if(id==='selAll'){(S.pageLeads||[]).forEach(l=>t.checked?S.sel.add(l.id):S.sel.delete(l.id));return V.leads.load()}
  if(t.classList.contains('selOne')){t.checked?S.sel.add(t.dataset.id):S.sel.delete(t.dataset.id);return V.leads.load()}
  if(id==='bk-agent'||id==='bk-stage'||id==='bk-camp'){const v=t.value;if(!v)return;const ids=[...S.sel];t.disabled=true;
    if(id==='bk-agent'){if(v==='_rr'){let ag=agents().filter(m=>m.role==='telecaller').map(m=>m.id);if(!ag.length)ag=agents().map(m=>m.id);await roundRobin(ids,ag)}else{await assignLeads(ids,v==='_none'?null:v);toast(`${ids.length} leads assigned`)}}
    if(id==='bk-stage'){for(const c of chunk(ids,200)){await R(sb.from('leads').update({stage:v}).in('id',c));await R(sb.from('activities').insert(c.map(x=>({lead_id:x,actor_id:S.me.id,kind:'stage',data:{to:v}}))))}toast(`${ids.length} leads moved`)}
    if(id==='bk-camp'){for(const c of chunk(ids,200))await R(sb.from('leads').update({campaign_id:v==='_none'?null:v}).in('id',c));toast(`${ids.length} leads updated`)}
    S.sel.clear();return V.leads.load()}
  if(id==='fuAgent'){S.fuAgent=t.value;return V.followups.load()}
  if(id==='pfCamp'){S.pf.camp=t.value;return V.pipeline.load()}
  if(id==='pfAgent'){S.pf.agent=t.value;return V.pipeline.load()}
  if(id==='rFrom'||id==='rTo'){if(!t.value)return;S.rep[id==='rFrom'?'from':'to']=new Date(t.value+'T00:00').getTime();if(S.rep.to<S.rep.from)S.rep.to=S.rep.from;return V.reports.load()}
  if(id==='rAgent'){S.rep.agent=t.value;return V.reports.load()}
  if(id==='rPreset'&&t.value){const d=new Date(),y=d.getFullYear(),m=d.getMonth(),k=t.value;const start=k==='y0'?new Date(y,0,1):new Date(y,m-(k==='m1'?1:k==='m3'?2:k==='m6'?5:0),1);const end=k==='m1'?new Date(y,m,0):d;
    S.rep.from=sod(start.getTime());S.rep.to=sod(end.getTime());if($('#rFrom'))$('#rFrom').value=toDateInput(S.rep.from);if($('#rTo'))$('#rTo').value=toDateInput(S.rep.to);return V.reports.load()}
  if(id==='rCamp'){S.rep.camp=t.value;return V.reports.load()}
  if(id==='dsC'){S.dialSetup.camp=t.value;return V.dialer.load()}
  if(id==='dsW'){S.dialSetup.who=t.value;return V.dialer.load()}
  if(id==='dsO'){S.dialSetup.order=t.value;return}
  if(t.dataset.lset){const l=S.lead;if(!l)return;const k=t.dataset.lset;const v=t.type==='checkbox'?t.checked:(t.value||null);
    if(k==='stage')await changeStage(l,v);else if(k==='assigned_to'){await assignLeads([l.id],v)}else await R(sb.from('leads').update({[k]:(k==='priority'||k==='language')?(v||''):v}).eq('id',l.id));
    toast('Saved');return loadDrawer()}
  if(t.dataset.sp){const v=t.type==='checkbox'?t.checked:t.value;setPath(S.sd,t.dataset.sp,v);S.sdirty=true;const b=$('[data-act="saveSet"]');if(b)b.disabled=false}
  }catch(err){fail(err)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#md').innerHTML)closeModal();else if(S.openLead)closeDrawer()}});
let dragId=null;
document.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('.kcard');if(!c)return;dragId=c.dataset.id;try{e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move'}catch(_){}});
document.addEventListener('dragover',e=>{const c=e.target.closest&&e.target.closest('.col');if(!c||!dragId)return;e.preventDefault();$$('.col.over').forEach(x=>x!==c&&x.classList.remove('over'));c.classList.add('over')});
document.addEventListener('drop',async e=>{const c=e.target.closest&&e.target.closest('.col');$$('.col.over').forEach(x=>x.classList.remove('over'));if(!c||!dragId)return;e.preventDefault();const lid=dragId;dragId=null;
  try{const {data:l}=await R(sb.from('leads').select('id,stage,name').eq('id',lid).single());if(l.stage!==c.dataset.stage){await changeStage(l,c.dataset.stage);toast(`${l.name} moved to ${stage(c.dataset.stage)?.name}`);V.pipeline.load()}}catch(err){fail(err)}});
document.addEventListener('dragend',()=>{dragId=null;$$('.col.over').forEach(x=>x.classList.remove('over'))});


/* =================================================================== */
/* WhatsApp: team inbox, templates, connected numbers, QR login         */
/* =================================================================== */
S.wa={accounts:[],templates:[],lead:null,f:{unread:false,agent:'',q:''},gateway:false,gatewayUrl:'',sendAcc:'',unread:0,qrPoll:null,loaded:false};
const PROV={meta:'WhatsApp Business API (Meta)',twilio:'Twilio WhatsApp',custom:'Other WhatsApp API',qr:'Own WhatsApp (QR)'};
async function waFn(body){const{data,error}=await sb.functions.invoke('whatsapp',{body});if(error){let m=error.message;try{const j=await error.context.json();if(j&&j.error)m=j.error}catch(_){}throw new Error(m)}if(data&&data.error)throw new Error(data.error);return data}
async function loadWa(){
  try{const [a,t]=await Promise.all([R(sb.from('wa_accounts').select('*').order('created_at')),R(sb.from('wa_templates').select('*').order('name'))]);S.wa.accounts=a.data;S.wa.templates=t.data;S.wa.loaded=true}
  catch(e){S.wa.accounts=[];S.wa.templates=[];S.wa.missing=true}
}
async function waBadge(){try{S.wa.unread=await rpc('wa_unread_count',{})||0;renderNav()}catch(e){}}
const waUsable=()=>S.wa.accounts.filter(a=>(a.shared||a.owner_id===S.me.id)&&a.status==='connected');
const waNeedsTemplate=(acc,lastIn)=>acc&&(acc.provider==='meta'||acc.provider==='twilio')&&(!lastIn||now()-ts(lastIn)>24*36e5);
function openChat(leadId){S.wa.lead=leadId;closeDrawer();closeModal();go('wa')}
function tick(s){return s==='read'?'<span title="Read" style="color:var(--accent)">✓✓</span>':s==='delivered'?'<span title="Delivered">✓✓</span>':s==='failed'?'<span title="Not sent" class="prio-hot">!</span>':s==='queued'?'<span title="Sending">…</span>':'<span title="Sent">✓</span>'}
function fmtWhen(t){t=ts(t);if(!t)return'';return sod(t)===sod(now())?new Date(t).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}):fmtD(t)}

V.wa={mount(){
  const setupHint=!S.wa.accounts.length?`<div class="banner"><b>No WhatsApp connected yet.</b><span>${isAdmin()?'Connect your company number (WhatsApp Business API or any provider), or link your own WhatsApp with a QR code.':'Ask your admin to connect the company number, or link your own WhatsApp with a QR code.'}</span><button class="btn sm primary" data-act="nav" data-v="settings">Open WhatsApp settings</button></div>`:'';
  const f=S.wa.f;
  return head('WhatsApp',isMgr()?'Every chat your team has with leads, in one place.':'Your chats with your leads.',`<button class="btn" data-act="nav" data-v="settings">${ic('gear')}WhatsApp settings</button>`)+setupHint+
  `<div class="wa-wrap ${S.wa.lead?'wa-open':''}" id="waWrap"><div class="wa-list"><div class="wa-tools"><input class="input" id="waQ" type="search" placeholder="Search name or number" value="${esc(f.q)}" aria-label="Search chats">
    <div class="row"><button class="chip-toggle" data-act="waUnread" aria-pressed="${f.unread}">Unread only</button>${isMgr()?`<select class="input" id="waAgent" style="width:auto;flex:1" aria-label="Employee">${agentOpts(f.agent,'All employees')}</select>`:''}</div></div>
    <div id="waConvs">${loadingHTML}</div></div>
    <div class="wa-thread" id="waThread">${S.wa.lead?loadingHTML:'<div class="empty" style="margin:16px">Pick a chat on the left, or press WhatsApp on any lead to start one.</div>'}</div></div>`;
},async load(){
  const rv=S.rv;if(!S.wa.loaded)await loadWa();
  const f=S.wa.f;
  const convs=await rpc('wa_conversations',{p_agent:isMgr()?(f.agent||null):null,p_account:null,p_unread:f.unread,p_search:f.q.trim(),p_limit:200});
  if(rv!==S.rv)return;const box=$('#waConvs');if(!box)return;
  box.innerHTML=convs.length?convs.map(c=>`<button class="wa-conv ${S.wa.lead===c.lead_id?'on':''}" data-act="waOpen" data-id="${c.lead_id}">
    <span class="wa-av" style="background:${stageColor('new')}">${esc((c.lead_name||'?').trim()[0]||'?')}</span>
    <span class="grow"><span class="row" style="gap:6px"><b class="wa-name">${esc(c.lead_name||c.phone)}</b><span class="spacer"></span><span class="small muted">${esc(fmtWhen(c.last_at))}</span></span>
    <span class="row" style="gap:6px"><span class="small muted wa-snip">${c.last_dir==='out'?esc((c.last_sender===S.me.id?'You':nameOf(c.last_sender).split(' ')[0]))+': ':''}${esc((c.last_body||'').slice(0,80))}</span><span class="spacer"></span>${c.unread?`<span class="badge" style="background:var(--call)">${c.unread}</span>`:''}</span>
    ${isMgr()?`<span class="small muted">${esc(nameOf(c.assigned_to))}</span>`:''}</span></button>`).join(''):`<p class="muted small" style="padding:12px">${f.unread||f.q?'No chats match.':'No chats yet.'}</p>`;
  if(S.wa.lead)await waThread(rv);
}};

async function waThread(rv,keepComposer){
  const id=S.wa.lead;const [lr,mr]=await Promise.all([sb.from('leads').select('*').eq('id',id).maybeSingle(),sb.from('wa_messages').select('*').eq('lead_id',id).order('created_at',{ascending:false}).limit(300)]);
  if(rv!==S.rv||S.wa.lead!==id)return;const th=$('#waThread');if(!th)return;
  const l=lr.data;if(!l){th.innerHTML='<div class="empty" style="margin:16px">This lead is not available to you.</div>';return}
  const msgs=(mr.data||[]).reverse();const lastIn=[...msgs].reverse().find(m=>m.direction==='in')?.created_at;
  const usable=waUsable();
  if(!S.wa.sendAcc||!usable.find(a=>a.id===S.wa.sendAcc)){const lastAcc=[...msgs].reverse().find(m=>m.account_id&&usable.find(a=>a.id===m.account_id))?.account_id;S.wa.sendAcc=lastAcc||usable[0]?.id||''}
  const acc=S.wa.accounts.find(a=>a.id===S.wa.sendAcc);
  const bubbles=msgs.map(m=>{const a=S.wa.accounts.find(x=>x.id===m.account_id);return `<div class="bub ${m.direction}"><div class="bub-in">${m.template_name?`<span class="tag" style="margin-bottom:4px">Template · ${esc(m.template_name)}</span><br>`:''}<span class="bub-t">${esc(m.body)||'<i>(empty)</i>'}</span>${m.error?`<div class="small prio-hot">${esc(m.error)}</div>`:''}
    <div class="bub-meta">${m.direction==='out'?esc(m.sender_id?nameOf(m.sender_id):'Sent')+' · ':''}${a?esc(a.provider==='qr'?a.name:a.name)+' · ':''}${esc(fmtDT(m.created_at))} ${m.direction==='out'?tick(m.status):''}</div></div></div>`}).join('')||'<p class="muted small" style="text-align:center">No messages yet. Say hello, or send an approved template.</p>';
  const needT=waNeedsTemplate(acc,lastIn);
  if(!keepComposer||!$('#waMsgs')){
    th.innerHTML=`<div class="wa-head"><button class="btn sm ghost wa-back" data-act="waBack" aria-label="Back to chats">‹</button><div class="grow" style="min-width:0"><b>${esc(l.name||'Unnamed')}</b><div class="small muted">${esc(l.phone)}${isMgr()?' · '+esc(nameOf(l.assigned_to)):''}</div></div><button class="btn sm" data-act="lead" data-id="${l.id}">Lead</button><a class="btn sm call" href="tel:${esc(normPhone(l.phone))}">${ic('phone')}</a></div>
      <div class="wa-msgs" id="waMsgs"></div>
      <div class="wa-comp" id="waComp"></div>`;
  }
  $('#waMsgs').innerHTML=bubbles;$('#waMsgs').scrollTop=$('#waMsgs').scrollHeight;
  const comp=$('#waComp');const typed=$('#waText')?.value||'';
  comp.innerHTML=usable.length?`<div class="row" style="gap:6px;margin-bottom:6px"><select class="input" id="waAcc" style="width:auto;max-width:100%" aria-label="Send from">${usable.map(a=>opt(a.id,`${a.name} · ${a.provider==='qr'?'own WhatsApp':PROV[a.provider]}`,S.wa.sendAcc)).join('')}</select><button class="btn sm" data-act="waTpl">${ic('flag')}Template</button><a class="btn sm ghost" href="${esc(waLink(l.phone))}" target="_blank" rel="noopener">Open in WhatsApp app</a></div>
    ${needT?`<p class="small" style="margin:0 0 6px;color:var(--warn)">This customer has not messaged this number in the last 24 hours, so WhatsApp only allows an approved template right now.</p>`:''}
    <div class="row" style="align-items:flex-end;gap:6px"><textarea class="input" id="waText" rows="2" style="flex:1;min-height:44px" placeholder="${needT?'Pick a template to start the chat':'Type a message'}" ${needT?'disabled':''}>${esc(typed)}</textarea><button class="btn primary" data-act="waSend" ${needT?'disabled':''}>Send</button></div>`
    :`<p class="small muted" style="margin:0">No WhatsApp number is ready to send from. <button class="btn sm" data-act="nav" data-v="settings">Connect one</button> <a class="btn sm ghost" href="${esc(waLink(l.phone))}" target="_blank" rel="noopener">Open in WhatsApp app</a></p>`;
  S.wa.threadLead=l;
  if(msgs.some(m=>m.direction==='in'&&!m.read_at)){rpc('wa_mark_read',{p_lead:id}).then(waBadge).catch(()=>{})}
}
async function waSendText(btn){
  const t=$('#waText');const text=t.value.trim();if(!text)return;btn.disabled=true;
  try{await waFn({action:'send',lead_id:S.wa.lead,account_id:$('#waAcc').value,text});t.value='';await waThread(S.rv,true);V.wa.load()}catch(e){fail(e)}finally{btn.disabled=false}
}
function waTemplateModal(){
  const accId=$('#waAcc')?.value||S.wa.sendAcc;const acc=S.wa.accounts.find(a=>a.id===accId);const l=S.wa.threadLead;
  const list=S.wa.templates.filter(t=>t.account_id===accId&&!/REJECTED|DISABLED|PAUSED/i.test(t.status));
  if(!list.length)return modal(`<h2>No templates yet</h2><p class="muted">${acc&&(acc.provider==='meta'||acc.provider==='twilio')?'Create and get templates approved in your provider, then press “Sync templates” in Settings → WhatsApp.':'Add message templates for this number in Settings → WhatsApp.'}</p>`);
  modal(`<h2>Send a template</h2><label class="field" style="margin-top:12px"><span>Template</span><select class="input" id="tplSel">${list.map(t=>opt(t.id,`${t.name} (${t.language})${t.status&&t.status!=='APPROVED'?' · '+t.status:''}`)).join('')}</select></label><div id="tplBody" style="margin-top:12px"></div><div class="row" style="margin-top:12px"><button class="btn primary" data-act="waTplSend">Send template</button><button class="btn" data-act="closeMd">Cancel</button></div>`);
  const draw=()=>{const t=list.find(x=>x.id===$('#tplSel').value);const n=t.params||0;const first=(l?.name||'').split(' ')[0];
    $('#tplBody').innerHTML=(t.header_type?`<label class="field"><span>${esc(t.header_type[0].toUpperCase()+t.header_type.slice(1))} link</span><input class="input mono" id="tplHUrl" value="${esc(t.header_url||'')}"></label>`:'')+(n?`<div class="grid2">${Array.from({length:n},(_,i)=>`<label class="field"><span>Value {{${i+1}}}</span><input class="input tplP" data-i="${i}" value="${esc(i===0?first:i===1?(S.cfg.company||''):'')}"></label>`).join('')}</div>`:'')+`<p class="small muted" style="margin-top:10px">Preview</p><div class="ai-out" id="tplPrev"></div>`;
    const prev=()=>{const ps=$$('.tplP').map(x=>x.value);$('#tplPrev').textContent=String(t.body||t.name).replace(/\{\{(\d+)\}\}/g,(m,k)=>ps[k-1]||m)};
    $$('.tplP').forEach(x=>x.oninput=prev);prev()};
  $('#tplSel').onchange=draw;draw();
}
async function waTemplateSend(btn){
  btn.disabled=true;
  try{await waFn({action:'send',lead_id:S.wa.lead,account_id:$('#waAcc')?.value||S.wa.sendAcc,template_id:$('#tplSel').value,params:$$('.tplP').map(x=>x.value),header_url:$('#tplHUrl')?.value.trim()||undefined});closeModal();toast('Template sent');await waThread(S.rv,true);V.wa.load()}
  catch(e){fail(e);btn.disabled=false}
}

/* ---------------- Settings: WhatsApp ---------------- */
async function waSettings(){
  const box=$('#waSet');if(!box)return;
  await loadWa();
  try{const st=await waFn({action:'status'});S.wa.gateway=st.gateway;S.wa.gatewayUrl=st.gatewayUrl||''}catch(e){S.wa.fnMissing=e.message}
  if(!$('#waSet'))return;
  if(S.wa.missing){box.innerHTML=`<div class="card"><h2>WhatsApp</h2><p class="muted">The WhatsApp add-on is not installed yet. Run <b>supabase/whatsapp.sql</b> and add the two WhatsApp functions (see the setup guide).</p></div>`;return}
  const mine=S.wa.accounts.find(a=>a.provider==='qr'&&a.owner_id===S.me.id);
  const pill=s=>`<span class="pill" style="color:${s==='connected'?'var(--call)':s==='setup'?'var(--warn)':'var(--danger)'}"><span class="dot"></span><span style="color:var(--fg)">${s==='connected'?'Connected':s==='setup'?'Waiting':'Not connected'}</span></span>`;
  const company=S.wa.accounts.filter(a=>a.provider!=='qr');const personal=S.wa.accounts.filter(a=>a.provider==='qr'&&a.owner_id!==S.me.id);
  let h=`<div class="card"><h2>My WhatsApp</h2><p class="small muted" style="margin-top:-6px">Link the WhatsApp on your own phone by scanning a QR code, like WhatsApp Web. Chats with your leads then appear in the CRM, and your admin can see them. Personal chats are never saved.</p>
    ${S.wa.gateway?(mine?`<div class="row">${pill(mine.status)}<b>${esc(mine.phone||mine.name)}</b><span class="spacer"></span>${mine.status!=='connected'?`<button class="btn sm primary" data-act="waQr">Scan QR code</button>`:''}<button class="btn sm" data-act="waQrLogout" data-id="${mine.id}">Disconnect</button><button class="btn sm danger" data-act="waAccDel" data-id="${mine.id}">Remove</button></div>`:`<button class="btn primary" data-act="waQr">Link my WhatsApp</button>`)
      :`<p class="small">${isAdmin()?'To use this, set up the WhatsApp gateway below first.':'Your admin has not set up QR linking yet.'}</p>`}
    <p class="small muted" style="margin-top:10px">Linking a personal number uses an unofficial connection. WhatsApp may ban numbers that send bulk or unwanted messages. Use it for one-to-one follow-ups only, and use the Business API for campaigns.</p></div>`;
  if(isAdmin()){
    h+=`<div class="card"><div class="row"><h2 style="margin:0">Company WhatsApp numbers</h2><span class="spacer"></span><button class="btn primary sm" data-act="waConnect">${ic('plus')}Connect a number</button></div>
      <p class="small muted">Everyone on the team can send from these numbers. Replies go to the lead's owner, and admins see every chat.</p>
      ${company.length?`<div class="list">${company.map(a=>`<div class="li"><div class="grow"><b>${esc(a.name)}</b> ${pill(a.status)}<div class="small muted">${esc(PROV[a.provider])}${a.phone?' · '+esc(a.phone):''} · ${S.wa.templates.filter(t=>t.account_id===a.id).length} templates</div></div>
        <button class="btn sm" data-act="waTest" data-id="${a.id}">Test</button><button class="btn sm" data-act="waTpls" data-id="${a.id}">Templates</button><button class="btn sm" data-act="waHook" data-id="${a.id}">Webhook</button><button class="btn sm ghost" data-act="waConnect" data-id="${a.id}">${ic('edit')}Edit</button><button class="btn sm danger" data-act="waAccDel" data-id="${a.id}">Remove</button></div>`).join('')}</div>`:'<p class="muted small">No company number yet.</p>'}</div>`;
    if(personal.length)h+=`<div class="card"><h2>Team members' linked WhatsApp</h2><div class="list">${personal.map(a=>`<div class="li"><div class="grow"><b>${esc(nameOf(a.owner_id))}</b> ${pill(a.status)}<div class="small muted">${esc(a.phone||'')}</div></div><button class="btn sm" data-act="waTpls" data-id="${a.id}">Templates</button><button class="btn sm danger" data-act="waAccDel" data-id="${a.id}">Remove</button></div>`).join('')}</div></div>`;
    h+=`<div class="card"><h2>WhatsApp gateway (for QR linking)</h2><p class="small muted" style="margin-top:-6px">QR linking runs through Evolution API, a free program you host on a small server. The setup guide shows how. Paste its address and API key here.</p>
      <div class="grid2"><label class="field"><span>Gateway address</span><input class="input mono" id="gwUrl" value="${esc(S.wa.gatewayUrl)}" placeholder="https://wa.yourcompany.com"></label><label class="field"><span>Gateway API key</span><input class="input mono" id="gwKey" type="password" placeholder="${S.wa.gateway?'Saved. Type to replace':'API key'}"></label></div>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="waGwSave">Save gateway</button>${S.wa.gateway?'<span class="small" style="color:var(--call)">Gateway connected</span>':''}</div></div>`;
  }
  box.innerHTML=`<div style="display:flex;flex-direction:column;gap:16px">${h}</div>`;
}
function waConnectModal(id){
  const a=id?S.wa.accounts.find(x=>x.id===id):null;const c=a?.config||{};const p=a?.provider||S.wa.newProv||'meta';S.wa.newProv=p;
  const f=(k,l,v,ph='',type='text',hint='')=>`<label class="field"><span>${l}</span><input class="input ${type==='password'?'':'mono'}" data-wf="${k}" type="${type}" value="${esc(v||'')}" placeholder="${esc(ph)}">${hint?`<small class="muted">${hint}</small>`:''}</label>`;
  const ta=(k,l,v,ph)=>`<label class="field"><span>${l}</span><textarea class="input mono" data-wf="${k}" rows="3" placeholder="${esc(ph)}">${esc(v||'')}</textarea></label>`;
  const keep=a?'Saved. Leave empty to keep':'';
  let fields='';
  if(p==='meta')fields=f('config.phone_number_id','Phone number ID',c.phone_number_id,'e.g. 1234567890','text','WhatsApp Manager → API setup')+f('config.waba_id','WhatsApp Business Account ID',c.waba_id,'e.g. 1098765432')+f('secrets.token','Permanent access token','',keep||'EAAG…','password','From a System User in Meta Business settings')+f('secrets.app_secret','App secret (optional)','',keep||'Adds signature checking')+f('config.api_version','Graph API version',c.api_version||'v23.0');
  if(p==='twilio')fields=f('config.account_sid','Account SID',c.account_sid,'AC…')+f('secrets.auth_token','Auth token','',keep||'Auth token','password')+f('config.from','WhatsApp sender number',c.from,'+91…')+f('config.messaging_service_sid','Messaging Service SID (optional)',c.messaging_service_sid,'MG…');
  if(p==='custom')fields=`<p class="small muted" style="grid-column:1/-1">Works with most WhatsApp providers (Interakt, AiSensy, Gupshup, WATI, 360dialog, your own server…). Copy the “send message” example from their API page. Use {{to_digits}}, {{to}}, {{text}}, {{template}}, {{language}}, {{param1}}, {{param2}}… and {{secret.token}} where your values go.</p>`+
    f('config.url','Send message URL',c.url,'https://api.provider.com/v1/messages')+`<label class="field"><span>Method</span><select class="input" data-wf="config.method">${opt('POST','POST',c.method||'POST')}${opt('PUT','PUT',c.method)}</select></label>`+
    f('secrets.token','API key / token','',keep||'Your provider API key','password')+ta('config.headers','Headers (JSON)',c.headers,'{"Authorization":"Bearer {{secret.token}}"}')+
    ta('config.text_body','Text message body (JSON)',c.text_body,'{"to":"{{to_digits}}","type":"text","text":"{{text}}"}')+ta('config.template_body','Template message body (JSON)',c.template_body,'{"to":"{{to_digits}}","template":"{{template}}","params":{{params_json}}}')+
    f('config.id_path','Where the message ID is in the answer',c.id_path,'e.g. data.id or messages.0.id')+
    `<p class="small muted" style="grid-column:1/-1;margin-bottom:0">Incoming messages (optional): where the provider puts each field in its webhook.</p>`+
    f('config.inbound.list_path','List of messages',c.inbound?.list_path,'e.g. messages (empty if one per call)')+f('config.inbound.from_path','Sender number',c.inbound?.from_path,'e.g. from')+f('config.inbound.text_path','Message text',c.inbound?.text_path,'e.g. text.body')+f('config.inbound.id_path','Message ID',c.inbound?.id_path,'e.g. id')+f('config.inbound.name_path','Sender name',c.inbound?.name_path,'e.g. contact.name')+f('config.inbound.status_id_path','Status: message ID',c.inbound?.status_id_path,'e.g. message_id')+f('config.inbound.status_path','Status: value',c.inbound?.status_path,'e.g. status');
  modal(`<h2>${a?'Edit':'Connect'} a WhatsApp number</h2>
    ${a?'':`<div class="row" style="margin:12px 0">${['meta','twilio','custom'].map(k=>`<button class="chip-toggle" data-act="waProv" data-v="${k}" aria-pressed="${p===k}">${PROV[k]}</button>`).join('')}</div>`}
    ${p==='meta'?'<p class="small muted">The official WhatsApp Business Platform from Meta. Needs a verified Meta Business account and a number registered for the API.</p>':''}
    <div class="grid2" style="margin-top:10px">${f('name','Name shown in the CRM',a?.name||(p==='meta'?'Company WhatsApp':''),'e.g. Sales WhatsApp')}${f('phone','Phone number',a?.phone,'+91…')}${fields}</div>
    <label class="row" style="margin-top:10px"><input type="checkbox" id="waShared" ${a?.shared===false?'':'checked'}> Everyone on the team can send from this number</label>
    <p id="waMsg" class="small prio-hot"></p><div class="row"><button class="btn primary" data-act="waSaveAcc" data-id="${a?.id||''}">Save and connect</button><button class="btn" data-act="closeMd">Cancel</button></div>`);
}
async function waSaveAccount(btn){
  const out={config:{},secrets:{}};const put=(o,path,v)=>{const k=path.split('.');let x=o;for(let i=0;i<k.length-1;i++)x=x[k[i]]=x[k[i]]||{};x[k[k.length-1]]=v};
  $$('[data-wf]').forEach(el=>{const v=el.value.trim();if(v!=='')put(out,el.dataset.wf,v)});
  const id=btn.dataset.id;const old=id?S.wa.accounts.find(x=>x.id===id):null;
  const cfg={...(old?.config||{}),...out.config};if(old&&out.config.inbound)cfg.inbound={...(old.config.inbound||{}),...out.config.inbound};
  if(cfg.headers){try{JSON.parse(cfg.headers)}catch(e){$('#waMsg').textContent='Headers must be valid JSON, like {"Authorization":"Bearer {{secret.token}}"}';return}}
  btn.disabled=true;$('#waMsg').textContent='';
  try{const r=await waFn({action:'save_account',id:id||undefined,name:out.name||old?.name||'WhatsApp',phone:out.phone||old?.phone||'',provider:old?.provider||S.wa.newProv,shared:$('#waShared').checked,config:cfg,secrets:out.secrets});
    await loadWa();waHookModal(r.account.id,true);waSettings();
    if(r.account.provider!=='custom')waFn({action:'test_account',account_id:r.account.id}).then(t=>toast(t.message)).catch(e=>toast('Saved, but the test failed: '+e.message));
  }catch(e){$('#waMsg').textContent=e.message;btn.disabled=false}
}
function waHookModal(id,fresh){
  const a=S.wa.accounts.find(x=>x.id===id);if(!a)return;const url=`${CFG.url}/functions/v1/whatsapp-webhook?a=${a.id}&t=${a.webhook_token}`;
  const how=a.provider==='meta'?`In Meta for Developers → your app → WhatsApp → Configuration → Webhook, press Edit. Paste the Callback URL and the Verify token, press Verify and save. Then subscribe to the <b>messages</b> field.`
    :a.provider==='twilio'?`In Twilio Console → Messaging → your WhatsApp sender, set “When a message comes in” to this URL (POST). Delivery updates are set up automatically.`
    :`In your provider's dashboard, set this URL as the webhook for incoming messages and delivery updates.`;
  modal(`<h2>${fresh?'Saved. One last step':'Webhook for '+esc(a.name)}</h2><p>${how}</p>
    <label class="field" style="margin-top:12px"><span>Callback / webhook URL</span><div class="code-box">${esc(url)}</div></label><button class="btn sm" data-act="copy" data-v="${esc(url)}" style="margin-top:6px">${ic('copy')}Copy URL</button>
    ${a.provider==='meta'?`<label class="field" style="margin-top:12px"><span>Verify token</span><div class="code-box">${esc(a.webhook_token)}</div></label><button class="btn sm" data-act="copy" data-v="${esc(a.webhook_token)}" style="margin-top:6px">${ic('copy')}Copy token</button>`:''}
    <p class="small muted" style="margin-top:12px">Keep this URL private. Anyone with it could send fake messages into the CRM.</p>
    ${(a.provider==='meta'||a.provider==='twilio')?`<div class="row" style="margin-top:12px"><button class="btn primary" data-act="waSync" data-id="${a.id}">Sync approved templates now</button></div>`:''}`);
}
function waTemplatesModal(id){
  const a=S.wa.accounts.find(x=>x.id===id);if(!a)return;const list=S.wa.templates.filter(t=>t.account_id===id);
  const manual=a.provider==='custom'||a.provider==='qr';
  modal(`<h2>Templates · ${esc(a.name)}</h2>${manual?'<p class="small muted">Add the templates approved with your provider (or, for your own WhatsApp, ready-made messages). Use {{1}}, {{2}} for values filled in when sending.</p>':'<p class="small muted">Templates are created and approved in your provider. Press Sync to fetch the latest.</p>'}
    <div class="row" style="margin:10px 0">${!manual?`<button class="btn primary sm" data-act="waSync" data-id="${id}">Sync templates</button>`:''}</div>
    <div class="list">${list.map(t=>`<div class="li" style="align-items:flex-start"><div class="grow"><b>${esc(t.name)}</b> <span class="small muted">${esc(t.language)} · ${esc(t.status)}${t.category?' · '+esc(t.category):''}${t.header_type?' · '+esc(t.header_type)+' header':''}</span><div class="small" style="white-space:pre-wrap">${esc(t.body)}</div></div><button class="btn sm ghost" data-act="waTplDel" data-id="${t.id}" data-v="${id}" aria-label="Delete">${ic('x')}</button></div>`).join('')||'<p class="muted small">No templates yet.</p>'}</div>
    ${manual?`<h3 style="margin-top:16px">Add a template</h3><div class="grid2" style="margin-top:8px"><label class="field"><span>Template name</span><input class="input mono" id="ntName" placeholder="e.g. followup_1"></label><label class="field"><span>Language code</span><input class="input mono" id="ntLang" value="en"></label></div>
      <label class="field" style="margin-top:8px"><span>Message</span><textarea class="input" id="ntBody" rows="3" placeholder="Hi {{1}}, thanks for your interest in {{2}}."></textarea></label>
      <div class="grid2" style="margin-top:8px"><label class="field"><span>Header</span><select class="input" id="ntHType">${opt('','None (or text)','')}${opt('image','Image','')}${opt('video','Video','')}${opt('document','Document (PDF)','')}</select></label><label class="field"><span>Header file link</span><input class="input mono" id="ntHUrl" placeholder="https://… (public link to the image, video or PDF)"></label></div>
      <p class="small muted" style="margin-top:4px">Buttons (links, quick replies) approved with the template are sent automatically.</p><button class="btn sm primary" data-act="waTplAdd" data-id="${id}" style="margin-top:8px">Add template</button>`:''}`);
}
function loadScript(src,globalName){return new Promise((res,rej)=>{if(window[globalName])return res(window[globalName]);const s=document.createElement('script');s.src=src;s.onload=()=>res(window[globalName]);s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)})}
async function waQrModal(){
  modal(`<h2>Link your WhatsApp</h2><ol class="small" style="padding-left:18px;line-height:1.7"><li>Open WhatsApp on your phone.</li><li>Tap <b>⋮ Menu</b> (Android) or <b>Settings</b> (iPhone) → <b>Linked devices</b> → <b>Link a device</b>.</li><li>Point your phone at this code.</li></ol>
    <div id="qrBox" style="display:grid;place-items:center;min-height:280px;background:#fff;border-radius:12px;padding:12px">${loadingHTML}</div><p id="qrMsg" class="small muted" style="text-align:center"></p>`);
  const tick=async(fresh)=>{
    if(!$('#qrBox'))return waQrStop();
    try{
      if(fresh){const r=await waFn({action:'qr_start'});S.wa.qrAcc=r.account_id;await loadWa();
        if(r.state==='open'){return waQrDone()}
        const box=$('#qrBox');if(!box)return;box.innerHTML='';
        if(r.qr_image){box.innerHTML=`<img src="${esc(r.qr_image.startsWith('data:')?r.qr_image:'data:image/png;base64,'+r.qr_image)}" alt="WhatsApp QR code" style="width:260px;height:260px">`}
        else if(r.qr_code){const Q=await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js','QRCode');new Q(box,{text:r.qr_code,width:260,height:260,correctLevel:Q.CorrectLevel.L})}
        else box.innerHTML='<p class="muted">Waiting for the code…</p>';
        $('#qrMsg').textContent=r.pairing_code?`Or link with phone number instead: code ${r.pairing_code}`:'The code refreshes by itself.';
      }else{const s=await waFn({action:'qr_status',account_id:S.wa.qrAcc});if(s.state==='open')return waQrDone()}
    }catch(e){const m=$('#qrMsg');if(m){m.textContent=e.message;m.className='small prio-hot'}}
  };
  waQrStop();await tick(true);let n=0;
  S.wa.qrPoll=setInterval(()=>{n++;tick(n%12===0)},3000);
}
function waQrStop(){if(S.wa.qrPoll){clearInterval(S.wa.qrPoll);S.wa.qrPoll=null}}
async function waQrDone(){waQrStop();const b=$('#qrBox');if(b)b.innerHTML=`<div style="text-align:center;color:#12834a"><div style="font-size:3rem">✓</div><b>WhatsApp linked</b></div>`;$('#qrMsg').textContent='Chats with your leads will now appear in WhatsApp.';await loadWa();waSettings();setTimeout(closeModal,1800)}

/* ---------------- Nurture sequences ---------------- */
S.nu={seqs:[],counts:{},missing:false};
const NU_VARS='{first_name}, {name}, {city}, {program}, {address}, {company}, {agent}';
async function nuLoad(){
  try{const {data}=await R(sb.from('nurture_sequences').select('*').order('created_at'));S.nu.seqs=data;S.nu.missing=false}catch(e){S.nu.seqs=[];S.nu.missing=true}
}
const nuAccounts=()=>S.wa.accounts.filter(a=>a.provider!=='qr');
const nuTplName=id=>{const t=S.wa.templates.find(x=>x.id===id);return t?`${t.name} (${t.language})`:''};
async function nuSettings(){
  const box=$('#nuSet');if(!box)return;
  await nuLoad();if(!S.wa.loaded)await loadWa();if(!$('#nuSet'))return;
  if(S.nu.missing){box.innerHTML=`<div class="card"><h2>Nurture sequences</h2><p class="muted">Not installed yet. Run <b>supabase/nurture.sql</b> in the Supabase SQL editor and redeploy the <b>whatsapp</b> function.</p></div>`;return}
  const counts={};await Promise.all(S.nu.seqs.map(async q=>{const [a,d]=await Promise.all([sb.from('nurture_enrollments').select('id',{count:'exact',head:true}).eq('sequence_id',q.id).eq('status','active'),sb.from('nurture_enrollments').select('id',{count:'exact',head:true}).eq('sequence_id',q.id).neq('status','active')]);counts[q.id]={active:a.count||0,ended:d.count||0}}));
  S.nu.counts=counts;if(!$('#nuSet'))return;const d=S.sd;
  box.innerHTML=`<div class="card"><h2>Nurture sequences</h2><p class="small muted" style="margin-top:-6px">Automatic WhatsApp follow-ups: each step sends an approved template a set number of days after the lead joins. A lead's sequence stops when they reply, are converted or lost, or are marked do not call. Use ${esc(NU_VARS)} in template values.</p>
    <div class="list">${S.nu.seqs.map(q=>{const c=counts[q.id]||{};const steps=(q.steps||[]);return `<div class="li" style="align-items:flex-start"><div class="grow"><b>${esc(q.name)}</b> ${q.active?'<span class="pill" style="color:var(--call)"><span class="dot"></span><span style="color:var(--fg)">On</span></span>':'<span class="pill" style="color:var(--muted)"><span class="dot"></span><span style="color:var(--fg)">Off</span></span>'}
      <div class="small muted">${esc(q.campaign_id?(camp(q.campaign_id)?.name||'Program'):'Any program')} · ${esc(q.language||'Any language')} · ${esc(q.cities||'Any city')} · ${q.auto_enroll?'new leads join automatically':'manual only'} · ${c.active||0} in progress, ${c.ended||0} finished or stopped</div>
      <div class="small" style="margin-top:4px">${steps.map((x,i)=>`Day ${esc(x.day)}: ${esc(nuTplName(x.template_id)||'— pick a template —')}`).join(' → ')||'<span class="muted">No steps</span>'}</div></div>
      <button class="btn sm" data-act="nuEdit" data-id="${q.id}">${ic('edit')}Edit</button><button class="btn sm" data-act="nuExisting" data-id="${q.id}">Add existing leads</button></div>`}).join('')||'<p class="muted small">No sequences yet.</p>'}</div>
    <div class="row" style="margin-top:12px"><button class="btn sm" data-act="nuEdit">${ic('plus')}New sequence</button><button class="btn sm" data-act="nuRun">Send due messages now</button><span id="nuMsg" class="small muted"></span></div>
    <div class="grid2" style="margin-top:12px;max-width:520px"><label class="field"><span>Send between (hour, IST)</span><input class="input" type="number" min="0" max="23" data-sp="nurture.startHour" value="${esc(d?.nurture?.startHour??9)}"></label><label class="field"><span>and (hour, IST)</span><input class="input" type="number" min="1" max="24" data-sp="nurture.endHour" value="${esc(d?.nurture?.endHour??20)}"></label></div>
    <p class="small muted">Messages due outside these hours wait for the next window. Save changes at the top after editing the hours.</p></div>`;
}
function nuStepRow(st,i,accId){const tpls=S.wa.templates.filter(t=>t.account_id===accId&&!/REJECTED|DISABLED|PAUSED/i.test(t.status));const t=tpls.find(x=>x.id===st.template_id);
  return `<div class="nu-step" data-i="${i}" style="border-top:1px solid var(--line);padding:10px 0;display:grid;grid-template-columns:90px 1fr;gap:8px;align-items:end">
    <label class="field"><span>Day</span><input class="input nuDay" type="number" min="0" max="365" value="${esc(st.day??0)}"></label>
    <label class="field"><span>Template</span><select class="input nuTpl">${opt('','— pick —',st.template_id||'')}${tpls.map(x=>opt(x.id,`${x.name} (${x.language})`,st.template_id||'')).join('')}</select></label>
    <label class="field" style="grid-column:1/-1"><span>Values for {{1}}, {{2}}… separated by | ${t?`<span class="muted">(this template has ${t.params||0})</span>`:''}</span><input class="input nuPar" value="${esc(st.params??'{first_name}')}" placeholder="{first_name}|{program}"></label>
    ${t?.header_type?`<label class="field" style="grid-column:1/-1"><span>${esc(t.header_type)} link (empty = the template's default)</span><input class="input mono nuHdr" value="${esc(st.header_url||'')}" placeholder="${esc(t.header_url||'https://…')}"></label>`:''}
    <div style="grid-column:1/-1"><button class="btn sm ghost" data-act="nuStepDel" data-v="${i}">Remove step</button></div></div>`}
function nuReadForm(){const q=S.nu.edit;q.name=$('#nuName').value.trim();q.account_id=$('#nuAcc').value||null;q.campaign_id=$('#nuCamp').value||null;q.language=$('#nuLang').value||'';q.cities=$('#nuCities').value.trim();q.address=$('#nuAddr').value.trim();q.active=$('#nuActive').checked;q.auto_enroll=$('#nuAuto').checked;q.stop_on_reply=$('#nuStop').checked;q.end_followup=$('#nuEnd').checked;
  q.steps=$$('.nu-step').map(r=>({day:Math.max(0,+r.querySelector('.nuDay').value||0),template_id:r.querySelector('.nuTpl').value||null,params:r.querySelector('.nuPar').value,...(r.querySelector('.nuHdr')?.value.trim()?{header_url:r.querySelector('.nuHdr').value.trim()}:{})}));return q}
function nuModal(){const q=S.nu.edit;const accs=nuAccounts();if(!q.account_id&&accs.length)q.account_id=accs[0].id;
  modal(`<h2>${q.id?'Edit':'New'} nurture sequence</h2><div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
    <div class="grid2"><label class="field"><span>Name</span><input class="input" id="nuName" value="${esc(q.name||'')}" placeholder="e.g. Gold Appraisal – Chennai follow-up"></label>
    <label class="field"><span>Send from</span><select class="input" id="nuAcc">${accs.map(a=>opt(a.id,a.name,q.account_id||'')).join('')||opt('','No company WhatsApp number yet','')}</select></label>
    <label class="field"><span>Program</span><select class="input" id="nuCamp">${campOpts(q.campaign_id||'','Any program')}</select></label>
    <label class="field"><span>Lead language</span><select class="input" id="nuLang">${langOpts(q.language||'','Any language')}</select></label>
    <label class="field"><span>Lead city (empty = any)</span><input class="input" id="nuCities" value="${esc(q.cities||'')}" placeholder="e.g. Chennai, Chengalpattu"></label>
    <label class="field" style="grid-column:1/-1"><span>Venue address (use {address} in template values)</span><textarea class="input" id="nuAddr" rows="2" placeholder="e.g. Global Gold Foundation Pvt Ltd, Anna Nagar, Chennai">${esc(q.address||'')}</textarea></label></div>
    <p class="small muted" style="margin:-4px 0 0">Each lead gets the most specific matching sequence: program first, then language, then city (from the lead's City field; “Chennai” also matches “Chennai, Tamil Nadu”). A sequence with nothing set is the fallback for everyone else.</p>
    <label class="row"><input type="checkbox" id="nuActive" ${q.active?'checked':''}> Sequence is on</label>
    <label class="row"><input type="checkbox" id="nuAuto" ${q.auto_enroll!==false?'checked':''}> New leads in this program join automatically</label>
    <label class="row"><input type="checkbox" id="nuStop" ${q.stop_on_reply!==false?'checked':''}> Stop when the lead replies on WhatsApp</label>
    <label class="row"><input type="checkbox" id="nuEnd" ${q.end_followup!==false?'checked':''}> After the last step, put the lead in today's follow-ups for a call</label>
    <div><h3 style="margin:6px 0 0">Steps</h3><p class="small muted">Day 0 = within 15 minutes of joining. Days count from when the lead joined. Values can use ${esc(NU_VARS)}.</p><div id="nuSteps">${(q.steps||[]).map((st,i)=>nuStepRow(st,i,q.account_id)).join('')}</div>
    <button class="btn sm" data-act="nuStepAdd">${ic('plus')}Add step</button></div>
    <p id="nuErr" class="small prio-hot"></p>
    <div class="row"><button class="btn primary" data-act="nuSave">Save</button><button class="btn" data-act="closeMd">Cancel</button>${q.id?`<span class="spacer"></span><button class="btn danger" data-act="nuDel" data-id="${q.id}">Delete</button>`:''}</div></div>`);
  $('#nuAcc')?.addEventListener('change',()=>{nuReadForm();nuModal()});
  $$('.nuTpl').forEach(x=>x.addEventListener('change',()=>{nuReadForm();nuModal()}));
}
async function nuLeadBox(l){
  const box=$('#dwNu');if(!box)return;
  const {data,error}=await sb.from('nurture_enrollments').select('*, seq:nurture_sequences(name,steps)').eq('lead_id',l.id).order('enrolled_at',{ascending:false}).limit(5);
  if(error||S.openLead!==l.id||!$('#dwNu'))return;
  if(!S.nu.seqs.length)await nuLoad();
  const can=isMgr()||l.assigned_to===S.me.id;const act=(data||[]).find(e=>e.status==='active');
  const startable=S.nu.seqs.filter(q=>q.active&&(q.steps||[]).length);
  if(!(data||[]).length&&!(can&&startable.length&&!act))return box.innerHTML='';
  box.innerHTML=`<div class="card" style="margin-top:14px"><h2>Nurture</h2>${(data||[]).map(e=>{const n=(e.seq?.steps||[]).length;return `<div class="row small" style="margin-top:6px"><div class="grow"><b>${esc(e.seq?.name||'Sequence')}</b> · ${e.status==='active'?`step ${e.step+1} of ${n}, next ${esc(fmtDT(e.next_at))}${e.last_error?` <span class="prio-hot">(retrying: ${esc(e.last_error.slice(0,80))})</span>`:''}`:e.status==='done'?'finished':`stopped${e.stop_reason?': '+esc(e.stop_reason):''}`}</div>${e.status==='active'&&can?`<button class="btn sm" data-act="nuStopLead" data-id="${e.id}">Stop</button>`:''}</div>`}).join('')}
    ${can&&!act&&startable.length?`<div class="row" style="margin-top:10px"><select class="input" id="nuPick" style="width:auto">${startable.map(q=>opt(q.id,q.name)).join('')}</select><button class="btn sm" data-act="nuStartLead">Start sequence</button></div>`:''}</div>`;
}
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,id=t.dataset.id,v=t.dataset.v;
  if(!a.startsWith('nu'))return;
  try{switch(a){
    case'nuEdit':{if(!S.wa.loaded)await loadWa();const q=id?clone(S.nu.seqs.find(x=>x.id===id)):{name:'',language:'',cities:'',address:'',active:false,auto_enroll:true,stop_on_reply:true,end_followup:true,campaign_id:null,account_id:null,steps:[{day:0,params:'{first_name}'},{day:2,params:'{first_name}'},{day:5,params:'{first_name}'},{day:10,params:'{first_name}'}]};S.nu.edit=q;nuModal();break}
    case'nuStepAdd':{const q=nuReadForm();const last=(q.steps||[]).slice(-1)[0];q.steps.push({day:last?(+last.day||0)+3:0,params:'{first_name}'});nuModal();break}
    case'nuStepDel':{const q=nuReadForm();q.steps.splice(+v,1);nuModal();break}
    case'nuSave':{const q=nuReadForm();const err=m=>{$('#nuErr').textContent=m};
      if(!q.name)return err('Give the sequence a name.');if(!q.account_id)return err('Connect a company WhatsApp number first (Settings → WhatsApp).');if(!q.steps.length)return err('Add at least one step.');
      if(q.active&&q.steps.some(x=>!x.template_id))return err('Pick a template for every step before switching the sequence on.');
      q.steps.sort((x,y)=>x.day-y.day);const row={name:q.name,account_id:q.account_id,campaign_id:q.campaign_id,language:q.language||'',cities:q.cities||'',address:q.address||'',active:q.active,auto_enroll:q.auto_enroll,stop_on_reply:q.stop_on_reply,end_followup:q.end_followup,steps:q.steps};
      if(q.id)await R(sb.from('nurture_sequences').update(row).eq('id',q.id));else await R(sb.from('nurture_sequences').insert(row));
      closeModal();toast('Saved');nuSettings();break}
    case'nuDel':arm(t,async()=>{await R(sb.from('nurture_sequences').delete().eq('id',id));closeModal();toast('Deleted');nuSettings()},'Delete sequence?');break;
    case'nuExisting':{const q=S.nu.seqs.find(x=>x.id===id);if(!q?.active)return toast('Switch the sequence on first (Edit → Sequence is on).');
      const days=prompt(`Add open ${q.language?q.language+' ':''}leads${q.campaign_id?' of '+(camp(q.campaign_id)?.name||'this program'):''} that joined in the last how many days?`,'30');if(days===null)break;
      const n=await rpc('nurture_enroll_existing',{p_seq:id,p_days:Math.max(1,+days||30)});toast(`${n||0} leads added to “${q.name}”`);nuSettings();break}
    case'nuRun':{t.disabled=true;$('#nuMsg').textContent='Sending…';try{const r=await waFn({action:'nurture_run'});$('#nuMsg').textContent=r.skipped||`${r.sent||0} sent, ${r.failed||0} failed, ${r.stopped||0} stopped, ${r.done||0} finished`}finally{t.disabled=false}nuSettings();break}
    case'nuStopLead':await R(sb.from('nurture_enrollments').update({status:'stopped',stop_reason:`Stopped by ${S.me.name}`}).eq('id',id));toast('Stopped');if(S.lead)nuLeadBox(S.lead);break;
    case'nuStartLead':{const q=S.nu.seqs.find(x=>x.id===$('#nuPick').value);if(!q||!S.lead)break;const first=+(q.steps?.[0]?.day||0);
      await R(sb.from('nurture_enrollments').upsert({sequence_id:q.id,lead_id:S.lead.id,step:0,status:'active',stop_reason:null,attempts:0,last_error:null,enrolled_at:iso(now()),next_at:iso(now()+first*DAY)},{onConflict:'sequence_id,lead_id'}));toast('Sequence started');nuLeadBox(S.lead);break}
  }}catch(err){fail(err)}
});

/* ---------------- events ---------------- */
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,id=t.dataset.id,v=t.dataset.v;
  if(!a.startsWith('wa'))return;
  try{switch(a){
    case'waOpen':S.wa.lead=id;$('#waWrap')?.classList.add('wa-open');$$('.wa-conv').forEach(x=>x.classList.toggle('on',x.dataset.id===id));$('#waThread').innerHTML=loadingHTML;await waThread(S.rv);break;
    case'waBack':S.wa.lead=null;$('#waWrap')?.classList.remove('wa-open');break;
    case'waUnread':S.wa.f.unread=!S.wa.f.unread;t.setAttribute('aria-pressed',S.wa.f.unread);V.wa.load();break;
    case'waSend':await waSendText(t);break;
    case'waTpl':waTemplateModal();break;
    case'waTplSend':await waTemplateSend(t);break;
    case'waConnect':S.wa.newProv=S.wa.newProv||'meta';waConnectModal(id);break;
    case'waProv':S.wa.newProv=v;waConnectModal();break;
    case'waSaveAcc':await waSaveAccount(t);break;
    case'waHook':waHookModal(id);break;
    case'waTest':{t.disabled=true;const r=await waFn({action:'test_account',account_id:id});toast(r.message);t.disabled=false;waSettings();break}
    case'waTpls':waTemplatesModal(id);break;
    case'waSync':{t.disabled=true;t.textContent='Syncing…';const r=await waFn({action:'sync_templates',account_id:id});await loadWa();toast(`${r.count} templates synced`);waTemplatesModal(id);waSettings();break}
    case'waTplAdd':{const name=$('#ntName').value.trim(),body=$('#ntBody').value.trim();if(!name||!body)return toast('Add a name and the message');let n=0;for(const m of body.matchAll(/\{\{(\d+)\}\}/g))n=Math.max(n,+m[1]);
      const htype=$('#ntHType').value,hurl=$('#ntHUrl').value.trim();if(htype&&!/^https:\/\//i.test(hurl))return toast('Add a public https link to the header file');
      await R(sb.from('wa_templates').insert({account_id:id,name,language:$('#ntLang').value.trim()||'en',body,params:n,status:'APPROVED',...(htype?{header_type:htype,header_url:hurl}:{})}));await loadWa();waTemplatesModal(id);break}
    case'waTplDel':arm(t,async()=>{await R(sb.from('wa_templates').delete().eq('id',id));await loadWa();waTemplatesModal(v)},'Delete?');break;
    case'waAccDel':arm(t,async()=>{await waFn({action:'delete_account',id});await loadWa();toast('Removed');waSettings()},'Click again to remove');break;
    case'waQr':await waQrModal();break;
    case'waQrLogout':{await waFn({action:'qr_logout',account_id:id});await loadWa();toast('Disconnected');waSettings();break}
    case'waGwSave':{t.disabled=true;await waFn({action:'set_gateway',url:$('#gwUrl').value.trim(),api_key:$('#gwKey').value.trim()});toast('Gateway saved');waSettings();break}
  }}catch(err){fail(err);t.disabled=false}
});
document.addEventListener('input',e=>{if(e.target.id==='waQ'){S.wa.f.q=e.target.value;clearTimeout(S.wa.qT);S.wa.qT=setTimeout(()=>V.wa.load().catch(fail),350)}});
document.addEventListener('change',e=>{if(e.target.id==='waAgent'){S.wa.f.agent=e.target.value;V.wa.load().catch(fail)}if(e.target.id==='waAcc'){S.wa.sendAcc=e.target.value;waThread(S.rv,true).catch(fail)}});
document.addEventListener('keydown',e=>{if(e.target.id==='waText'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();const b=$('[data-act="waSend"]');if(b&&!b.disabled)waSendText(b)}});


/* =================================================================== */
/* Lead sources (Facebook pages, Google Ads, websites) + assignment      */
/* =================================================================== */
S.ls={sources:[],fb:null,base:''};S.lsNames=[];
async function lsFn(body){const{data,error}=await sb.functions.invoke('leadsources',{body});if(error){let m=error.message;try{const j=await error.context.json();if(j&&j.error)m=j.error}catch(_){}throw new Error(m)}if(data&&data.error)throw new Error(data.error);return data}
async function loadSourceNames(){if(!isMgr())return;try{const{data}=await R(sb.from('lead_sources').select('id,name,kind').order('created_at'));S.lsNames=data.map(x=>x.name)}catch(e){S.lsNames=[]}}
function assignmentCard(d){
  const a=d.assignment;const srcNames=[...new Set([...(d.sources||[]),...S.lsNames])];
  return `<div class="card"><h2>Lead assignment</h2><p class="small muted" style="margin-top:-6px">New leads without an owner (from Facebook, Google Ads, website forms, imports) are given to someone automatically. Rules are checked from top to bottom. The first rule that matches, and has someone available, wins. People in a rule take turns.</p>
  <label class="row" style="margin-bottom:10px"><input type="checkbox" data-sp="assignment.enabled" ${a.enabled?'checked':''}> <b>Assign new leads automatically</b></label>
  ${a.rules.map((r,i)=>`<div class="rule-box"><div class="row small muted" style="margin-bottom:6px"><b style="color:var(--fg)">Rule ${i+1}</b><span class="spacer"></span><button class="btn sm ghost" data-act="ruleUp" data-v="${i}" aria-label="Move up" ${i?'':'disabled'}>↑</button><button class="btn sm ghost" data-act="ruleDel" data-v="${i}" aria-label="Remove rule">${ic('x')}</button></div>
    <div class="grid3"><label class="field"><span>When language is</span><select class="input" data-sp="assignment.rules.${i}.language">${opt('','Any language',r.language)}${(d.languages||[]).map(x=>opt(x,x,r.language)).join('')}</select></label>
    <label class="field"><span>and source is</span><select class="input" data-sp="assignment.rules.${i}.source">${opt('','Any source',r.source)}${srcNames.map(x=>opt(x,x,r.source)).join('')}</select></label>
    <label class="field"><span>and campaign is</span><select class="input" data-sp="assignment.rules.${i}.campaign">${opt('','Any campaign',r.campaign)}${S.campaigns.map(c=>opt(c.id,c.name,r.campaign)).join('')}</select></label></div>
    <label class="field" style="margin-top:8px"><span>Give the lead to</span><select class="input" data-sp="assignment.rules.${i}.mode">${opt('speakers',"Telecallers who speak the lead's language",r.mode||'speakers')}${opt('people','These people',r.mode)}</select></label>
    ${r.mode==='people'?`<div class="row" style="margin-top:8px">${agents().map(m=>`<label class="row small" style="gap:4px"><input type="checkbox" class="ruleAg" data-i="${i}" value="${m.id}" ${(r.agents||[]).includes(m.id)?'checked':''}>${esc(m.name)}${(m.languages||[]).length?` <span class="muted">(${esc(m.languages.join(', '))})</span>`:''}</label>`).join('')}</div>`:`<p class="small muted" style="margin:6px 0 0">Speakers: ${esc(agents().filter(m=>m.role==='telecaller'&&(!r.language||(m.languages||[]).includes(r.language))).map(m=>m.name+((m.languages||[]).length?` (${m.languages.join(', ')})`:' (no languages set)')).join(' · ')||'no telecallers yet')}</p>`}
  </div>`).join('')}
  <div class="row" style="margin-top:10px"><button class="btn sm" data-act="ruleAdd">${ic('plus')}Add rule</button><span class="spacer"></span>
  <label class="field" style="min-width:240px"><span>If no rule matches</span><select class="input" data-sp="assignment.fallback">${opt('all','Share among all telecallers',a.fallback)}${opt('none','Leave unassigned for a manager',a.fallback)}</select></label></div>
  <p class="small muted">Set each telecaller's languages in Team → Edit. Leads get their language from the form's language question, the source's or campaign's default language, the import file, or by hand.</p></div>`;
}
const lsPill=s=>`<span class="pill" style="color:${s.active?(s.last_error?'var(--warn)':'var(--call)'):'var(--muted)'}"><span class="dot"></span><span style="color:var(--fg)">${s.active?(s.last_error?'Check':'Receiving'):'Paused'}</span></span>`;
function lsRow(s){
  const c=s.config||{};
  return `<div class="li" style="flex-direction:column;align-items:stretch"><div class="row"><b>${esc(s.name)}</b>${lsPill(s)}<span class="spacer"></span><span class="small muted">${s.lead_count} leads${s.last_lead_at?' · last '+rel(s.last_lead_at):''}</span></div>
    ${s.last_error?`<div class="small prio-hot">Last problem: ${esc(s.last_error)}</div>`:''}
    <div class="row" style="margin-top:6px"><label class="field" style="flex:1 1 150px"><span>Default language</span><select class="input lsLang" data-id="${s.id}">${langOpts(c.default_language||'','From the form / none')}</select></label>
    <label class="field" style="flex:1 1 150px"><span>Add to campaign</span><select class="input lsCamp" data-id="${s.id}">${campOpts(c.campaign_id||'','No campaign')}</select></label></div>
    <div class="row" style="margin-top:6px">${s.kind==='facebook'?`<button class="btn sm" data-act="lsForms" data-id="${s.id}">Forms</button><button class="btn sm" data-act="lsFetch" data-id="${s.id}">Fetch last 7 days</button>`:`<button class="btn sm" data-act="lsHook" data-id="${s.id}">Connection details</button>`}
    <button class="btn sm" data-act="lsTest" data-id="${s.id}">Send test lead</button><button class="btn sm ghost" data-act="lsToggle" data-id="${s.id}">${s.active?'Pause':'Resume'}</button><button class="btn sm danger" data-act="lsDel" data-id="${s.id}">Remove</button></div></div>`;
}
async function lsSettings(){
  const box=$('#lsSet');if(!box)return;
  let st;
  try{st=await lsFn({action:'status'});const{data}=await R(sb.from('lead_sources').select('*').order('created_at'));S.ls.sources=data;S.lsNames=data.map(x=>x.name)}
  catch(e){if($('#lsSet'))box.innerHTML=`<div class="card"><h2>Lead sources</h2><p class="muted">Lead sources are not installed yet. Run <b>supabase/leadsources.sql</b> and add the <b>leadsources</b> and <b>leads-webhook</b> functions (setup guide, Step 9).</p><p class="small muted">${esc(e.message)}</p></div>`;return}
  S.ls.fb=st.facebook;S.ls.base=st.webhook_base;if(!$('#lsSet'))return;
  const by=k=>S.ls.sources.filter(s=>s.kind===k);const fb=S.ls.fb;
  box.innerHTML=`<div class="card"><h2>Lead sources</h2><p class="small muted" style="margin-top:-6px">New leads arrive here within seconds, get their language, and are assigned by the rules above. A number already in the CRM is not duplicated; the existing lead is marked for a call today.</p>
    <h3 style="margin-top:14px">Facebook &amp; Instagram lead ads</h3>
    ${fb.configured?`<p class="small">Connected as <b>${esc(fb.account||'your Facebook account')}</b>. <button class="btn sm" data-act="fbSetup">Facebook settings</button> <button class="btn sm primary" data-act="fbPages">${ic('plus')}Add Pages</button></p>`
      :`<p class="small muted">Connect any number of Facebook Pages. Leads from their Facebook and Instagram lead forms come in automatically.</p><button class="btn primary sm" data-act="fbSetup">Set up Facebook</button>`}
    <div class="list" style="margin-top:8px">${by('facebook').map(lsRow).join('')||(fb.configured?'<p class="small muted">No Pages added yet.</p>':'')}</div>
    <h3 style="margin-top:18px">Google Ads lead forms</h3><div class="list" style="margin-top:8px">${by('google').map(lsRow).join('')}</div>
    <button class="btn sm" data-act="lsAdd" data-v="google" style="margin-top:8px">${ic('plus')}Add a Google Ads lead form</button>
    <h3 style="margin-top:18px">Website forms, IndiaMART, JustDial, Zapier and others</h3><div class="list" style="margin-top:8px">${by('webhook').map(lsRow).join('')}</div>
    <button class="btn sm" data-act="lsAdd" data-v="webhook" style="margin-top:8px">${ic('plus')}Add a website or other source</button></div>`;
}
function fbSetupModal(){
  const fb=S.ls.fb||{};
  modal(`<h2>Set up Facebook lead ads</h2><ol class="small" style="padding-left:18px;line-height:1.6"><li>In <b>developers.facebook.com</b>, open (or create) a <b>Business</b> app. Copy <b>App secret</b> from App settings → Basic.</li><li>In Business settings → System users, create an admin system user, give it your Pages and ad account, and generate a token for the app with: <span class="mono">leads_retrieval, pages_manage_metadata, pages_show_list, pages_read_engagement, pages_manage_ads, ads_management, business_management</span>.</li><li>Paste both below and save.</li></ol>
  <div class="grid2" style="margin-top:10px"><label class="field"><span>App secret</span><input class="input" id="fbSecret" type="password" placeholder="${fb.has_secret?'Saved. Leave empty to keep':''}"></label><label class="field"><span>Access token</span><input class="input" id="fbToken" type="password" placeholder="${fb.has_token?'Saved. Leave empty to keep':'EAAG…'}"></label>
  <label class="field"><span>Graph API version</span><input class="input mono" id="fbVer" value="${esc(fb.api_version||'v23.0')}"></label></div>
  <p id="fbMsg" class="small prio-hot"></p><div class="row"><button class="btn primary" data-act="fbSave">Save</button><button class="btn" data-act="closeMd">Cancel</button></div>
  ${fb.verify_token?fbHookHtml():''}`);
}
function fbHookHtml(){const fb=S.ls.fb;return `<div class="card" style="margin-top:14px"><b>Last step, once:</b> in your app → <b>Webhooks</b> → choose <b>Page</b> → Subscribe to this object, paste these two values, verify, then subscribe to the <b>leadgen</b> field. Also open Meta Business Suite → Settings → Integrations → <b>Leads access</b> and allow this app for your Pages.
  <label class="field" style="margin-top:10px"><span>Callback URL</span><div class="code-box">${esc(fb.webhook_url)}</div></label><button class="btn sm" data-act="copy" data-v="${esc(fb.webhook_url)}" style="margin-top:4px">${ic('copy')}Copy</button>
  <label class="field" style="margin-top:10px"><span>Verify token</span><div class="code-box">${esc(fb.verify_token)}</div></label><button class="btn sm" data-act="copy" data-v="${esc(fb.verify_token)}" style="margin-top:4px">${ic('copy')}Copy</button></div>`}
async function fbPagesModal(){
  modal(`<h2>Add Facebook Pages</h2><div id="fbPg">${loadingHTML}</div>`);
  try{const r=await lsFn({action:'fb_pages'});const box=$('#fbPg');if(!box)return;
    box.innerHTML=r.pages.length?`<p class="small muted">Pick the Pages whose lead forms should come into the CRM.</p><div class="list" style="margin-top:8px">${r.pages.map(p=>`<label class="li"><input type="checkbox" class="fbPick" value="${esc(p.id)}" ${p.connected?'checked disabled':''}><span class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.category||'')}${p.connected?' · already added':''}${p.can_advertise?'':' · this token cannot advertise on this Page'}</div></span></label>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="fbConnect">Add selected Pages</button><button class="btn" data-act="closeMd">Cancel</button></div><div id="fbRes" class="small" style="margin-top:8px"></div>`
      :'<p class="muted">This token cannot see any Pages. Give the system user access to your Pages in Business settings, then try again.</p>';
  }catch(e){const box=$('#fbPg');if(box)box.innerHTML=`<p class="prio-hot">${esc(e.message)}</p>`}
}
async function fbFormsModal(id){
  const s=S.ls.sources.find(x=>x.id===id);modal(`<h2>Forms on ${esc(s.config.page_name||s.name)}</h2><div id="fbFm">${loadingHTML}</div>`);
  try{const r=await lsFn({action:'fb_forms',source_id:id});const f=s.config.forms||{};const box=$('#fbFm');if(!box)return;
    box.innerHTML=r.forms.length?`<p class="small muted">Set a language or campaign per form. Empty = use the Page's default. A “language” question in the form always wins.</p><div class="list" style="margin-top:8px">${r.forms.map(x=>`<div class="li" style="flex-direction:column;align-items:stretch"><div class="row"><b>${esc(x.name)}</b><span class="small muted">${esc(x.status||'')}${x.locale?' · '+esc(x.locale):''}</span></div>
      <div class="row"><select class="input fmLang" data-f="${esc(x.id)}" data-n="${esc(x.name)}" style="flex:1">${langOpts(f[x.id]?.language||'','Page default language')}</select><select class="input fmCamp" data-f="${esc(x.id)}" style="flex:1">${campOpts(f[x.id]?.campaign_id||'','Page default campaign')}</select></div></div>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="fbFormsSave" data-id="${id}">Save</button><button class="btn" data-act="closeMd">Cancel</button></div>`:'<p class="muted">No lead forms on this Page yet.</p>'}
  catch(e){const box=$('#fbFm');if(box)box.innerHTML=`<p class="prio-hot">${esc(e.message)}</p>`}
}
function lsAddModal(kind){
  modal(`<h2>${kind==='google'?'Add a Google Ads lead form':'Add a website or other source'}</h2><div class="grid2" style="margin-top:12px">
  <label class="field"><span>Name (shown as the lead source)</span><input class="input" id="lsName" value="${kind==='google'?'Google Ads':'Website'}"></label>
  <label class="field"><span>Default language</span><select class="input" id="lsLangNew">${langOpts('','From the form / none')}</select></label>
  <label class="field"><span>Add to campaign</span><select class="input" id="lsCampNew">${campOpts('','No campaign')}</select></label></div>
  <div class="row" style="margin-top:12px"><button class="btn primary" data-act="lsCreate" data-v="${kind}">Create</button><button class="btn" data-act="closeMd">Cancel</button></div>`);
}
function lsHookModal(id){
  const s=S.ls.sources.find(x=>x.id===id);if(!s)return;
  if(s.kind==='google'){const url=`${S.ls.base}?s=${s.id}`;
    modal(`<h2>Connect ${esc(s.name)}</h2><ol class="small" style="padding-left:18px;line-height:1.6"><li>In Google Ads, open <b>Campaigns → Assets → Lead forms</b> and open your lead form.</li><li>Under <b>Lead delivery / Export leads from Google Ads</b>, choose <b>Webhook integration</b>.</li><li>Paste the <b>Webhook URL</b> and <b>Key</b> below, then press <b>Send test data</b>. A test lead appears in Leads within seconds.</li><li>Repeat for each lead form (or add a separate source per form to give each its own language).</li></ol>
      <label class="field" style="margin-top:10px"><span>Webhook URL</span><div class="code-box">${esc(url)}</div></label><button class="btn sm" data-act="copy" data-v="${esc(url)}" style="margin-top:4px">${ic('copy')}Copy</button>
      <label class="field" style="margin-top:10px"><span>Key</span><div class="code-box">${esc(s.token)}</div></label><button class="btn sm" data-act="copy" data-v="${esc(s.token)}" style="margin-top:4px">${ic('copy')}Copy</button>
      <p class="small muted" style="margin-top:10px">Tip: add a question like “Preferred language” to the form; Dialbook reads it and assigns the lead to a telecaller who speaks it.</p>`);
  }else{const url=`${S.ls.base}?s=${s.id}&t=${s.token}`;const ex=`curl -X POST '${url}' -H 'Content-Type: application/json' -d '{"name":"Asha Rao","phone":"9876543210","email":"asha@example.com","city":"Chennai","language":"Tamil","message":"Need a home loan"}'`;
    modal(`<h2>Connect ${esc(s.name)}</h2><p class="small">Send new leads to this address (POST, as JSON or form data). Fields are recognised by their usual names: name, phone / mobile, email, city, language, message. IndiaMART “Push API” leads are understood as they are.</p>
      <label class="field" style="margin-top:10px"><span>Lead address (keep it private)</span><div class="code-box">${esc(url)}</div></label><button class="btn sm" data-act="copy" data-v="${esc(url)}" style="margin-top:4px">${ic('copy')}Copy</button>
      <label class="field" style="margin-top:10px"><span>Example for your web developer</span><div class="code-box">${esc(ex)}</div></label><button class="btn sm" data-act="copy" data-v="${esc(ex)}" style="margin-top:4px">${ic('copy')}Copy example</button>
      <p class="small muted" style="margin-top:10px">Zapier / Make / Pabbly: use a “Webhook → POST” step with this address. WordPress (Contact Form 7, Elementor, WPForms): use a webhook add-on with this address.</p>`);}
}
async function lsSave(id,patch){const s=S.ls.sources.find(x=>x.id===id);await lsFn({action:'source_save',id,kind:s.kind,name:patch.name||s.name,active:patch.active??s.active,config:patch.config||{}});await lsSettings()}

document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,id=t.dataset.id,v=t.dataset.v;
  const mine=['ruleAdd','ruleDel','ruleUp','bkAuto','autoAll','fbSetup','fbSave','fbPages','fbConnect','lsForms','fbFormsSave','lsFetch','lsHook','lsTest','lsToggle','lsDel','lsAdd','lsCreate'];
  if(!mine.includes(a))return;
  try{switch(a){
    case'ruleAdd':S.sd.assignment.rules.push({id:gid('r'),language:'',source:'',campaign:'',mode:'speakers',agents:[]});S.sdirty=true;render();break;
    case'ruleDel':S.sd.assignment.rules.splice(+v,1);S.sdirty=true;render();break;
    case'ruleUp':{const r=S.sd.assignment.rules,i=+v;if(i>0){[r[i-1],r[i]]=[r[i],r[i-1]];S.sdirty=true;render()}break}
    case'bkAuto':{const n=await rpc('auto_assign_leads',{p_ids:[...S.sel]});toast(n?`${n} leads assigned by the rules`:'No rule matched. Check Settings → Lead assignment is switched on.');S.sel.clear();V.leads.load();break}
    case'autoAll':{t.disabled=true;const n=await rpc('auto_assign_leads',{p_ids:null});toast(n?`${n} unassigned leads assigned`:'Nothing assigned. Switch on Settings → Lead assignment, and set team languages.');t.disabled=false;break}
    case'fbSetup':fbSetupModal();break;
    case'fbSave':{t.disabled=true;$('#fbMsg').textContent='';try{const r=await lsFn({action:'fb_setup',app_secret:$('#fbSecret').value.trim(),user_token:$('#fbToken').value.trim(),api_version:$('#fbVer').value.trim()});await lsSettings();fbSetupModal();toast(r.account?`Connected as ${r.account}`:'Saved')}catch(err){$('#fbMsg').textContent=err.message;t.disabled=false}break}
    case'fbPages':await fbPagesModal();break;
    case'fbConnect':{const ids=$$('.fbPick:checked:not(:disabled)').map(x=>x.value);if(!ids.length)return toast('Pick at least one Page');t.disabled=true;t.textContent='Adding…';const r=await lsFn({action:'fb_connect',page_ids:ids});$('#fbRes').innerHTML=r.results.map(x=>`<div class="${x.ok?'':'prio-hot'}">${x.ok?'✓':'✗'} ${esc(x.page)}${x.error?': '+esc(x.error):''}</div>`).join('');t.textContent='Done';await lsSettings();break}
    case'lsForms':await fbFormsModal(id);break;
    case'fbFormsSave':{const s=S.ls.sources.find(x=>x.id===id);const forms={...(s.config.forms||{})};$$('.fmLang').forEach(el=>{const f=el.dataset.f;forms[f]={...(forms[f]||{}),name:el.dataset.n,language:el.value}});$$('.fmCamp').forEach(el=>{const f=el.dataset.f;forms[f]={...(forms[f]||{}),campaign_id:el.value}});await lsSave(id,{config:{forms}});closeModal();toast('Saved');break}
    case'lsFetch':{t.disabled=true;t.textContent='Fetching…';let r;try{r=await lsFn({action:'fb_fetch',source_id:id,days:7})}finally{t.disabled=false;t.textContent='Fetch last 7 days'}toast(`${r.created||0} new leads, ${r.existing||0} repeat enquiries, ${r.duplicate||0} already in the CRM`+(r.skipped?`, ${r.skipped} skipped (no phone or email; Meta test leads use dummy data)`:''));await lsSettings();break}
    case'lsHook':lsHookModal(id);break;
    case'lsTest':{t.disabled=true;const r=await lsFn({action:'test_lead',source_id:id});toast(r.assigned_name?`Test lead created and given to ${r.assigned_name}`:'Test lead created (not assigned: no rule matched)');await lsSettings();break}
    case'lsToggle':{const s=S.ls.sources.find(x=>x.id===id);await lsSave(id,{active:!s.active});break}
    case'lsDel':arm(t,async()=>{await lsFn({action:'source_delete',id});toast('Source removed. Its leads are kept.');await lsSettings()},'Click again to remove');break;
    case'lsAdd':lsAddModal(v);break;
    case'lsCreate':{t.disabled=true;const r=await lsFn({action:'source_save',kind:v,name:$('#lsName').value.trim(),config:{default_language:$('#lsLangNew').value,campaign_id:$('#lsCampNew').value}});await lsSettings();lsHookModal(r.source.id);break}
  }}catch(err){fail(err);t.disabled=false}
});
document.addEventListener('change',async e=>{
  const t=e.target;
  try{
    if(t.classList.contains('lsLang')){await lsSave(t.dataset.id,{config:{default_language:t.value}});toast('Saved');return}
    if(t.classList.contains('lsCamp')){await lsSave(t.dataset.id,{config:{campaign_id:t.value}});toast('Saved');return}
    if(t.classList.contains('ruleAg')){const r=S.sd.assignment.rules[+t.dataset.i];r.agents=r.agents||[];if(t.checked){if(!r.agents.includes(t.value))r.agents.push(t.value)}else r.agents=r.agents.filter(x=>x!==t.value);S.sdirty=true;const b=$('[data-act="saveSet"]');if(b)b.disabled=false;return}
    if(t.dataset.sp&&/^assignment\.rules\.\d+\.(mode|language)$/.test(t.dataset.sp))render();
  }catch(err){fail(err)}
});

/* ---------- boot ---------- */
async function boot(){
  if(!CFG.url||!CFG.anonKey||/YOUR-/.test(CFG.url+CFG.anonKey))return showSetupMissing();
  if(!window.supabase)return showAuth({text:'Could not load the sign-in library. Check your internet connection and reload.'});
  sb=window.supabase.createClient(CFG.url,CFG.anonKey);
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return showAuth();
  afterLogin().catch(e=>{fail(e);showAuth()});
}
boot();
})();
